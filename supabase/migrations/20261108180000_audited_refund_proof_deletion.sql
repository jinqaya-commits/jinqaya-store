alter table public.order_refund_attachments
 add column if not exists deletion_requested_at timestamptz,
 add column if not exists deleted_at timestamptz,
 add column if not exists deleted_by uuid references auth.users(id) on delete set null;

alter table public.order_refund_events
 drop constraint if exists order_refund_events_event_type_check;
alter table public.order_refund_events
 add constraint order_refund_events_event_type_check
 check(event_type in ('refund_confirmed','proof_uploaded','refund_details_updated','proof_deletion_requested','proof_deleted'));

create or replace function public.request_order_refund_attachment_deletion(
 p_order_id uuid,p_refund_id uuid,p_attachment_id uuid,p_actor_user_id uuid
) returns text
language plpgsql security definer set search_path=''
as $function$
declare v_key text; v_deleted timestamptz; v_requested timestamptz;
begin
 select object_key,deleted_at,deletion_requested_at into v_key,v_deleted,v_requested
 from public.order_refund_attachments
 where id=p_attachment_id and order_id=p_order_id and refund_id=p_refund_id
 for update;
 if not found then raise exception 'Refund proof not found.'; end if;
 if v_deleted is not null then return null; end if;
 if v_requested is null then
  update public.order_refund_attachments set deletion_requested_at=now()
  where id=p_attachment_id;
  insert into public.order_refund_events(refund_id,order_id,event_type,description,old_values,new_values,actor_user_id)
  values(p_refund_id,p_order_id,'proof_deletion_requested','Refund proof deletion requested.',
   jsonb_build_object('attachment_id',p_attachment_id,'object_key',v_key),
   jsonb_build_object('deletion_requested_at',now()),p_actor_user_id);
 end if;
 return v_key;
end;
$function$;
revoke all on function public.request_order_refund_attachment_deletion(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.request_order_refund_attachment_deletion(uuid,uuid,uuid,uuid) to service_role;

create or replace function public.complete_order_refund_attachment_deletion(
 p_attachment_id uuid,p_object_key text,p_actor_user_id uuid
) returns boolean
language plpgsql security definer set search_path=''
as $function$
declare v_row public.order_refund_attachments%rowtype;
begin
 select * into v_row from public.order_refund_attachments
 where id=p_attachment_id and object_key=p_object_key
 for update;
 if not found then return false; end if;
 if v_row.deleted_at is not null then return true; end if;
 if v_row.deletion_requested_at is null then raise exception 'Deletion was not requested.'; end if;
 update public.order_refund_attachments
 set deleted_at=now(),deleted_by=p_actor_user_id
 where id=p_attachment_id;
 insert into public.order_refund_events(refund_id,order_id,event_type,description,old_values,new_values,actor_user_id)
 values(v_row.refund_id,v_row.order_id,'proof_deleted','Refund proof file deleted.',
  jsonb_build_object('attachment_id',p_attachment_id,'object_key',p_object_key),
  jsonb_build_object('deleted_at',now()),p_actor_user_id);
 return true;
end;
$function$;
revoke all on function public.complete_order_refund_attachment_deletion(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.complete_order_refund_attachment_deletion(uuid,text,uuid) to service_role;

create or replace function public.list_pending_refund_proof_deletions(p_limit integer default 100)
returns table(attachment_id uuid,object_key text)
language sql security definer set search_path=''
as $function$
 select a.id,a.object_key
 from public.order_refund_attachments a
 where a.deletion_requested_at is not null and a.deleted_at is null
 order by a.deletion_requested_at
 limit greatest(1,least(coalesce(p_limit,100),500));
$function$;
revoke all on function public.list_pending_refund_proof_deletions(integer) from public,anon,authenticated;
grant execute on function public.list_pending_refund_proof_deletions(integer) to service_role;

create index if not exists order_refund_attachments_pending_deletion_idx
 on public.order_refund_attachments(deletion_requested_at)
 where deletion_requested_at is not null and deleted_at is null;
