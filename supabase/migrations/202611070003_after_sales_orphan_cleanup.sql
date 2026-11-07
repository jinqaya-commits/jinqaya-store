-- Cleanup only expired, unconsumed upload reservations not referenced by an after-sales case.
create or replace function public.list_expired_after_sales_orphan_keys(p_limit integer default 100)
returns table(object_key text)
language sql security definer set search_path=''
as $function$
 select t.object_key
 from public.after_sales_upload_tickets t
 where t.consumed_at is null and t.expires_at < now() - interval '1 hour'
 and not exists(select 1 from public.after_sales_cases c where t.object_key=any(c.evidence_urls))
 order by t.expires_at asc
 limit greatest(1,least(coalesce(p_limit,100),500));
$function$;
revoke all on function public.list_expired_after_sales_orphan_keys(integer) from public,anon,authenticated;
grant execute on function public.list_expired_after_sales_orphan_keys(integer) to service_role;

create or replace function public.delete_after_sales_orphan_ticket_rows(p_object_keys text[])
returns integer language plpgsql security definer set search_path=''
as $function$
declare v_count integer;
begin
 delete from public.after_sales_upload_tickets t
 where t.object_key=any(coalesce(p_object_keys,'{}'::text[]))
 and t.consumed_at is null and t.expires_at<now()-interval '1 hour'
 and not exists(select 1 from public.after_sales_cases c where t.object_key=any(c.evidence_urls));
 get diagnostics v_count=row_count;
 return v_count;
end; $function$;
revoke all on function public.delete_after_sales_orphan_ticket_rows(text[]) from public,anon,authenticated;
grant execute on function public.delete_after_sales_orphan_ticket_rows(text[]) to service_role;
