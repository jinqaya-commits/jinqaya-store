CREATE OR REPLACE FUNCTION public.admin_retry_order_email_outbox(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_rows integer;
BEGIN
  IF NOT public.can_manage_catalog() THEN
    RAISE EXCEPTION 'Not authorized to retry order email.';
  END IF;

  UPDATE public.order_email_outbox q
     SET status = 'retry',
         attempt_count = 0,
         max_attempts = GREATEST(q.max_attempts, 3),
         next_attempt_at = pg_catalog.now(),
         locked_until = NULL,
         last_error = 'Manually queued by an administrator',
         updated_at = pg_catalog.now()
   WHERE q.id = p_id
     AND q.status IN ('dead', 'retry')
     AND q.sent_at IS NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Only unsent failed or retryable emails can be manually retried.';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_retry_order_email_outbox(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_retry_order_email_outbox(uuid) TO authenticated;
