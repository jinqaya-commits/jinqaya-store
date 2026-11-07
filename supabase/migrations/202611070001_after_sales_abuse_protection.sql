-- JINQAYA after-sales OTP and evidence-upload abuse controls
create table if not exists public.after_sales_upload_tickets (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete cascade,
 token_hash text not null,
 object_key text not null unique,
 content_type text not null,
 expected_size bigint not null check (expected_size > 0),
 expires_at timestamptz not null,
 consumed_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.after_sales_upload_tickets enable row level security;
revoke all on public.after_sales_upload_tickets from anon, authenticated;

create or replace function public.create_after_sales_email_challenge(p_order_number text,p_email text,p_code text)
returns boolean language plpgsql security definer set search_path=''
as $function$
declare v_order public.orders%rowtype; v_email text:=lower(trim(p_email));
begin
 perform pg_advisory_xact_lock(hashtextextended(v_email,0));
 select * into v_order from public.orders
 where lower(order_number)=lower(trim(p_order_number)) and lower(customer_email)=v_email
 for update;
 if not found or v_order.delivered_at is null or v_order.delivered_at < now()-interval '7 days' then return false; end if;
 if (select count(*) from public.after_sales_email_challenges where order_id=v_order.id and created_at>now()-interval '1 hour')>=5
 or (select count(*) from public.after_sales_email_challenges where email=v_email and created_at>now()-interval '1 hour')>=8
 or exists(select 1 from public.after_sales_email_challenges where order_id=v_order.id and email=v_email and created_at>now()-interval '60 seconds') then return false; end if;
 insert into public.after_sales_email_challenges(order_id,email,code_hash,expires_at)
 values(v_order.id,v_email,extensions.crypt(p_code,extensions.gen_salt('bf')),now()+interval '10 minutes');
 return true;
end; $function$;

create or replace function public.verify_after_sales_email_code(p_order_number text,p_email text,p_code text,p_token_hash text)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_order public.orders%rowtype; v_challenge public.after_sales_email_challenges%rowtype;
begin
 select * into v_order from public.orders where lower(order_number)=lower(trim(p_order_number)) and lower(customer_email)=lower(trim(p_email));
 if not found or v_order.delivered_at is null or v_order.delivered_at<now()-interval '7 days' then return null; end if;
 select * into v_challenge from public.after_sales_email_challenges
 where order_id=v_order.id and email=lower(trim(p_email)) and verified_at is null and expires_at>now()
 order by created_at desc limit 1 for update;
 if not found or v_challenge.attempts>=5 then return null; end if;
 if v_challenge.code_hash<>extensions.crypt(p_code,v_challenge.code_hash) then
   update public.after_sales_email_challenges set attempts=attempts+1 where id=v_challenge.id; return null;
 end if;
 update public.after_sales_email_challenges set verified_at=now() where id=v_challenge.id;
 insert into public.after_sales_customer_sessions(order_id,email,token_hash,expires_at)
 values(v_order.id,lower(trim(p_email)),p_token_hash,now()+interval '30 minutes');
 return v_order.id;
end; $function$;

create or replace function public.reserve_after_sales_upload(p_order_id uuid,p_token_hash text,p_object_key text,p_content_type text,p_expected_size bigint)
returns boolean language plpgsql security definer set search_path=''
as $function$
declare v_session public.after_sales_customer_sessions%rowtype;
begin
 select * into v_session from public.after_sales_customer_sessions
 where order_id=p_order_id and token_hash=p_token_hash and expires_at>now()
 order by created_at desc limit 1 for update;
 if not found or p_object_key not like 'after-sales/'||p_order_id::text||'/%'
 or p_content_type not in ('image/jpeg','image/png','image/webp','image/avif','video/mp4','video/quicktime')
 or p_expected_size<=0 or p_expected_size>(case when p_content_type like 'video/%' then 52428800 else 10485760 end) then return false; end if;
 if (select count(*) from public.after_sales_upload_tickets where order_id=p_order_id and token_hash=p_token_hash and created_at>now()-interval '1 hour')>=5 then return false; end if;
 insert into public.after_sales_upload_tickets(order_id,token_hash,object_key,content_type,expected_size,expires_at)
 values(p_order_id,p_token_hash,p_object_key,p_content_type,p_expected_size,now()+interval '10 minutes');
 return true;
exception when unique_violation then return false;
end; $function$;

create or replace function public.validate_after_sales_upload_ticket(p_order_id uuid,p_token_hash text,p_object_key text,p_content_type text,p_actual_size bigint)
returns boolean language sql security definer set search_path=''
as $function$
 select exists(select 1 from public.after_sales_upload_tickets t
 where t.order_id=p_order_id and t.token_hash=p_token_hash and t.object_key=p_object_key
 and t.content_type=p_content_type and t.expected_size=p_actual_size
 and t.expires_at>now() and t.consumed_at is null);
$function$;

grant execute on function public.reserve_after_sales_upload(uuid,text,text,text,bigint) to anon,authenticated;
grant execute on function public.validate_after_sales_upload_ticket(uuid,text,text,text,bigint) to anon,authenticated;

create or replace function public.consume_after_sales_upload_tickets(p_order_id uuid,p_token_hash text,p_object_keys text[])
returns integer language plpgsql security definer set search_path=''
as $function$
declare v_count integer;
begin
 update public.after_sales_upload_tickets
 set consumed_at=now()
 where order_id=p_order_id and token_hash=p_token_hash and object_key=any(coalesce(p_object_keys,'{}'::text[]))
 and expires_at>now() and consumed_at is null;
 get diagnostics v_count=row_count;
 return v_count;
end; $function$;
grant execute on function public.consume_after_sales_upload_tickets(uuid,text,text[]) to anon,authenticated;
