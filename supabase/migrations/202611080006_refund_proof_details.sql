alter table public.order_refunds
 add column if not exists refund_method text,
 add column if not exists transaction_number text;

alter table public.order_refunds drop constraint if exists order_refunds_method_check;
alter table public.order_refunds add constraint order_refunds_method_check
 check (refund_method is not null and refund_method in ('bank_transfer','card','paypal','cash','other'));
alter table public.order_refunds drop constraint if exists order_refunds_transaction_number_length;
alter table public.order_refunds add constraint order_refunds_transaction_number_length
 check (transaction_number is not null and length(trim(transaction_number)) between 1 and 200);

create table if not exists public.order_refund_attachments (
 id uuid primary key default gen_random_uuid(),
 refund_id uuid not null references public.order_refunds(id) on delete restrict,
 order_id uuid not null references public.orders(id) on delete restrict,
 object_key text not null unique,
 file_name text not null check(length(file_name) between 1 and 255),
 content_type text not null check(content_type in ('application/pdf','image/jpeg','image/png','image/webp','image/avif')),
 file_size bigint not null check(file_size>0 and file_size<=10485760),
 uploaded_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 constraint order_refund_attachment_key_prefix check(object_key like ('refund-proofs/'||order_id::text||'/'||refund_id::text||'/%'))
);
create index if not exists order_refund_attachments_refund_id_idx on public.order_refund_attachments(refund_id,created_at);
alter table public.order_refund_attachments enable row level security;
revoke all on public.order_refund_attachments from public,anon,authenticated;
grant select on public.order_refund_attachments to authenticated,service_role;
drop policy if exists "Staff can view refund proof metadata" on public.order_refund_attachments;
create policy "Staff can view refund proof metadata" on public.order_refund_attachments
 for select to authenticated using ((select public.can_manage_catalog()));

