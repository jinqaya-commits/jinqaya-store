-- Secure email-verified guest order status lookup.
create table if not exists public.order_status_email_challenges (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  email text not null,
  code_hash text not null,
  attempts integer not null default 0 check (attempts between 0 and 5),
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists order_status_challenges_order_created_idx
  on public.order_status_email_challenges(order_id, created_at desc);
create index if not exists order_status_challenges_email_created_idx
  on public.order_status_email_challenges(email, created_at desc);
alter table public.order_status_email_challenges enable row level security;
revoke all on public.order_status_email_challenges from public, anon, authenticated;

create table if not exists public.customer_order_status_sessions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists customer_order_status_sessions_expiry_idx
  on public.customer_order_status_sessions(expires_at);
alter table public.customer_order_status_sessions enable row level security;
revoke all on public.customer_order_status_sessions from public, anon, authenticated;

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
       where order_id=v_order.id and email=v_email and created_at>now()-interval '60 seconds') then
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
     and verified_at is null and expires_at>now()
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

create or replace function public.get_customer_order_status(p_token_hash text)
returns jsonb
language sql security definer set search_path=''
as $function$
  select jsonb_build_object(
    'order_number', o.order_number,
    'status', o.status,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'currency', o.currency,
    'subtotal', o.subtotal,
    'shipping_amount', o.shipping_amount,
    'total_amount', o.total_amount,
    'shipping_method', o.shipping_method_name,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_name', oi.product_name,
        'variant_name', oi.variant_name,
        'quantity', oi.quantity
      ) order by oi.created_at)
      from public.order_items oi where oi.order_id=o.id
    ), '[]'::jsonb),
    'shipment', case when sh.id is null then null else jsonb_build_object(
      'status', sh.status,
      'carrier', sh.carrier_name,
      'tracking_number', sh.tracking_number,
      'tracking_url', sh.tracking_url,
      'shipped_at', sh.shipped_at,
      'delivered_at', sh.delivered_at
    ) end
  )
  from public.customer_order_status_sessions s
  join public.orders o on o.id=s.order_id
  left join lateral (
    select x.* from public.shipments x
     where x.order_id=o.id
     order by x.created_at desc limit 1
  ) sh on true
  where s.token_hash=p_token_hash and s.expires_at>now()
  order by s.created_at desc limit 1;
$function$;

revoke all on function public.create_order_status_email_challenge(text,text,text) from public, anon, authenticated;
revoke all on function public.verify_order_status_email_code(text,text,text,text) from public, anon, authenticated;
revoke all on function public.get_customer_order_status(text) from public, anon, authenticated;
grant execute on function public.create_order_status_email_challenge(text,text,text) to service_role;
grant execute on function public.verify_order_status_email_code(text,text,text,text) to service_role;
grant execute on function public.get_customer_order_status(text) to service_role;
