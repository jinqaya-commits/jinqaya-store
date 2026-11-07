create table if not exists public.order_refunds (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete restrict,
 source_type text not null check (source_type in ('after_sales_case','shipment_issue')),
 source_id uuid not null,
 amount numeric(12,2) not null check (amount>0 and amount=round(amount,2)),
 currency character(3) not null,
 reference text,
 recorded_by uuid references auth.users(id) on delete set null,
 confirmed_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 constraint order_refunds_reference_length check(reference is null or length(reference)<=200),
 constraint order_refunds_source_unique unique(source_type,source_id)
);
create index if not exists order_refunds_order_id_idx on public.order_refunds(order_id,confirmed_at);
alter table public.order_refunds enable row level security;
revoke all on public.order_refunds from public,anon,authenticated;
grant select on public.order_refunds to authenticated;
grant all on public.order_refunds to service_role;
drop policy if exists "Staff can view order refund ledger" on public.order_refunds;
create policy "Staff can view order refund ledger" on public.order_refunds for select to authenticated using ((select public.can_manage_catalog()));

insert into public.order_refunds(order_id,source_type,source_id,amount,currency,reference,recorded_by,confirmed_at)
select c.order_id,'after_sales_case',c.id,c.refund_amount,o.currency,c.refund_reference,c.reviewed_by,c.refund_confirmed_at
from public.after_sales_cases c join public.orders o on o.id=c.order_id
where c.refund_status='confirmed' and c.refund_amount>0 and c.refund_confirmed_at is not null
on conflict(source_type,source_id) do nothing;

insert into public.order_refunds(order_id,source_type,source_id,amount,currency,reference,recorded_by,confirmed_at)
select i.order_id,'shipment_issue',i.id,i.refund_amount,o.currency,i.refund_reference,i.updated_by,i.refund_confirmed_at
from public.shipment_issue_cases i join public.orders o on o.id=i.order_id
where i.refund_confirmed_at is not null and i.refund_amount>0
on conflict(source_type,source_id) do nothing;

