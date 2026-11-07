-- Restrict guest after-sales SECURITY DEFINER RPCs to trusted server-side callers.
-- Customer access remains available through the Next.js API routes, which use the service-role client.
revoke all on function public.check_after_sales_customer_session(uuid,text) from public, anon, authenticated;
revoke all on function public.create_after_sales_email_challenge(uuid,text,text) from public, anon, authenticated;
revoke all on function public.create_after_sales_email_challenge(text,text,text) from public, anon, authenticated;
revoke all on function public.verify_after_sales_email_code(uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.verify_after_sales_email_code(text,text,text,text) from public, anon, authenticated;
revoke all on function public.reserve_after_sales_upload(uuid,text,text,text,bigint) from public, anon, authenticated;
revoke all on function public.validate_after_sales_upload_ticket(uuid,text,text,text,bigint) from public, anon, authenticated;
revoke all on function public.consume_after_sales_upload_tickets(uuid,text,text[]) from public, anon, authenticated;
revoke all on function public.submit_customer_after_sales_case(uuid,text,text,text[]) from public, anon, authenticated;

grant execute on function public.check_after_sales_customer_session(uuid,text) to service_role;
grant execute on function public.create_after_sales_email_challenge(uuid,text,text) to service_role;
grant execute on function public.create_after_sales_email_challenge(text,text,text) to service_role;
grant execute on function public.verify_after_sales_email_code(uuid,text,text,text) to service_role;
grant execute on function public.verify_after_sales_email_code(text,text,text,text) to service_role;
grant execute on function public.reserve_after_sales_upload(uuid,text,text,text,bigint) to service_role;
grant execute on function public.validate_after_sales_upload_ticket(uuid,text,text,text,bigint) to service_role;
grant execute on function public.consume_after_sales_upload_tickets(uuid,text,text[]) to service_role;
grant execute on function public.submit_customer_after_sales_case(uuid,text,text,text[]) to service_role;
