CREATE OR REPLACE FUNCTION public.admin_list_order_email_outbox(p_order_id uuid)
RETURNS TABLE (
  id uuid,
  recipient_type text,
  recipient_email text,
  status text,
  attempt_count integer,
  max_attempts integer,
  next_attempt_at timestamptz,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.can_manage_catalog() THEN
    RAISE EXCEPTION 'Not authorized to view order email status.';
  END IF;
  RETURN QUERY
  SELECT q.id, q.recipient_type, q.recipient_email, q.status, q.attempt_count,
         q.max_attempts, q.next_attempt_at, q.last_error, q.sent_at, q.created_at
    FROM public.order_email_outbox q
   WHERE q.order_id = p_order_id
   ORDER BY q.created_at ASC;
END;
$function$;

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
         max_attempts = GREATEST(q.max_attempts, q.attempt_count + 3),
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

REVOKE ALL ON FUNCTION public.admin_list_order_email_outbox(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_order_email_outbox(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_retry_order_email_outbox(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_retry_order_email_outbox(uuid) TO authenticated;