create table if not exists public.order_refund_events (
 id uuid primary key default gen_random_uuid(),
 refund_id uuid not null references public.order_refunds(id) on delete restrict,
 order_id uuid not null references public.orders(id) on delete restrict,
 event_type text not null check(event_type in ('refund_confirmed','proof_uploaded','refund_details_updated')),
 description text not null,
 old_values jsonb,
 new_values jsonb,
 actor_user_id uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
create index if not exists order_refund_events_refund_id_idx on public.order_refund_events(refund_id,created_at);
alter table public.order_refund_events enable row level security;
revoke all on public.order_refund_events from public,anon,authenticated;
grant select on public.order_refund_events to authenticated,service_role;
drop policy if exists "Staff can view refund events" on public.order_refund_events;
create policy "Staff can view refund events" on public.order_refund_events
 for select to authenticated using ((select public.can_manage_catalog()));

create or replace function public.audit_order_refund_ledger()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
 if tg_table_name='order_refunds' then
  if tg_op='INSERT' then
   insert into public.order_refund_events(refund_id,order_id,event_type,description,new_values,actor_user_id)
   values(new.id,new.order_id,'refund_confirmed','Actual refund recorded in the order refund ledger.',
     jsonb_build_object('amount',new.amount,'currency',new.currency,'refund_method',new.refund_method,
       'transaction_number',new.transaction_number,'reference',new.reference,'recorded_by',new.recorded_by),new.recorded_by);
  elsif tg_op='UPDATE' then
   insert into public.order_refund_events(refund_id,order_id,event_type,description,old_values,new_values,actor_user_id)
   values(new.id,new.order_id,'refund_details_updated','Refund details updated.',
     jsonb_build_object('refund_method',old.refund_method,'transaction_number',old.transaction_number,'reference',old.reference),
     jsonb_build_object('refund_method',new.refund_method,'transaction_number',new.transaction_number,'reference',new.reference),auth.uid());
  end if;
 elsif tg_table_name='order_refund_attachments' and tg_op='INSERT' then
  insert into public.order_refund_events(refund_id,order_id,event_type,description,new_values,actor_user_id)
  values(new.refund_id,new.order_id,'proof_uploaded','Refund proof file uploaded.',
    jsonb_build_object('attachment_id',new.id,'file_name',new.file_name,'content_type',new.content_type,
      'file_size',new.file_size,'object_key',new.object_key),new.uploaded_by);
 end if;
 return new;
end;
$function$;
revoke all on function public.audit_order_refund_ledger() from public,anon,authenticated;
drop trigger if exists audit_order_refund_ledger_insert_update on public.order_refunds;
create trigger audit_order_refund_ledger_insert_update after insert or update on public.order_refunds
for each row execute function public.audit_order_refund_ledger();
drop trigger if exists audit_order_refund_proof_upload on public.order_refund_attachments;
create trigger audit_order_refund_proof_upload after insert on public.order_refund_attachments
for each row execute function public.audit_order_refund_ledger();

do $$
declare v_def text; v_old text; v_new text;
begin
 if to_regprocedure('public.admin_confirm_after_sales_refund(uuid,numeric,text)') is not null then
  select pg_get_functiondef('public.admin_confirm_after_sales_refund(uuid,numeric,text)'::regprocedure) into v_def;
  v_old:='CREATE OR REPLACE FUNCTION public.admin_confirm_after_sales_refund(p_case_id uuid, p_refund_amount numeric, p_refund_reference text DEFAULT NULL::text)';
  v_new:='CREATE OR REPLACE FUNCTION public.admin_confirm_after_sales_refund(p_case_id uuid, p_refund_amount numeric, p_refund_reference text DEFAULT NULL::text, p_refund_method text DEFAULT NULL::text, p_transaction_number text DEFAULT NULL::text)';
  if position(v_old in v_def)=0 then raise exception 'After-sales refund function signature was not found.'; end if;
  v_def:=replace(v_def,v_old,v_new);
  v_def:=replace(v_def,
   ' if p_case_id is null or p_refund_amount is null or p_refund_amount<=0',
   ' if p_refund_method is null or p_refund_method not in (''bank_transfer'',''card'',''paypal'',''cash'',''other'') or length(trim(coalesce(p_transaction_number,'''')))<1 or length(p_transaction_number)>200 then raise exception ''Select the actual refund method and enter its transaction or receipt number.''; end if;'||chr(10)||
   ' if p_case_id is null or p_refund_amount is null or p_refund_amount<=0');
  v_old:='insert into public.order_refunds(order_id,source_type,source_id,amount,currency,reference,recorded_by)'||chr(10)||
   ' values(v_order_id,''after_sales_case'',p_case_id,p_refund_amount,v_order.currency,nullif(trim(coalesce(p_refund_reference,'''')),''''),auth.uid());';
  v_new:='insert into public.order_refunds(order_id,source_type,source_id,amount,currency,reference,refund_method,transaction_number,recorded_by)'||chr(10)||
   ' values(v_order_id,''after_sales_case'',p_case_id,p_refund_amount,v_order.currency,nullif(trim(coalesce(p_refund_reference,'''')),''''),p_refund_method,p_transaction_number,auth.uid());';
  if position(v_old in v_def)=0 then raise exception 'After-sales refund ledger insert was not found.'; end if;
  v_def:=replace(v_def,v_old,v_new);
  v_def:=replace(v_def,'''order_status'',v_new_status','''order_status'',v_order.status');
  execute v_def;
 elsif to_regprocedure('public.admin_confirm_after_sales_refund(uuid,numeric,text,text,text)') is null then
  raise exception 'After-sales refund function is missing.';
 end if;

 if to_regprocedure('public.admin_update_shipment_issue(uuid,text,text,text,numeric,text,boolean)') is not null then
  select pg_get_functiondef('public.admin_update_shipment_issue(uuid,text,text,text,numeric,text,boolean)'::regprocedure) into v_def;
  v_old:='CREATE OR REPLACE FUNCTION public.admin_update_shipment_issue(p_issue_id uuid, p_status text, p_resolution_action text, p_resolution_notes text, p_refund_amount numeric DEFAULT NULL::numeric, p_refund_reference text DEFAULT NULL::text, p_confirm_refund boolean DEFAULT false)';
  v_new:='CREATE OR REPLACE FUNCTION public.admin_update_shipment_issue(p_issue_id uuid, p_status text, p_resolution_action text, p_resolution_notes text, p_refund_amount numeric DEFAULT NULL::numeric, p_refund_reference text DEFAULT NULL::text, p_confirm_refund boolean DEFAULT false, p_refund_method text DEFAULT NULL::text, p_transaction_number text DEFAULT NULL::text)';
  if position(v_old in v_def)=0 then raise exception 'Shipment issue refund function signature was not found.'; end if;
  v_def:=replace(v_def,v_old,v_new);
  v_old:=' if p_confirm_refund then'||chr(10)||
   '  if p_resolution_action is distinct from ''refund'' or p_refund_amount is null';
  v_new:=' if p_confirm_refund then'||chr(10)||
   '  if p_refund_method is null or p_refund_method not in (''bank_transfer'',''card'',''paypal'',''cash'',''other'') or length(trim(coalesce(p_transaction_number,'''')))<1 or length(p_transaction_number)>200 then raise exception ''Select the actual refund method and enter its transaction or receipt number.''; end if;'||chr(10)||
   '  if p_resolution_action is distinct from ''refund'' or p_refund_amount is null';
  if position(v_old in v_def)=0 then raise exception 'Shipment issue refund validation block was not found.'; end if;
  v_def:=replace(v_def,v_old,v_new);
  v_old:='  insert into public.order_refunds(order_id,source_type,source_id,amount,currency,reference,recorded_by) values(v_order_id,''shipment_issue'',p_issue_id,p_refund_amount,v_order.currency,nullif(trim(coalesce(p_refund_reference,'''')),''''),auth.uid());';
  v_new:='  insert into public.order_refunds(order_id,source_type,source_id,amount,currency,reference,refund_method,transaction_number,recorded_by) values(v_order_id,''shipment_issue'',p_issue_id,p_refund_amount,v_order.currency,nullif(trim(coalesce(p_refund_reference,'''')),''''),p_refund_method,p_transaction_number,auth.uid());';
  if position(v_old in v_def)=0 then raise exception 'Shipment issue refund ledger insert was not found.'; end if;
  v_def:=replace(v_def,v_old,v_new);
  execute v_def;
 elsif to_regprocedure('public.admin_update_shipment_issue(uuid,text,text,text,numeric,text,boolean,text,text)') is null then
  raise exception 'Shipment issue refund function is missing.';
 end if;
end $$;

drop function if exists public.admin_confirm_after_sales_refund(uuid,numeric,text);
drop function if exists public.admin_update_shipment_issue(uuid,text,text,text,numeric,text,boolean);
revoke all on function public.admin_confirm_after_sales_refund(uuid,numeric,text,text,text) from public,anon;
revoke all on function public.admin_update_shipment_issue(uuid,text,text,text,numeric,text,boolean,text,text) from public,anon;
grant execute on function public.admin_confirm_after_sales_refund(uuid,numeric,text,text,text) to authenticated;
grant execute on function public.admin_update_shipment_issue(uuid,text,text,text,numeric,text,boolean,text,text) to authenticated;
