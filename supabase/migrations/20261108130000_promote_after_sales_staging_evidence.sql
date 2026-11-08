-- Separate client-writable staging objects from immutable case evidence.
-- The customer only receives a short-lived PUT URL for after-sales-staging/.
-- Validated objects are copied server-side into after-sales/ before case creation.

alter table public.after_sales_cases
 add column if not exists submission_upload_keys text[] not null default '{}'::text[];

alter table public.after_sales_upload_tickets
 add column if not exists promoted_object_key text;
alter table public.after_sales_upload_tickets
 add column if not exists promotion_lease_until timestamptz;

-- Atomically lease every upload ticket in one transaction. A request either
-- owns the complete evidence set or none of it; expired leases are reclaimable.
create or replace function public.claim_after_sales_evidence_promotions(
 p_order_id uuid,
 p_token_hash text,
 p_upload_keys text[],
 p_candidate_final_keys text[]
)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
 v_expected integer;
 v_available integer;
 v_updated integer;
 v_result jsonb;
begin
 v_expected:=coalesce(array_length(p_upload_keys,1),0);
 if v_expected<1 or v_expected>5
    or array_length(p_candidate_final_keys,1)<>v_expected
    or v_expected<>(select count(distinct k) from unnest(p_upload_keys) as u(k))
    or v_expected<>(select count(distinct k) from unnest(p_candidate_final_keys) as u(k))
    or exists(select 1 from unnest(p_upload_keys) as u(k)
              where k not like 'after-sales-staging/'||p_order_id::text||'/%' or length(k)>500)
    or exists(select 1 from unnest(p_candidate_final_keys) as u(k)
              where k not like 'after-sales/'||p_order_id::text||'/%' or length(k)>500) then
  return jsonb_build_object('acquired',false,'reason','invalid');
 end if;

 select count(*) into v_available
 from public.after_sales_upload_tickets t
 where t.order_id=p_order_id and t.token_hash=p_token_hash
   and t.object_key=any(p_upload_keys)
   and t.expires_at>now() and t.consumed_at is null
   and (t.promotion_lease_until is null or t.promotion_lease_until<=now());
 if v_available<>v_expected then
  return jsonb_build_object('acquired',false,'reason','busy_or_expired');
 end if;

 update public.after_sales_upload_tickets t
 set promoted_object_key=coalesce(t.promoted_object_key,pair.final_key),
     promotion_lease_until=now()+interval '90 seconds'
 from unnest(p_upload_keys,p_candidate_final_keys) as pair(upload_key,final_key)
 where t.order_id=p_order_id and t.token_hash=p_token_hash
   and t.object_key=pair.upload_key
   and t.expires_at>now() and t.consumed_at is null
   and (t.promotion_lease_until is null or t.promotion_lease_until<=now())
   and pair.final_key like 'after-sales/'||p_order_id::text||'/%'
   and length(pair.final_key)<=500;
 get diagnostics v_updated=row_count;
 if v_updated<>v_expected then
  raise exception 'Unable to acquire all evidence promotion leases.';
 end if;

 select jsonb_build_object(
  'acquired',true,
  'final_keys',jsonb_agg(t.promoted_object_key order by pair.ordinality)
 ) into v_result
 from unnest(p_upload_keys,p_candidate_final_keys) with ordinality as pair(upload_key,final_key,ordinality)
 join public.after_sales_upload_tickets t
   on t.order_id=p_order_id and t.token_hash=p_token_hash and t.object_key=pair.upload_key;
 return v_result;
end; $function$;

revoke all on function public.claim_after_sales_evidence_promotions(uuid,text,text[],text[]) from public,anon,authenticated;
grant execute on function public.claim_after_sales_evidence_promotions(uuid,text,text[],text[]) to service_role;

