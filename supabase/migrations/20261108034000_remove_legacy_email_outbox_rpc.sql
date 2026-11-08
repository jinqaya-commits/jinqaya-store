-- Remove the legacy four-argument overload. The worker now calls the
-- five-argument function so permanent provider errors can be marked dead.
DROP FUNCTION IF EXISTS public.complete_order_email_outbox(uuid, boolean, text, text);

REVOKE ALL ON FUNCTION public.complete_order_email_outbox(uuid, boolean, text, text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_order_email_outbox(uuid, boolean, text, text, boolean)
  TO service_role;
