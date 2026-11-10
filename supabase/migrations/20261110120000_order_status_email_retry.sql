-- Allow an immediate retry when the verification email provider confirms delivery failure.
-- Failed attempts remain in hourly rate-limit counts.
alter table public.order_status_email_challenges
  add column if not exists delivery_failed_at timestamptz;

create or replace function public.mark_order_status_email_challenge_delivery_failed(
  p_order_number text, p_email text
) returns boolean
language plpgsql security definer set search_path=''
as $function$
declare
  v_challenge_id uuid;
begin
  select c.id into v_challenge_id
    from public.order_status_email_challenges c
    join public.orders o on o.id=c.order_id
   where lower(o.order_number)=lower(trim(p_order_number))
     and c.email=lower(trim(p_email))
     and c.verified_at is null
     and c.delivery_failed_at is null
     and c.expires_at>now()
   order by c.created_at desc
   limit 1
   for update of c;

  if not found then return false; end if;

  update public.order_status_email_challenges
     set delivery_failed_at=now()
   where id=v_challenge_id;

  return true;
end;
$function$;

-- A failed delivery does not consume the 60-second resend cooldown.
-- It still counts toward the hourly order/email caps.
revoke all on function public.mark_order_status_email_challenge_delivery_failed(text,text) from public, anon, authenticated;
grant execute on function public.mark_order_status_email_challenge_delivery_failed(text,text) to service_role;

create or replace function public.create_order_status_email_challenge(
  p_order_number text, p_email text, p_code text
) returns boolean
language plpgsql security definer set search_path=''
as $function$
declare
  v_order public.orders%rowtype;
  v_email text := lower(trim(p_email));
begin
  delete from public.customer_order_status_sessions where expires_at < now()-interval '1 day';
  delete from public.order_status_email_challenges where created_at < now()-interval '7 days';
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_email, 41));
  select * into v_order
    from public.orders
   where lower(order_number)=lower(trim(p_order_number))
     and lower(customer_email)=v_email
   limit 1 for update;
  if not found then return false; end if;

  if (select count(*) from public.order_status_email_challenges
       where order_id=v_order.id and created_at>now()-interval '1 hour') >= 5
     or (select count(*) from public.order_status_email_challenges
       where email=v_email and created_at>now()-interval '1 hour') >= 8
     or exists(select 1 from public.order_status_email_challenges
       where order_id=v_order.id and email=v_email
         and delivery_failed_at is null
         and created_at>now()-interval '60 seconds') then
    return false;
  end if;

  insert into public.order_status_email_challenges(order_id,email,code_hash,expires_at)
  values(v_order.id,v_email,extensions.crypt(p_code,extensions.gen_salt('bf')),now()+interval '10 minutes');
  return true;
end;
$function$;

create or replace function public.verify_order_status_email_code(
  p_order_number text, p_email text, p_code text, p_token_hash text
) returns boolean
language plpgsql security definer set search_path=''
as $function$
declare
  v_order public.orders%rowtype;
  v_challenge public.order_status_email_challenges%rowtype;
begin
  select * into v_order from public.orders
   where lower(order_number)=lower(trim(p_order_number))
     and lower(customer_email)=lower(trim(p_email))
   limit 1;
  if not found then return false; end if;

  select * into v_challenge from public.order_status_email_challenges
   where order_id=v_order.id and email=lower(trim(p_email))
     and verified_at is null and delivery_failed_at is null and expires_at>now()
   order by created_at desc limit 1 for update;
  if not found or v_challenge.attempts>=5 then return false; end if;

  if v_challenge.code_hash<>extensions.crypt(p_code,v_challenge.code_hash) then
    update public.order_status_email_challenges
       set attempts=attempts+1 where id=v_challenge.id;
    return false;
  end if;

  update public.order_status_email_challenges set verified_at=now() where id=v_challenge.id;
  insert into public.customer_order_status_sessions(order_id,email,token_hash,expires_at)
  values(v_order.id,lower(trim(p_email)),p_token_hash,now()+interval '20 minutes');
  return true;
end;
$function$;
