create table if not exists public.shipment_issue_cases (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  issue_type text not null check (issue_type in ('exception','returned')),
  reason text not null check (char_length(trim(reason)) between 3 and 3000),
  status text not null default 'open' check (status in ('open','in_progress','resolved')),
  resolution_action text check (resolution_action in ('awaiting_carrier','reship','refund','other')),
  resolution_notes text,
  refund_amount numeric(12,2),
  refund_reference text,
  refund_confirmed_at timestamptz,
  replacement_shipment_id uuid references public.shipments(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipment_issue_refund_positive check (refund_amount is null or refund_amount > 0)
);
create index if not exists shipment_issue_cases_order_created_idx on public.shipment_issue_cases(order_id, created_at desc);
create index if not exists shipment_issue_cases_shipment_created_idx on public.shipment_issue_cases(shipment_id, created_at desc);
create unique index if not exists shipment_issue_one_open_per_shipment_idx on public.shipment_issue_cases(shipment_id) where status <> 'resolved';
alter table public.shipment_issue_cases enable row level security;
revoke all on public.shipment_issue_cases from public, anon;
grant select on public.shipment_issue_cases to authenticated;
drop policy if exists "Staff can view shipment issue cases" on public.shipment_issue_cases;
create policy "Staff can view shipment issue cases" on public.shipment_issue_cases for select to authenticated using (public.can_manage_catalog());

create or replace function public.admin_create_shipment_issue(p_shipment_id uuid, p_issue_type text, p_reason text)
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare v_shipment public.shipments%rowtype; v_id uuid;
begin
 if not public.can_manage_catalog() then raise exception 'You do not have permission to manage shipment issues.'; end if;
 if p_shipment_id is null or p_issue_type is null or p_issue_type not in ('exception','returned') or char_length(trim(coalesce(p_reason,''))) not between 3 and 3000 then raise exception 'Enter a valid issue type and reason.'; end if;
 select * into v_shipment from public.shipments where id=p_shipment_id for update;
 if not found then raise exception 'Shipment not found.'; end if;
 if v_shipment.status <> p_issue_type::public.shipment_status then raise exception 'The shipment status must match the issue type before recording this issue.'; end if;
 insert into public.shipment_issue_cases(shipment_id,order_id,issue_type,reason,created_by,updated_by)
 values(v_shipment.id,v_shipment.order_id,p_issue_type,left(trim(p_reason),3000),auth.uid(),auth.uid()) returning id into v_id;
 return v_id;
end;
$function$;

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

create or replace function public.admin_create_replacement_shipment(p_issue_id uuid,p_carrier_name text,p_tracking_number text,p_tracking_url text default null)
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare v_issue public.shipment_issue_cases%rowtype; v_old public.shipments%rowtype; v_new_id uuid;
begin
 if not public.can_manage_catalog() then raise exception 'You do not have permission to create replacement shipments.'; end if;
 select * into v_issue from public.shipment_issue_cases where id=p_issue_id for update;
 if not found then raise exception 'Shipment issue not found.'; end if;
 if v_issue.resolution_action <> 'reship' then raise exception 'Set the resolution to Reship before creating a replacement shipment.'; end if;
 if v_issue.replacement_shipment_id is not null then raise exception 'A replacement shipment already exists.'; end if;
 select * into v_old from public.shipments where id=v_issue.shipment_id for update;
 if not found then raise exception 'Original shipment not found.'; end if;
 if length(trim(coalesce(p_carrier_name,'')))<2 or length(trim(coalesce(p_tracking_number,'')))<3 or length(p_carrier_name)>100 or length(p_tracking_number)>150 then raise exception 'Enter a valid carrier and tracking number.'; end if;
 if p_tracking_url is not null and p_tracking_url<>'' and p_tracking_url !~ '^https?://' then raise exception 'Tracking URL must start with https:// or http://.'; end if;
 insert into public.shipments(order_id,status,carrier_name,tracking_number,tracking_url,shipping_cost,currency,shipped_at,shipped_by,notes)
 values(v_old.order_id,'shipped',left(trim(p_carrier_name),100),left(trim(p_tracking_number),150),nullif(trim(p_tracking_url),''),0,v_old.currency,now(),auth.uid(),'Replacement for shipment '||v_old.id::text)
 returning id into v_new_id;
 insert into public.shipment_items(shipment_id,order_item_id,quantity) select v_new_id,order_item_id,quantity from public.shipment_items where shipment_id=v_old.id;
 if not found then raise exception 'Original shipment has no shipment items; replacement was not created.'; end if;
 update public.shipment_issue_cases set replacement_shipment_id=v_new_id,status='in_progress',updated_by=auth.uid(),updated_at=now() where id=p_issue_id;
 return v_new_id;
end;
$function$;
revoke all on function public.admin_create_shipment_issue(uuid,text,text) from public,anon;
revoke all on function public.admin_update_shipment_issue(uuid,text,text,text,numeric,text,boolean) from public,anon;
revoke all on function public.admin_create_replacement_shipment(uuid,text,text,text) from public,anon;
grant execute on function public.admin_create_shipment_issue(uuid,text,text) to authenticated;
grant execute on function public.admin_update_shipment_issue(uuid,text,text,text,numeric,text,boolean) to authenticated;
grant execute on function public.admin_create_replacement_shipment(uuid,text,text,text) to authenticated;
