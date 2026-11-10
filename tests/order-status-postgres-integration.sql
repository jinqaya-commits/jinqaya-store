-- Runs only against the disposable PostgreSQL service in GitHub Actions.
\set ON_ERROR_STOP on

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema extensions;
create extension pgcrypto with schema extensions;

create table public.orders (
  id uuid primary key,
  order_number text not null unique,
  customer_email text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  currency text not null default 'USD',
  subtotal numeric(12,2) not null default 100,
  shipping_amount numeric(12,2) not null default 10,
  total_amount numeric(12,2) not null default 110,
  shipping_method_name text
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  product_name text not null,
  variant_name text,
  quantity integer not null,
  created_at timestamptz not null default now()
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  status text not null,
  carrier_name text,
  tracking_number text,
  tracking_url text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

insert into public.orders (id, order_number, customer_email, status) values
('10000000-0000-4000-8000-000000000001', 'JQ-TEST-1001', 'first@example.test', 'processing'),
('10000000-0000-4000-8000-000000000002', 'JQ-TEST-1002', 'second@example.test', 'shipped'),
('10000000-0000-4000-8000-000000000003', 'JQ-TEST-1003', 'expiry@example.test', 'processing'),
('10000000-0000-4000-8000-000000000004', 'JQ-TEST-1004', 'rate-order@example.test', 'processing'),
('10000000-0000-4000-8000-000000000005', 'JQ-TEST-1005', 'rate-email@example.test', 'processing'),
('10000000-0000-4000-8000-000000000006', 'JQ-TEST-1006', 'retry@example.test', 'processing');

insert into public.orders (id, order_number, customer_email, status)
select
  ('20000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'JQ-RATE-' || n,
  'rate-email@example.test',
  'processing'
from generate_series(1, 9) n;

insert into public.order_items (order_id, product_name, variant_name, quantity)
values
('10000000-0000-4000-8000-000000000001', 'Test Cat Carrier', 'Forest Green', 1),
('10000000-0000-4000-8000-000000000002', 'Test Dog Bed', 'Medium', 2);

\ir ../supabase/migrations/20261109100000_customer_order_status_lookup.sql

do $$
declare
  v_ok boolean;
  v_token text := repeat('b', 64);
  v_result jsonb;
  v_attempt integer;
  v_count integer;
  v_order_id uuid;
  v_order_number text;
begin
  -- Privilege boundary: clients cannot read the backing tables or execute RPCs.
  if not (select relrowsecurity from pg_class where oid = 'public.order_status_email_challenges'::regclass) then
    raise exception 'RLS is not enabled on challenge table';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.customer_order_status_sessions'::regclass) then
    raise exception 'RLS is not enabled on session table';
  end if;
  if has_table_privilege('anon', 'public.order_status_email_challenges', 'SELECT')
     or has_table_privilege('authenticated', 'public.order_status_email_challenges', 'SELECT')
     or has_table_privilege('anon', 'public.customer_order_status_sessions', 'SELECT')
     or has_table_privilege('authenticated', 'public.customer_order_status_sessions', 'SELECT') then
    raise exception 'A client role has direct table access';
  end if;
  if has_function_privilege('anon', 'public.get_customer_order_status(text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.get_customer_order_status(text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.get_customer_order_status(text)', 'EXECUTE') then
    raise exception 'RPC execution grants are incorrect';
  end if;

  -- A valid challenge is created; an immediate duplicate is blocked by cooldown.
  select public.create_order_status_email_challenge('JQ-TEST-1001', 'first@example.test', '123456') into v_ok;
  if v_ok is distinct from true then raise exception 'Could not create a valid challenge'; end if;
  select public.create_order_status_email_challenge('JQ-TEST-1001', 'first@example.test', '123456') into v_ok;
  if v_ok is distinct from false then raise exception '60-second challenge cooldown was not enforced'; end if;

  -- Five wrong attempts are counted; a sixth attempt is refused.
  for v_attempt in 1..5 loop
    select public.verify_order_status_email_code('JQ-TEST-1001', 'first@example.test', '000000', v_token) into v_ok;
    if v_ok is distinct from false then raise exception 'Incorrect OTP was accepted on attempt %', v_attempt; end if;
  end loop;
  select attempts into v_count from public.order_status_email_challenges
   where order_id='10000000-0000-4000-8000-000000000001';
  if v_count <> 5 then raise exception 'Wrong OTP attempts were not capped at five'; end if;
  select public.verify_order_status_email_code('JQ-TEST-1001', 'first@example.test', '123456', v_token) into v_ok;
  if v_ok is distinct from false then raise exception 'OTP was accepted after five failed attempts'; end if;

  -- A second customer's correct code creates a session bound to that customer's order.
  select public.create_order_status_email_challenge('JQ-TEST-1002', 'second@example.test', '654321') into v_ok;
  if v_ok is distinct from true then raise exception 'Could not create second customer challenge'; end if;
  select public.verify_order_status_email_code('JQ-TEST-1002', 'second@example.test', '654321', v_token) into v_ok;
  if v_ok is distinct from true then raise exception 'Correct OTP did not create a session'; end if;
  select public.get_customer_order_status(v_token) into v_result;
  if v_result->>'order_number' <> 'JQ-TEST-1002' then raise exception 'Session returned the wrong order'; end if;
  if v_result ? 'shipping_address' or v_result ? 'customer_phone' or v_result ? 'internal_notes' then
    raise exception 'Private order fields were returned';
  end if;

  -- Expired sessions and expired OTPs are rejected.
  update public.customer_order_status_sessions set expires_at=now()-interval '1 second' where token_hash=v_token;
  if public.get_customer_order_status(v_token) is not null then raise exception 'Expired session was accepted'; end if;

  select public.create_order_status_email_challenge('JQ-TEST-1003', 'expiry@example.test', '777777') into v_ok;
  if v_ok is distinct from true then raise exception 'Could not create expiry challenge'; end if;
  update public.order_status_email_challenges set expires_at=now()-interval '1 second'
   where order_id='10000000-0000-4000-8000-000000000003';
  select public.verify_order_status_email_code('JQ-TEST-1003', 'expiry@example.test', '777777', repeat('c',64)) into v_ok;
  if v_ok is distinct from false then raise exception 'Expired OTP was accepted'; end if;

  -- A provider delivery failure invalidates the code and releases only the short cooldown.
  select public.create_order_status_email_challenge('JQ-TEST-1006', 'retry@example.test', '333333') into v_ok;
  if v_ok is distinct from true then raise exception 'Could not create retry test challenge'; end if;
  select public.mark_order_status_email_challenge_delivery_failed('JQ-TEST-1006', 'retry@example.test') into v_ok;
  if v_ok is distinct from true then raise exception 'Could not mark failed email delivery'; end if;
  select public.verify_order_status_email_code('JQ-TEST-1006', 'retry@example.test', '333333', repeat('d',64)) into v_ok;
  if v_ok is distinct from false then raise exception 'A code from a failed email delivery was accepted'; end if;
  select public.create_order_status_email_challenge('JQ-TEST-1006', 'retry@example.test', '444444') into v_ok;
  if v_ok is distinct from true then raise exception 'Immediate retry after failed delivery was blocked'; end if;

  -- Per-order hourly cap: backdate each test challenge past cooldown but keep it in the hour.
  for v_attempt in 1..5 loop
    select public.create_order_status_email_challenge('JQ-TEST-1004', 'rate-order@example.test', '111111') into v_ok;
    if v_ok is distinct from true then raise exception 'Per-order limit blocked request % too early', v_attempt; end if;
    update public.order_status_email_challenges set created_at=now()-interval '61 seconds'
     where order_id='10000000-0000-4000-8000-000000000004';
  end loop;
  select public.create_order_status_email_challenge('JQ-TEST-1004', 'rate-order@example.test', '111111') into v_ok;
  if v_ok is distinct from false then raise exception 'Per-order hourly cap was not enforced'; end if;

  -- Per-email hourly cap: eight distinct orders are allowed; the ninth is refused.
  for v_attempt in 1..8 loop
    v_order_number := 'JQ-RATE-' || v_attempt;
    select public.create_order_status_email_challenge(v_order_number, 'rate-email@example.test', '222222') into v_ok;
    if v_ok is distinct from true then raise exception 'Per-email limit blocked request % too early', v_attempt; end if;
  end loop;
  select public.create_order_status_email_challenge('JQ-RATE-9', 'rate-email@example.test', '222222') into v_ok;
  if v_ok is distinct from false then raise exception 'Per-email hourly cap was not enforced'; end if;
end
$$;

select 'order status PostgreSQL integration tests passed' as result;