create or replace function public.reserve_after_sales_upload(
 p_order_id uuid,p_token_hash text,p_object_key text,p_content_type text,p_expected_size bigint
)
returns boolean language plpgsql security definer set search_path=''
as $function$
declare v_session public.after_sales_customer_sessions%rowtype;
begin
 select * into v_session from public.after_sales_customer_sessions
 where order_id=p_order_id and token_hash=p_token_hash and expires_at>now()
 order by created_at desc limit 1 for update;
 if not found or p_object_key not like 'after-sales-staging/'||p_order_id::text||'/%'
 or p_content_type not in ('image/jpeg','image/png','image/webp','image/avif','video/mp4','video/quicktime')
 or p_expected_size<=0 or p_expected_size>(case when p_content_type like 'video/%' then 52428800 else 10485760 end) then return false; end if;
 if (select count(*) from public.after_sales_upload_tickets
     where order_id=p_order_id and token_hash=p_token_hash and created_at>now()-interval '1 hour')>=5 then return false; end if;
 insert into public.after_sales_upload_tickets(order_id,token_hash,object_key,content_type,expected_size,expires_at)
 values(p_order_id,p_token_hash,p_object_key,p_content_type,p_expected_size,now()+interval '10 minutes');
 return true;
exception when unique_violation then return false;
end; $function$;

drop function if exists public.submit_customer_after_sales_case(uuid,text,text,text[]);
create or replace function public.submit_customer_after_sales_case(
 p_order_id uuid,
 p_token_hash text,
 p_description text,
 p_upload_keys text[],
 p_final_evidence_keys text[]
)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
 v_session public.after_sales_customer_sessions%rowtype;
 v_order public.orders%rowtype;
 v_case public.after_sales_cases%rowtype;
 v_number text;
 v_upload_keys text[]:=coalesce(p_upload_keys,'{}'::text[]);
 v_final_keys text[]:=coalesce(p_final_evidence_keys,'{}'::text[]);
 v_ticket_count integer;
begin
 select * into v_session
 from public.after_sales_customer_sessions
 where order_id=p_order_id and token_hash=p_token_hash and expires_at>now()
 order by created_at desc limit 1 for update;
 if not found then raise exception 'Verification expired. Please verify your email again.'; end if;

 select * into v_order from public.orders
 where id=p_order_id and lower(customer_email)=lower(v_session.email);
 if not found or v_order.delivered_at is null or v_order.delivered_at<now()-interval '7 days' then
  raise exception 'This order is not eligible for an after-sales request.';
 end if;
 if length(trim(p_description))<10 or length(trim(p_description))>5000 then
  raise exception 'Description must be 10–5000 characters.';
 end if;
 if coalesce(array_length(v_upload_keys,1),0)<1 or coalesce(array_length(v_upload_keys,1),0)>5
    or array_length(v_upload_keys,1)<>array_length(v_final_keys,1) then
  raise exception 'Please attach 1–5 evidence files.';
 end if;
 if array_length(v_upload_keys,1)<>(select count(distinct k) from unnest(v_upload_keys) as u(k))
    or array_length(v_final_keys,1)<>(select count(distinct k) from unnest(v_final_keys) as u(k)) then
  raise exception 'Duplicate evidence references are not allowed.';
 end if;
 if exists(select 1 from unnest(v_upload_keys) as u(k)
           where k not like 'after-sales-staging/'||p_order_id::text||'/%' or length(k)>500)
    or exists(select 1 from unnest(v_final_keys) as u(k)
              where k not like 'after-sales/'||p_order_id::text||'/%' or length(k)>500) then
  raise exception 'Invalid evidence file reference.';
 end if;

 -- Require every staging key to be paired with the exact final key
 -- recorded on its own upload ticket. Do not trust caller-supplied final paths.
 select count(*) into v_ticket_count
 from unnest(v_upload_keys, v_final_keys) as paired(upload_key, final_key)
 where exists (
  select 1 from public.after_sales_upload_tickets t
  where t.order_id=p_order_id and t.token_hash=p_token_hash
    and t.object_key=paired.upload_key
    and t.promoted_object_key=paired.final_key
    and t.expires_at>now() and t.consumed_at is null
 );
 if v_ticket_count<>array_length(v_upload_keys,1) then
  raise exception 'Evidence upload authorization expired. Please upload again.';
 end if;

 v_number:='AS-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
 insert into public.after_sales_cases(
  order_id,customer_id,case_number,customer_description,evidence_urls,submission_upload_keys
 )
 values(v_order.id,v_order.customer_id,v_number,trim(p_description),v_final_keys,v_upload_keys)
 returning * into v_case;

 update public.after_sales_upload_tickets set consumed_at=now(),promotion_lease_until=null
 where order_id=p_order_id and token_hash=p_token_hash
   and object_key=any(v_upload_keys) and consumed_at is null;

 insert into public.after_sales_case_events(case_id,event_type,description,new_values)
 values(v_case.id,'customer_case_submitted',
        'Customer submitted a quality issue request with evidence.',
        jsonb_build_object('case_number',v_number,'evidence_count',array_length(v_final_keys,1)));
 return jsonb_build_object('id',v_case.id,'case_number',v_case.case_number);
