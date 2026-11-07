CREATE TABLE IF NOT EXISTS public.order_email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  recipient_type text NOT NULL CHECK (recipient_type IN ('customer', 'staff')),
  recipient_email text NOT NULL CHECK (length(trim(recipient_email)) BETWEEN 5 AND 254),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'retry', 'sent', 'dead')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts integer NOT NULL DEFAULT 8 CHECK (max_attempts BETWEEN 1 AND 20),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  last_error text,
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, recipient_type)
);

CREATE INDEX IF NOT EXISTS order_email_outbox_due_idx
  ON public.order_email_outbox (next_attempt_at, created_at)
  WHERE status IN ('pending', 'retry', 'processing');

ALTER TABLE public.order_email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_email_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.order_email_outbox TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_guest_order_emails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_customer_name text;
  v_payload jsonb;
BEGIN
  IF NEW.checkout_idempotency_key IS NULL THEN
    RETURN NEW;
  END IF;

  v_customer_name := COALESCE(NEW.shipping_address_snapshot->>'recipient_name', '');

  v_payload := pg_catalog.jsonb_build_object(
    'orderNumber', NEW.order_number,
    'customerName', COALESCE(v_customer_name, ''),
    'customerEmail', NEW.customer_email,
    'subtotal', NEW.subtotal,
    'currency', NEW.currency
  );

  INSERT INTO public.order_email_outbox (
    order_id, recipient_type, recipient_email, payload
  )
  VALUES
    (NEW.id, 'customer', NEW.customer_email, v_payload),
    (NEW.id, 'staff', 'jinqaya@gmail.com', v_payload)
  ON CONFLICT (order_id, recipient_type) DO NOTHING;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enqueue_guest_order_emails() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS orders_enqueue_guest_order_emails ON public.orders;
CREATE TRIGGER orders_enqueue_guest_order_emails
AFTER UPDATE OF subtotal, currency ON public.orders
FOR EACH ROW
WHEN (NEW.checkout_idempotency_key IS NOT NULL)
EXECUTE FUNCTION public.enqueue_guest_order_emails();

CREATE OR REPLACE FUNCTION public.claim_order_email_outbox(
  p_order_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS SETOF public.order_email_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT q.id
      FROM public.order_email_outbox q
     WHERE (p_order_id IS NULL OR q.order_id = p_order_id)
       AND q.attempt_count < q.max_attempts
       AND q.next_attempt_at <= pg_catalog.now()
       AND (
         q.status IN ('pending', 'retry')
         OR (q.status = 'processing' AND q.locked_until < pg_catalog.now())
       )
     ORDER BY q.created_at
     FOR UPDATE SKIP LOCKED
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100)
  )
  UPDATE public.order_email_outbox q
     SET status = 'processing',
         attempt_count = q.attempt_count + 1,
         locked_until = pg_catalog.now() + interval '5 minutes',
         last_error = NULL,
         updated_at = pg_catalog.now()
    FROM candidates c
   WHERE q.id = c.id
  RETURNING q.*;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_order_email_outbox(
  p_id uuid,
  p_success boolean,
  p_error text DEFAULT NULL,
  p_provider_message_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_rows integer;
BEGIN
  UPDATE public.order_email_outbox q
     SET status = CASE
           WHEN p_success THEN 'sent'
           WHEN q.attempt_count >= q.max_attempts THEN 'dead'
           ELSE 'retry'
         END,
         next_attempt_at = CASE
           WHEN p_success THEN q.next_attempt_at
           ELSE pg_catalog.now() + pg_catalog.make_interval(
             secs => LEAST(86400, (60 * pg_catalog.power(2, LEAST(q.attempt_count - 1, 10)))::integer)
           )
         END,
         locked_until = NULL,
         last_error = CASE WHEN p_success THEN NULL ELSE pg_catalog.left(COALESCE(p_error, 'delivery_failed'), 1000) END,
         provider_message_id = COALESCE(p_provider_message_id, q.provider_message_id),
         sent_at = CASE WHEN p_success THEN pg_catalog.now() ELSE q.sent_at END,
         updated_at = pg_catalog.now()
   WHERE q.id = p_id
     AND q.status = 'processing';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Order email outbox item is not currently processing.';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_order_email_outbox(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_order_email_outbox(uuid, boolean, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_order_email_outbox(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_order_email_outbox(uuid, boolean, text, text) TO service_role;