create or replace function public.admin_confirm_after_sales_refund(p_case_id uuid,p_refund_amount numeric,p_refund_reference text default null)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_case public.after_sales_cases%rowtype; v_order public.orders%rowtype; v_order_id uuid; v_paid numeric(12,2); v_refunded numeric(12,2); v_remaining numeric(12,2); v_new_status public.order_status;
begin
 if not public.can_manage_catalog() then raise exception 'You do not have permission to confirm refunds.'; end if;
 if p_case_id is null or p_refund_amount is null or p_refund_amount<=0 or p_refund_amount<>round(p_refund_amount,2) or length(coalesce(p_refund_reference,''))>200 then
  raise exception 'Enter a positive refund amount with no more than two decimal places and a valid reference.';
 end if;
 select c.order_id into v_order_id from public.after_sales_cases c where c.id=p_case_id;
 if not found then raise exception 'After-sales case not found.'; end if;
 select * into v_order from public.orders where id=v_order_id for update;
 if not found then raise exception 'Order not found.'; end if;
 select * into v_case from public.after_sales_cases where id=p_case_id and order_id=v_order_id for update;
 if v_case.refund_status='confirmed' or v_case.refund_confirmed_at is not null then raise exception 'This after-sales refund has already been recorded.'; end if;
 if exists(select 1 from public.payments p where p.order_id=v_order_id and p.status in ('paid','partially_refunded','refunded') and p.currency<>v_order.currency) then
  raise exception 'Payment currency does not match the order currency. Refund confirmation is blocked for manual review.';
 end if;
 select coalesce(sum(p.amount),0)::numeric(12,2) into v_paid from public.payments p where p.order_id=v_order_id and p.status in ('paid','partially_refunded','refunded') and p.currency=v_order.currency;
 if v_paid<=0 then raise exception 'No successfully recorded payment exists for this order. Refund cannot be confirmed.'; end if;
 select coalesce(sum(r.amount),0)::numeric(12,2) into v_refunded from public.order_refunds r where r.order_id=v_order_id;
 v_remaining:=v_paid-v_refunded;
 if p_refund_amount>v_remaining then raise exception 'Refund exceeds remaining refundable balance. Paid: %, refunded: %, remaining: %, requested: % %.',v_paid,v_refunded,greatest(v_remaining,0),p_refund_amount,v_order.currency; end if;
 insert into public.order_refunds(order_id,source_type,source_id,amount,currency,reference,recorded_by)
 values(v_order_id,'after_sales_case',p_case_id,p_refund_amount,v_order.currency,nullif(trim(coalesce(p_refund_reference,'')),''),auth.uid());
 update public.after_sales_cases set refund_status='confirmed',refund_amount=p_refund_amount,refund_reference=nullif(trim(coalesce(p_refund_reference,'')),''),refund_confirmed_at=now(),updated_at=now() where id=p_case_id;
 insert into public.after_sales_case_events(case_id,event_type,description,old_values,new_values,created_by)
 values(p_case_id,'refund_status_changed','Actual refund recorded and checked against the order refund balance.',jsonb_build_object('refund_status',v_case.refund_status,'refund_amount',v_case.refund_amount),jsonb_build_object('refund_status','confirmed','refund_amount',p_refund_amount,'currency',v_order.currency),auth.uid());
 v_new_status:=case when v_refunded+p_refund_amount>=v_paid then 'refunded'::public.order_status else 'partially_refunded'::public.order_status end;
 if v_order.status<>v_new_status then
  update public.orders set status=v_new_status,updated_at=now() where id=v_order_id;
  insert into public.order_status_history(order_id,old_status,new_status,note,changed_by) values(v_order_id,v_order.status,v_new_status,'Refund confirmed',auth.uid());
 end if;
 insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,old_values,new_values)
 values(auth.uid(),'order_refund.confirmed','order',v_order_id,jsonb_build_object('refunded_total',v_refunded,'remaining_before',v_remaining),jsonb_build_object('source_type','after_sales_case','source_id',p_case_id,'amount',p_refund_amount,'currency',v_order.currency,'refunded_total',v_refunded+p_refund_amount));
 return jsonb_build_object('case_id',p_case_id,'order_id',v_order_id,'amount',p_refund_amount,'currency',v_order.currency,'paid_total',v_paid,'refunded_total',v_refunded+p_refund_amount,'remaining_refundable',v_paid-v_refunded-p_refund_amount,'order_status',v_new_status);
end;
$function$;
revoke all on function public.admin_confirm_after_sales_refund(uuid,numeric,text) from public,anon;
grant execute on function public.admin_confirm_after_sales_refund(uuid,numeric,text) to authenticated;

