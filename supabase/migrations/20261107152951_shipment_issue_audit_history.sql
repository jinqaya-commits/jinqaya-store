create table if not exists public.shipment_issue_events (
 id uuid primary key default gen_random_uuid(),
 issue_id uuid not null references public.shipment_issue_cases(id) on delete cascade,
 event_type text not null,
 description text not null,
 old_values jsonb,
 new_values jsonb,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
create index if not exists shipment_issue_events_issue_created_idx on public.shipment_issue_events(issue_id,created_at desc);
alter table public.shipment_issue_events enable row level security;
revoke all on public.shipment_issue_events from public,anon;
grant select on public.shipment_issue_events to authenticated;
drop policy if exists "Staff can view shipment issue events" on public.shipment_issue_events;
create policy "Staff can view shipment issue events" on public.shipment_issue_events for select to authenticated using(public.can_manage_catalog());

create or replace function public.log_shipment_issue_event()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_type text; v_description text;
begin
 if tg_op='INSERT' then
  insert into public.shipment_issue_events(issue_id,event_type,description,new_values,created_by)
  values(new.id,'issue_created','Shipment issue recorded: '||new.issue_type,jsonb_build_object('reason',new.reason,'status',new.status),auth.uid());
  return new;
 end if;
 if row(new.status,new.resolution_action,new.resolution_notes,new.refund_amount,new.refund_reference,new.refund_confirmed_at,new.replacement_shipment_id)
    is distinct from row(old.status,old.resolution_action,old.resolution_notes,old.refund_amount,old.refund_reference,old.refund_confirmed_at,old.replacement_shipment_id) then
  v_type:=case when new.refund_confirmed_at is distinct from old.refund_confirmed_at and new.refund_confirmed_at is not null then 'refund_recorded'
               when new.replacement_shipment_id is distinct from old.replacement_shipment_id then 'replacement_created'
               when new.status is distinct from old.status then 'status_updated' else 'resolution_updated' end;
  v_description:=case v_type when 'refund_recorded' then 'Actual refund recorded' when 'replacement_created' then 'Replacement shipment created' when 'status_updated' then 'Issue status updated' else 'Issue resolution details updated' end;
  insert into public.shipment_issue_events(issue_id,event_type,description,old_values,new_values,created_by)
  values(new.id,v_type,v_description,
    jsonb_build_object('status',old.status,'resolution_action',old.resolution_action,'resolution_notes',old.resolution_notes,'refund_amount',old.refund_amount,'refund_reference',old.refund_reference,'replacement_shipment_id',old.replacement_shipment_id),
    jsonb_build_object('status',new.status,'resolution_action',new.resolution_action,'resolution_notes',new.resolution_notes,'refund_amount',new.refund_amount,'refund_reference',new.refund_reference,'replacement_shipment_id',new.replacement_shipment_id),auth.uid());
 end if;
 return new;
end;
$function$;
drop trigger if exists shipment_issue_events_insert on public.shipment_issue_cases;
create trigger shipment_issue_events_insert after insert on public.shipment_issue_cases for each row execute function public.log_shipment_issue_event();
drop trigger if exists shipment_issue_events_update on public.shipment_issue_cases;
create trigger shipment_issue_events_update after update on public.shipment_issue_cases for each row execute function public.log_shipment_issue_event();
revoke all on function public.log_shipment_issue_event() from public,anon,authenticated;
