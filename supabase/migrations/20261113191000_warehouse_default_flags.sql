alter table public.warehouses
  add column if not exists is_active boolean not null default true;
alter table public.warehouses
  add column if not exists is_default boolean not null default false;

update public.warehouses
set is_active = true, is_default = true
where id = (select id from public.warehouses order by id limit 1)
  and not exists (select 1 from public.warehouses where is_default = true);

create unique index if not exists warehouses_one_default_idx
  on public.warehouses ((is_default)) where is_default = true;
