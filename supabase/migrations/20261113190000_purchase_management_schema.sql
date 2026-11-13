-- Purchase management schema for the JINQAYA admin workspace.
-- This migration creates the ledger tables only; write operations are added in a
-- separate migration after the transactional RPCs are reviewed.

do $$ begin
  create type public.purchase_order_status as enum (
    'draft', 'submitted', 'partially_received', 'received', 'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.goods_receipt_status as enum ('draft', 'posted', 'cancelled');
exception when duplicate_object then null;
end $$;

create sequence if not exists public.supplier_code_seq;
create sequence if not exists public.purchase_order_number_seq;
create sequence if not exists public.goods_receipt_number_seq;

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  supplier_code text unique,
  company_name text not null check (char_length(btrim(company_name)) between 2 and 160),
  contact_name text,
  email text,
  phone text,
  website text,
  country text,
  city text,
  address text,
  postal_code text,
  payment_terms text,
  currency char(3) not null default 'USD',
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null unique,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  supplier_name_snapshot text,
  supplier_email_snapshot text,
  supplier_phone_snapshot text,
  supplier_reference text,
  status public.purchase_order_status not null default 'draft',
  currency char(3) not null default 'USD',
  order_date date not null default current_date,
  expected_date date,
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  shipping_cost numeric(14,2) not null default 0 check (shipping_cost >= 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity_ordered integer not null check (quantity_ordered > 0),
  quantity_received integer not null default 0 check (quantity_received >= 0),
  unit_cost numeric(14,2) not null check (unit_cost >= 0),
  line_total numeric(14,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity_received <= quantity_ordered)
);

create table if not exists public.purchase_order_payments (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null,
  payment_date date not null default current_date,
  payment_method text not null check (payment_method in ('bank_transfer','cash','card','other')),
  reference_number text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.goods_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  status public.goods_receipt_status not null default 'draft',
  supplier_delivery_reference text,
  notes text,
  received_at timestamptz,
  received_by uuid references auth.users(id) on delete set null,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.goods_receipt_items (
  id uuid primary key default gen_random_uuid(),
  goods_receipt_id uuid not null references public.goods_receipts(id) on delete restrict,
  purchase_order_item_id uuid not null references public.purchase_order_items(id) on delete restrict,
  quantity_received integer not null check (quantity_received > 0),
  quantity_damaged integer not null default 0 check (quantity_damaged >= 0 and quantity_damaged <= quantity_received),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists purchase_orders_supplier_date_idx
  on public.purchase_orders (supplier_id, order_date desc);
create index if not exists purchase_orders_status_expected_idx
  on public.purchase_orders (status, expected_date);
create index if not exists purchase_order_items_order_idx
  on public.purchase_order_items (purchase_order_id);
create index if not exists purchase_order_items_variant_idx
  on public.purchase_order_items (variant_id);
create index if not exists purchase_order_payments_order_date_idx
  on public.purchase_order_payments (purchase_order_id, payment_date desc);
create index if not exists goods_receipts_order_created_idx
  on public.goods_receipts (purchase_order_id, created_at desc);
create index if not exists goods_receipt_items_receipt_idx
  on public.goods_receipt_items (goods_receipt_id);

alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.purchase_order_payments enable row level security;
alter table public.goods_receipts enable row level security;
alter table public.goods_receipt_items enable row level security;

drop policy if exists "catalog managers manage suppliers" on public.suppliers;
create policy "catalog managers manage suppliers" on public.suppliers
  for all to authenticated
  using (public.can_manage_catalog())
  with check (public.can_manage_catalog());

drop policy if exists "catalog managers manage purchase orders" on public.purchase_orders;
create policy "catalog managers manage purchase orders" on public.purchase_orders
  for all to authenticated
  using (public.can_manage_catalog())
  with check (public.can_manage_catalog());

drop policy if exists "catalog managers read purchase order items" on public.purchase_order_items;
create policy "catalog managers read purchase order items" on public.purchase_order_items
  for select to authenticated
  using (public.can_manage_catalog());

drop policy if exists "catalog managers read purchase order payments" on public.purchase_order_payments;
create policy "catalog managers read purchase order payments" on public.purchase_order_payments
  for select to authenticated
  using (public.can_manage_catalog());

drop policy if exists "catalog managers read goods receipts" on public.goods_receipts;
create policy "catalog managers read goods receipts" on public.goods_receipts
  for select to authenticated
  using (public.can_manage_catalog());

drop policy if exists "catalog managers read goods receipt items" on public.goods_receipt_items;
create policy "catalog managers read goods receipt items" on public.goods_receipt_items
  for select to authenticated
  using (public.can_manage_catalog());

grant select, insert, update, delete on public.suppliers to authenticated;
grant select on public.purchase_orders, public.purchase_order_items,
  public.purchase_order_payments, public.goods_receipts, public.goods_receipt_items
  to authenticated;

comment on table public.purchase_orders is 'Supplier purchase orders; inventory changes only when a goods receipt is posted.';
comment on table public.goods_receipts is 'Posted supplier receipts, linked to inventory movements by transactional RPCs.';
comment on table public.purchase_order_payments is 'Recorded supplier payments only; this ledger does not initiate transfers.';