end; $function$;

revoke all on function public.reserve_after_sales_upload(uuid,text,text,text,bigint) from public,anon,authenticated;
grant execute on function public.reserve_after_sales_upload(uuid,text,text,text,bigint) to service_role;
revoke all on function public.submit_customer_after_sales_case(uuid,text,text,text[],text[]) from public,anon,authenticated;
grant execute on function public.submit_customer_after_sales_case(uuid,text,text,text[],text[]) to service_role;

-- Staging objects can be deleted after the signed PUT URL and grace period expire,
-- including consumed ticket rows. Final evidence remains protected by evidence_urls.
create or replace function public.list_expired_after_sales_orphan_keys(p_limit integer default 100)
returns table(object_key text)
language sql security definer set search_path=''
as $function$
 with expired_tickets as (
  -- Apply the batch limit to tickets, not individual object keys. This keeps
  -- each staging/final pair together even when a batch boundary is reached.
  select t.object_key, t.promoted_object_key, t.expires_at
  from public.after_sales_upload_tickets t
  where t.expires_at < now() - interval '1 hour'
  order by t.expires_at asc, t.id asc
  limit greatest(1,least(coalesce(p_limit,100),500))
 )
 select candidates.object_key
 from expired_tickets t
 cross join lateral (
  values
   (t.object_key),
   (case
     when t.promoted_object_key is not null
      and not exists(
       select 1 from public.after_sales_cases c
       where t.promoted_object_key=any(c.evidence_urls)
      )
     then t.promoted_object_key
     else null
    end)
 ) as candidates(object_key)
 where candidates.object_key is not null;
$function$;

create or replace function public.delete_after_sales_orphan_ticket_rows(p_object_keys text[])
returns integer language plpgsql security definer set search_path=''
as $function$
declare v_count integer;
begin
 delete from public.after_sales_upload_tickets t
 where t.object_key=any(coalesce(p_object_keys,'{}'::text[]))
 and t.expires_at<now()-interval '1 hour'
 and not exists(select 1 from public.after_sales_cases c where t.object_key=any(c.evidence_urls))
 and (
  t.promoted_object_key is null
  or t.promoted_object_key=any(coalesce(p_object_keys,'{}'::text[]))
  or exists(select 1 from public.after_sales_cases c where t.promoted_object_key=any(c.evidence_urls))
 );
 get diagnostics v_count=row_count;
 return v_count;
end; $function$;

revoke all on function public.list_expired_after_sales_orphan_keys(integer) from public,anon,authenticated;
grant execute on function public.list_expired_after_sales_orphan_keys(integer) to service_role;
revoke all on function public.delete_after_sales_orphan_ticket_rows(text[]) from public,anon,authenticated;
grant execute on function public.delete_after_sales_orphan_ticket_rows(text[]) to service_role;
