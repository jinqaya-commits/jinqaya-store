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
  UPDATE public.order_email_outbox q
     SET status = 'dead',
         locked_until = NULL,
         last_error = COALESCE(q.last_error, 'worker_lease_expired_after_final_attempt'),
         updated_at = pg_catalog.now()
   WHERE q.status = 'processing'
     AND q.locked_until < pg_catalog.now()
     AND q.attempt_count >= q.max_attempts;

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
         locked_until = pg_catalog.now() + interval '2 minutes',
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
  p_provider_message_id text DEFAULT NULL,
  p_retryable boolean DEFAULT true
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
           WHEN NOT COALESCE(p_retryable, true) OR q.attempt_count >= q.max_attempts THEN 'dead'
           ELSE 'retry'
         END,
         next_attempt_at = CASE
           WHEN p_success OR NOT COALESCE(p_retryable, true) THEN q.next_attempt_at
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
REVOKE ALL ON FUNCTION public.complete_order_email_outbox(uuid, boolean, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_order_email_outbox(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_order_email_outbox(uuid, boolean, text, text, boolean) TO service_role;
