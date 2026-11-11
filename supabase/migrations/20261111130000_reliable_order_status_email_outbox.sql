-- Persist every customer order-status notification in the transactional outbox.
ALTER TABLE public.order_email_outbox
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'order_received';

ALTER TABLE public.order_email_outbox
  DROP CONSTRAINT IF EXISTS order_email_outbox_recipient_type_check;

ALTER TABLE public.order_email_outbox
  ADD CONSTRAINT order_email_outbox_recipient_type_check
  CHECK (recipient_type IN ('customer', 'staff'));

ALTER TABLE public.order_email_outbox
  DROP CONSTRAINT IF EXISTS order_email_outbox_order_id_recipient_type_key;

ALTER TABLE public.order_email_outbox
  ADD CONSTRAINT order_email_outbox_event_type_check
  CHECK (event_type IN ('order_received', 'quote_confirmed', 'payment_received', 'shipped', 'delivered', 'cancelled'));

CREATE UNIQUE INDEX IF NOT EXISTS order_email_outbox_order_event_recipient_uidx
  ON public.order_email_outbox(order_id, event_type, recipient_type);

-- Keep the original guest checkout confirmation idempotent as order_received.
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
  IF NEW.checkout_idempotency_key IS NULL THEN RETURN NEW; END IF;
  v_customer_name := COALESCE(NEW.shipping_address_snapshot->>'recipient_name', '');
  v_payload := pg_catalog.jsonb_build_object(
    'eventType', 'order_received',
    'orderNumber', NEW.order_number,
    'customerName', v_customer_name,
    'customerEmail', NEW.customer_email,
    'subtotal', NEW.subtotal,
    'currency', NEW.currency
  );
  INSERT INTO public.order_email_outbox(order_id,event_type,recipient_type,recipient_email,payload)
  VALUES
    (NEW.id,'order_received','customer',NEW.customer_email,v_payload),
    (NEW.id,'order_received','staff','jinqaya@gmail.com',v_payload)
  ON CONFLICT (order_id,event_type,recipient_type) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_order_status_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_event text;
  v_customer_name text;
  v_shipment record;
  v_payload jsonb;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  v_event := CASE NEW.status::text
    WHEN 'pending_payment' THEN 'quote_confirmed'
    WHEN 'paid' THEN 'payment_received'
    WHEN 'shipped' THEN 'shipped'
    WHEN 'delivered' THEN 'delivered'
    WHEN 'cancelled' THEN 'cancelled'
    ELSE NULL
  END;
  IF v_event IS NULL OR NULLIF(trim(NEW.customer_email),'') IS NULL THEN RETURN NEW; END IF;

  v_customer_name := COALESCE(NEW.shipping_address_snapshot->>'recipient_name','');
  SELECT s.carrier_name,s.tracking_number,s.tracking_url
    INTO v_shipment
    FROM public.shipments s
   WHERE s.order_id=NEW.id
   ORDER BY s.created_at DESC
   LIMIT 1;

  v_payload := pg_catalog.jsonb_build_object(
    'eventType',v_event,
    'orderNumber',NEW.order_number,
    'customerName',v_customer_name,
    'customerEmail',NEW.customer_email,
    'subtotal',NEW.subtotal,
    'currency',NEW.currency,
    'shippingAmount',NEW.shipping_amount,
    'shippingMethod',COALESCE(v_shipment.carrier_name,NEW.shipping_method_name),
    'trackingNumber',v_shipment.tracking_number,
    'trackingUrl',v_shipment.tracking_url
  );

  INSERT INTO public.order_email_outbox(order_id,event_type,recipient_type,recipient_email,payload)
  VALUES(NEW.id,v_event,'customer',NEW.customer_email,v_payload)
  ON CONFLICT(order_id,event_type,recipient_type) DO NOTHING;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enqueue_order_status_email() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS orders_enqueue_status_email ON public.orders;
CREATE TRIGGER orders_enqueue_status_email
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.enqueue_order_status_email();

DROP FUNCTION IF EXISTS public.admin_list_order_email_outbox(uuid);
CREATE FUNCTION public.admin_list_order_email_outbox(p_order_id uuid)
RETURNS TABLE (
  id uuid,event_type text,recipient_type text,recipient_email text,status text,
  attempt_count integer,max_attempts integer,next_attempt_at timestamptz,
  last_error text,sent_at timestamptz,created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.can_manage_catalog() THEN
    RAISE EXCEPTION 'Not authorized to view order email status.';
  END IF;
  RETURN QUERY
  SELECT q.id,q.event_type,q.recipient_type,q.recipient_email,q.status,q.attempt_count,
         q.max_attempts,q.next_attempt_at,q.last_error,q.sent_at,q.created_at
    FROM public.order_email_outbox q
   WHERE q.order_id=p_order_id
   ORDER BY q.created_at ASC;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_list_order_email_outbox(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_list_order_email_outbox(uuid) TO authenticated;
