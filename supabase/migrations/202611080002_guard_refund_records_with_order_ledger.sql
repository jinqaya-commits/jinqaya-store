create or replace function public.guard_order_refund_ledger()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
 if tg_table_name='after_sales_cases' then
  if old.refund_status='confirmed' and
     (new.refund_status,new.refund_amount,new.refund_reference,new.refund_confirmed_at)
       is distinct from
     (old.refund_status,old.refund_amount,old.refund_reference,old.refund_confirmed_at) then
   raise exception 'A confirmed refund is immutable. Create a separate adjustment workflow if needed.';
  end if;
  if new.refund_status='confirmed' then
   if not exists(
    select 1 from public.order_refunds r join public.orders o on o.id=r.order_id
    where r.order_id=new.order_id and r.source_type='after_sales_case' and r.source_id=new.id
      and r.amount=new.refund_amount and r.currency=o.currency
      and r.reference is not distinct from new.refund_reference
   ) then raise exception 'Refund confirmation must be recorded through the order refund ledger.'; end if;
  elsif new.refund_confirmed_at is not null then
   raise exception 'A non-confirmed refund cannot have a confirmation timestamp.';
  end if;
 elsif tg_table_name='shipment_issue_cases' then
  if old.refund_confirmed_at is not null and
     (new.refund_amount,new.refund_reference,new.refund_confirmed_at)
       is distinct from
     (old.refund_amount,old.refund_reference,old.refund_confirmed_at) then
   raise exception 'A confirmed refund is immutable. Create a separate adjustment workflow if needed.';
  end if;
  if new.refund_confirmed_at is not null then
   if not exists(
    select 1 from public.order_refunds r join public.orders o on o.id=r.order_id
    where r.order_id=new.order_id and r.source_type='shipment_issue' and r.source_id=new.id
      and r.amount=new.refund_amount and r.currency=o.currency
      and r.reference is not distinct from new.refund_reference
   ) then raise exception 'Refund confirmation must be recorded through the order refund ledger.'; end if;
  end if;
 end if;
 return new;
end;
$function$;
revoke all on function public.guard_order_refund_ledger() from public,anon,authenticated;

drop trigger if exists guard_after_sales_refund_ledger on public.after_sales_cases;
create trigger guard_after_sales_refund_ledger before update on public.after_sales_cases
for each row execute function public.guard_order_refund_ledger();

drop trigger if exists guard_shipment_issue_refund_ledger on public.shipment_issue_cases;
create trigger guard_shipment_issue_refund_ledger before update on public.shipment_issue_cases
for each row execute function public.guard_order_refund_ledger();

do $$
declare v_def text;
begin
 select pg_get_functiondef('public.admin_update_shipment_issue(uuid,text,text,text,numeric,text,boolean)'::regprocedure) into v_def;
 if position('p_resolution_action is distinct from ''refund''' in v_def)=0 then
  v_def:=replace(v_def,'p_resolution_action<>''refund'' or','p_resolution_action is distinct from ''refund'' or');
  if position('p_resolution_action is distinct from ''refund''' in v_def)=0 then
   raise exception 'Could not harden shipment refund resolution validation.';
  end if;
  execute v_def;
 end if;
end $$;