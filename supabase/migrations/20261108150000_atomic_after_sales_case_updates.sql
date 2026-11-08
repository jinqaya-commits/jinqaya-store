-- Update an after-sales case and append its audit event in one transaction.
create or replace function public.admin_update_after_sales_case(
 p_order_id uuid,
 p_case_id uuid,
 p_update_status boolean default false,
 p_status text default null,
 p_update_resolution boolean default false,
 p_resolution text default null,
 p_update_refund_status boolean default false,
 p_refund_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
 v_case public.after_sales_cases%rowtype;
 v_old jsonb;
 v_new jsonb;
 v_actor uuid:=auth.uid();
 v_event_description text;
begin
 if v_actor is null or not public.can_manage_catalog() then
  raise exception 'You do not have permission to manage after-sales cases.';
 end if;
 if p_order_id is null or p_case_id is null
    or not (p_update_status or p_update_resolution or p_update_refund_status) then
  raise exception 'No valid case updates were provided.';
 end if;
 if p_update_status and p_status not in ('under_review','approved','rejected','resolved') then
  raise exception 'Invalid after-sales case status.';
 end if;
 if p_update_resolution and (p_resolution is null or length(p_resolution)>3000) then
  raise exception 'Resolution must be 3000 characters or fewer.';
 end if;
 if p_update_refund_status and p_refund_status not in ('not_started','pending_manual') then
  raise exception 'Refund confirmation must use the order refund ledger action.';
 end if;

 select * into v_case
 from public.after_sales_cases
 where id=p_case_id and order_id=p_order_id
 for update;
 if not found then raise exception 'After-sales case not found.'; end if;
 if p_update_refund_status and v_case.refund_status='confirmed' then
  raise exception 'A confirmed refund cannot be changed.';
 end if;

 v_old:=jsonb_build_object(
  'status',v_case.status,
  'refund_status',v_case.refund_status,
  'resolution',v_case.resolution
 );

 update public.after_sales_cases
 set status=case when p_update_status then p_status else status end,
     reviewed_by=case when p_update_status then v_actor else reviewed_by end,
     reviewed_at=case when p_update_status then now() else reviewed_at end,
     resolved_at=case when p_update_status and p_status='resolved' then now() else resolved_at end,
     resolution=case when p_update_resolution then nullif(trim(p_resolution),'') else resolution end,
     refund_status=case when p_update_refund_status then p_refund_status else refund_status end,
     updated_at=now()
 where id=p_case_id and order_id=p_order_id
 returning * into v_case;

 v_new:=jsonb_build_object(
  'status',v_case.status,
  'refund_status',v_case.refund_status,
  'resolution',v_case.resolution
 );
 v_event_description:=concat_ws(' ',
  case when p_update_status then 'Case status updated.' end,
  case when p_update_refund_status then 'Manual refund status updated.' end,
  case when p_update_resolution then 'Resolution notes updated.' end
 );
 insert into public.after_sales_case_events(
  case_id,event_type,description,old_values,new_values,created_by
 ) values (
  p_case_id,'case_updated',v_event_description,v_old,v_new,v_actor
 );

 return jsonb_build_object('case',to_jsonb(v_case));
end;
$function$;

revoke all on function public.admin_update_after_sales_case(uuid,uuid,boolean,text,boolean,text,boolean,text) from public,anon;
grant execute on function public.admin_update_after_sales_case(uuid,uuid,boolean,text,boolean,text,boolean,text) to authenticated;
