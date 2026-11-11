-- Verify the cleanup migration upgrades the legacy Production table shape.
\set ON_ERROR_STOP on

create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create or replace function auth.jwt() returns json language sql stable as $$ select '{}'::json $$;
create or replace function public.can_manage_catalog() returns boolean language sql stable as $$ select false $$;

create type public.image_kind as enum ('main', 'gallery');
create table public.products (id uuid primary key);
create table public.product_images (
  id uuid primary key,
  product_id uuid not null references public.products(id),
  storage_path text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  image_type public.image_kind not null default 'gallery'
);

create table public.product_image_cleanup_queue (
  storage_path text primary key,
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.product_image_cleanup_queue enable row level security;
insert into public.product_image_cleanup_queue(storage_path) values ('legacy/product-image.jpg');

\ir ../supabase/migrations/202611120001_product_image_cleanup_queue.sql

do $$
declare
  v_id uuid;
begin
  select id into v_id from public.product_image_cleanup_queue
   where storage_path='legacy/product-image.jpg';
  if v_id is null then raise exception 'Legacy queue row was not preserved or backfilled'; end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='product_image_cleanup_queue' and column_name='locked_at'
  ) then raise exception 'Worker lease column was not added'; end if;
  if not (select relrowsecurity from pg_class where oid='public.product_image_cleanup_queue'::regclass) then
    raise exception 'Cleanup queue RLS is not enabled';
  end if;
  if has_table_privilege('anon','public.product_image_cleanup_queue','SELECT')
     or has_table_privilege('authenticated','public.product_image_cleanup_queue','SELECT') then
    raise exception 'Client roles can read cleanup queue';
  end if;
  if not has_function_privilege('service_role','public.claim_product_image_cleanup(integer)','EXECUTE')
     or has_function_privilege('anon','public.claim_product_image_cleanup(integer)','EXECUTE') then
    raise exception 'Cleanup RPC grants are incorrect';
  end if;
end
$$;

select 'legacy product image cleanup migration test passed' as result;