create or replace function public.admin_update_shipment_issue(p_issue_id uuid,p_status text,p_resolution_action text,p_resolution_notes text,p_refund_amount numeric default null,p_refund_reference text default null,p_confirm_refund boolean default false)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_issue public.shipment_issue_cases%rowtype; v_order public.orders%rowtype; v_order_id uuid; v_paid numeric(12,2); v_refunded numeric(12,2); v_remaining numeric(12,2); v_new_status public.order_status;
begin
 if not public.can_manage_catalog() then raise exception 'You do not have permission to manage shipment issues.'; end if;
 if p_issue_id is null or p_status is null or p_status not in ('open','in_progress','resolved') or (p_resolution_action is not null and p_resolution_action not in ('awaiting_carrier','reship','refund','other')) or length(coalesce(p_resolution_notes,''))>3000 or length(coalesce(p_refund_reference,''))>200 then raise exception 'Invalid shipment issue update.'; end if;
 select i.order_id into v_order_id from public.shipment_issue_cases i where i.id=p_issue_id;
 if not found then raise exception 'Shipment issue not found.'; end if;
 select * into v_order from public.orders where id=v_order_id for update;
 if not found then raise exception 'Order not found.'; end if;
 select * into v_issue from public.shipment_issue_cases where id=p_issue_id and order_id=v_order_id for update;
 if not found then raise exception 'Shipment issue not found.'; end if;
 if p_confirm_refund then
  if p_resolution_action<>'refund' or p_refund_amount is null or p_refund_amount<=0 or p_refund_amount<>round(p_refund_amount,2) then raise exception 'Record a positive actual refund amount with no more than two decimal places and select Refund as the resolution.'; end if;
  if v_issue.refund_confirmed_at is not null then raise exception 'This refund has already been recorded.'; end if;
  if exists(select 1 from public.payments p where p.order_id=v_order_id and p.status in ('paid','partially_refunded','refunded') and p.currency<>v_order.currency) then raise exception 'Payment currency does not match the order currency. Refund confirmation is blocked for manual review.'; end if;
  select coalesce(sum(p.amount),0)::numeric(12,2) into v_paid from public.payments p where p.order_id=v_order_id and p.status in ('paid','partially_refunded','refunded') and p.currency=v_order.currency;
  if v_paid<=0 then raise exception 'No successfully recorded payment exists for this order. Refund cannot be confirmed.'; end if;
  select coalesce(sum(r.amount),0)::numeric(12,2) into v_refunded from public.order_refunds r where r.order_id=v_order_id;
  v_remaining:=v_paid-v_refunded;
  if p_refund_amount>v_remaining then raise exception 'Refund exceeds remaining refundable balance. Paid: %, refunded: %, remaining: %, requested: % %.',v_paid,v_refunded,greatest(v_remaining,0),p_refund_amount,v_order.currency; end if;
  insert into public.order_refunds(order_id,source_type,source_id,amount,currency,reference,recorded_by) values(v_order_id,'shipment_issue',p_issue_id,p_refund_amount,v_order.currency,nullif(trim(coalesce(p_refund_reference,'')),''),auth.uid());
 end if;
 if p_status='resolved' and p_resolution_action='refund' and v_issue.refund_confirmed_at is null and not p_confirm_refund then raise exception 'Record the actual refund before resolving this refund case.'; end if;
 if p_status='resolved' and p_resolution_action='reship' and v_issue.replacement_shipment_id is null then raise exception 'Create the replacement shipment before resolving this reshipment case.'; end if;
 update public.shipment_issue_cases set status=p_status,resolution_action=p_resolution_action,resolution_notes=nullif(left(trim(coalesce(p_resolution_notes,'')),3000),''),refund_amount=case when p_confirm_refund then p_refund_amount else refund_amount end,refund_reference=case when p_confirm_refund then nullif(left(trim(coalesce(p_refund_reference,'')),200),'') else refund_reference end,refund_confirmed_at=case when p_confirm_refund then now() else refund_confirmed_at end,updated_by=auth.uid(),updated_at=now() where id=p_issue_id;
 if p_confirm_refund then
  v_new_status:=case when v_refunded+p_refund_amount>=v_paid then 'refunded'::public.order_status else 'partially_refunded'::public.order_status end;
  if v_order.status<>v_new_status then
   update public.orders set status=v_new_status,updated_at=now() where id=v_order_id;
   insert into public.order_status_history(order_id,old_status,new_status,note,changed_by) values(v_order_id,v_order.status,v_new_status,'Refund confirmed',auth.uid());
  end if;
  insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,new_values)
  values(auth.uid(),'order_refund.confirmed','order',v_order_id,jsonb_build_object('source_type','shipment_issue','source_id',p_issue_id,'amount',p_refund_amount,'currency',v_order.currency,'refunded_total',v_refunded+p_refund_amount,'remaining_refundable',v_paid-v_refunded-p_refund_amount));
 end if;
 return jsonb_build_object('issue_id',p_issue_id,'status',p_status,'refund_confirmed',p_confirm_refund,'remaining_refundable',case when p_confirm_refund then v_paid-v_refunded-p_refund_amount else null end);
end;
$function$;
revoke all on function public.admin_update_shipment_issue(uuid,text,text,text,numeric,text,boolean) from public,anon;
grant execute on function public.admin_update_shipment_issue(uuid,text,text,text,numeric,text,boolean) to authenticated;