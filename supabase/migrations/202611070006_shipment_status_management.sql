-- Shipment status workflow and immutable operational history.
create table if not exists public.shipment_status_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  old_status public.shipment_status,
  new_status public.shipment_status not null,
  note text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists shipment_status_events_shipment_created_idx
  on public.shipment_status_events(shipment_id, created_at desc);
alter table public.shipment_status_events enable row level security;
revoke all on public.shipment_status_events from public, anon;
grant select on public.shipment_status_events to authenticated;
drop policy if exists "Staff can view shipment status events" on public.shipment_status_events;
create policy "Staff can view shipment status events"
  on public.shipment_status_events for select to authenticated
  using (public.can_manage_catalog());

create or replace function public.log_shipment_status_event()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare v_note text;
begin
  if tg_op = 'INSERT' then
    insert into public.shipment_status_events(shipment_id, old_status, new_status, note, changed_by)
    values(new.id, null, new.status, 'Shipment created', auth.uid());
    return new;
  end if;
  if new.status is distinct from old.status then
    v_note := nullif(left(coalesce(current_setting('app.shipment_status_note', true), ''), 500), '');
    insert into public.shipment_status_events(shipment_id, old_status, new_status, note, changed_by)
    values(new.id, old.status, new.status, v_note, auth.uid());
  end if;
  return new;
end;
$function$;
drop trigger if exists shipments_log_status_insert on public.shipments;
create trigger shipments_log_status_insert after insert on public.shipments
for each row execute function public.log_shipment_status_event();
drop trigger if exists shipments_log_status_update on public.shipments;
create trigger shipments_log_status_update after update of status on public.shipments
for each row execute function public.log_shipment_status_event();

create or replace function public.admin_update_shipment_status(
  p_shipment_id uuid, p_new_status public.shipment_status, p_note text default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare v_shipment public.shipments%rowtype; v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not public.can_manage_catalog() then raise exception 'You do not have permission to manage shipments.'; end if;
  if p_shipment_id is null or p_new_status is null then raise exception 'Shipment and new status are required.'; end if;
  if length(coalesce(p_note, '')) > 500 then raise exception 'Shipment note must be 500 characters or fewer.'; end if;
  select * into v_shipment from public.shipments where id = p_shipment_id for update;
  if not found then raise exception 'Shipment not found.'; end if;
  if v_shipment.status = p_new_status then raise exception 'Shipment already has this status.'; end if;
  if not (
    (v_shipment.status = 'pending' and p_new_status in ('label_created','shipped','cancelled')) or
    (v_shipment.status = 'label_created' and p_new_status in ('shipped','in_transit','exception','cancelled')) or
    (v_shipment.status = 'shipped' and p_new_status in ('in_transit','exception','returned')) or
    (v_shipment.status = 'in_transit' and p_new_status in ('exception','returned')) or
    (v_shipment.status = 'exception' and p_new_status in ('in_transit','returned'))
  ) then raise exception 'This shipment status transition is not allowed.'; end if;
  perform pg_catalog.set_config('app.shipment_status_note', coalesce(v_note, ''), true);
  update public.shipments set status = p_new_status, updated_at = now() where id = p_shipment_id;
  return jsonb_build_object('shipment_id', p_shipment_id, 'status', p_new_status);
end;
$function$;
revoke all on function public.admin_update_shipment_status(uuid, public.shipment_status, text) from public, anon;
grant execute on function public.admin_update_shipment_status(uuid, public.shipment_status, text) to authenticated;
revoke all on function public.log_shipment_status_event() from public, anon, authenticated;
