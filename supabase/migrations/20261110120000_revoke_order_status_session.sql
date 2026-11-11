-- Revoke the server-side order-status session when the customer ends it.
create or replace function public.revoke_customer_order_status_session(p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_deleted integer;
begin
  delete from public.customer_order_status_sessions
   where token_hash=p_token_hash;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$function$;

revoke all on function public.revoke_customer_order_status_session(text) from public, anon, authenticated;
grant execute on function public.revoke_customer_order_status_session(text) to service_role;
