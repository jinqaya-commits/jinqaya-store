-- Track every signed refund-proof upload before issuing the URL.
create table if not exists public.order_refund_upload_tickets (
 object_key text primary key,
 order_id uuid not null,
 refund_id uuid not null,
 file_name text not null check(length(file_name) between 1 and 180),
 content_type text not null check(content_type in ('application/pdf','image/jpeg','image/png','image/webp','image/avif')),
 file_size bigint not null check(file_size between 1 and 10485760),
 uploaded_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 consumed_at timestamptz,
 constraint order_refund_upload_ticket_order_refund_fk
  foreign key(refund_id,order_id)
  references public.order_refunds(id,order_id) on delete restrict,
 constraint order_refund_upload_ticket_key_prefix
  check(object_key like ('refund-proofs/'||order_id::text||'/'||refund_id::text||'/%')
   and length(object_key)<=500
   and length(split_part(object_key,'/',4)) between 1 and 120
   and split_part(object_key,'/',5)='')
);
create index if not exists order_refund_upload_tickets_expiry_idx
 on public.order_refund_upload_tickets(expires_at)
 where consumed_at is null;

alter table public.order_refund_upload_tickets enable row level security;
revoke all on public.order_refund_upload_tickets from public,anon,authenticated;
grant all on public.order_refund_upload_tickets to service_role;

create or replace function public.complete_order_refund_proof_upload(
 p_order_id uuid,p_refund_id uuid,p_object_key text,p_file_name text,
 p_content_type text,p_file_size bigint,p_uploaded_by uuid
) returns uuid
language plpgsql security definer set search_path=''
as $function$
declare v_ticket public.order_refund_upload_tickets%rowtype;
 v_attachment_id uuid;
begin
 select * into v_ticket from public.order_refund_upload_tickets
 where object_key=p_object_key and order_id=p_order_id and refund_id=p_refund_id
 for update;
 if not found then raise exception 'Refund proof upload ticket not found.'; end if;

 select id into v_attachment_id from public.order_refund_attachments
 where object_key=p_object_key and order_id=p_order_id and refund_id=p_refund_id;
 if found then
  return v_attachment_id;
 end if;

 if v_ticket.consumed_at is not null or v_ticket.expires_at<=now()
    or v_ticket.file_name<>p_file_name or v_ticket.content_type<>p_content_type
    or v_ticket.file_size<>p_file_size or v_ticket.uploaded_by<>p_uploaded_by then
  raise exception 'Refund proof upload ticket is expired, consumed, or does not match.';
 end if;

 insert into public.order_refund_attachments(
  refund_id,order_id,object_key,file_name,content_type,file_size,uploaded_by
 ) values (
  p_refund_id,p_order_id,p_object_key,p_file_name,p_content_type,p_file_size,p_uploaded_by
 ) returning id into v_attachment_id;

 update public.order_refund_upload_tickets set consumed_at=now()
 where object_key=p_object_key and consumed_at is null;
 return v_attachment_id;
end;
$function$;
revoke all on function public.complete_order_refund_proof_upload(uuid,uuid,text,text,text,bigint,uuid) from public,anon,authenticated;
grant execute on function public.complete_order_refund_proof_upload(uuid,uuid,text,text,text,bigint,uuid) to service_role;

create or replace function public.list_expired_refund_proof_upload_keys(p_limit integer default 100)
returns table(object_key text)
language sql stable security definer set search_path=''
as $function$
 select t.object_key
 from public.order_refund_upload_tickets t
 where t.consumed_at is null
  and t.expires_at<now()-interval '1 hour'
  and not exists(select 1 from public.order_refund_attachments a where a.object_key=t.object_key)
 order by t.expires_at
 limit greatest(1,least(coalesce(p_limit,100),500));
$function$;
revoke all on function public.list_expired_refund_proof_upload_keys(integer) from public,anon,authenticated;
grant execute on function public.list_expired_refund_proof_upload_keys(integer) to service_role;

create or replace function public.delete_expired_refund_proof_upload_tickets(p_object_keys text[])
returns integer
language plpgsql security definer set search_path=''
as $function$
declare v_deleted integer;
begin
 if coalesce(cardinality(p_object_keys),0)=0 then return 0; end if;
 delete from public.order_refund_upload_tickets t
 where t.object_key=any(p_object_keys)
  and t.object_key like 'refund-proofs/%'
  and t.consumed_at is null
  and t.expires_at<now()-interval '1 hour'
  and not exists(select 1 from public.order_refund_attachments a where a.object_key=t.object_key);
 get diagnostics v_deleted=row_count;
 return v_deleted;
end;
$function$;
revoke all on function public.delete_expired_refund_proof_upload_tickets(text[]) from public,anon,authenticated;
grant execute on function public.delete_expired_refund_proof_upload_tickets(text[]) to service_role;
