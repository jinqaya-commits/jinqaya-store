create or replace function public.admin_update_shipment_issue(
 p_issue_id uuid, p_status text, p_resolution_action text, p_resolution_notes text,
 p_refund_amount numeric default null, p_refund_reference text default null, p_confirm_refund boolean default false
) returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare v_issue public.shipment_issue_cases%rowtype;
begin
 if not public.can_manage_catalog() then raise exception 'You do not have permission to manage shipment issues.'; end if;
 if p_issue_id is null or p_status is null or p_status not in ('open','in_progress','resolved') or
    (p_resolution_action is not null and p_resolution_action not in ('awaiting_carrier','reship','refund','other')) or
    length(coalesce(p_resolution_notes,'')) > 3000 or length(coalesce(p_refund_reference,'')) > 200 then raise exception 'Invalid shipment issue update.'; end if;
 select * into v_issue from public.shipment_issue_cases where id=p_issue_id for update;
 if not found then raise exception 'Shipment issue not found.'; end if;
 if p_confirm_refund then
   if p_resolution_action <> 'refund' or p_refund_amount is null or p_refund_amount <= 0 then raise exception 'Record a positive actual refund amount and select Refund as the resolution.'; end if;
   if v_issue.refund_confirmed_at is not null then raise exception 'This refund has already been recorded.'; end if;
 end if;
 if p_status='resolved' and p_resolution_action='refund' and v_issue.refund_confirmed_at is null and not p_confirm_refund then raise exception 'Record the actual refund before resolving this refund case.'; end if;
 if p_status='resolved' and p_resolution_action='reship' and v_issue.replacement_shipment_id is null then raise exception 'Create the replacement shipment before resolving this reshipment case.'; end if;
 update public.shipment_issue_cases set status=p_status,resolution_action=p_resolution_action,
   resolution_notes=nullif(left(trim(coalesce(p_resolution_notes,'')),3000),''),
   refund_amount=case when p_confirm_refund then p_refund_amount else refund_amount end,
   refund_reference=case when p_confirm_refund then nullif(left(trim(coalesce(p_refund_reference,'')),200),'') else refund_reference end,
   refund_confirmed_at=case when p_confirm_refund then now() else refund_confirmed_at end,
   updated_by=auth.uid(),updated_at=now() where id=p_issue_id;
 return jsonb_build_object('issue_id',p_issue_id,'status',p_status,'refund_confirmed',p_confirm_refund);
end;
$function$;
revoke all on function public.admin_update_shipment_issue(uuid,text,text,text,numeric,text,boolean) from public,anon;
grant execute on function public.admin_update_shipment_issue(uuid,text,text,text,numeric,text,boolean) to authenticated;
