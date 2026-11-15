-- Give authenticated catalog managers the narrowly scoped access required by
-- the admin UI and its SECURITY INVOKER catalog RPCs. Customer/order/stock
-- records remain inaccessible to non-staff users.
do $$
declare
  t text;
begin
  foreach t in array array['products','product_variants','product_images','product_categories','categories'] loop
    execute format('drop policy if exists "Catalog managers can manage %I" on public.%I', t, t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.can_manage_catalog()) with check (public.can_manage_catalog())',
      'Catalog managers can manage ' || t, t
    );
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
  end loop;
end $$;

-- Admin screens need read-only access to operational records. Mutations continue
-- through SECURITY DEFINER workflow RPCs, not direct table writes.
do $$
declare
  t text;
begin
  foreach t in array array[
    'orders','order_items','payments','shipments','stock_reservations',
    'inventory','inventory_movements','warehouses','customers',
    'order_status_history','order_email_outbox','activity_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Catalog managers can read %I" on public.%I', t, t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.can_manage_catalog())',
      'Catalog managers can read ' || t, t
    );
    execute format('grant select on table public.%I to authenticated', t);
  end loop;
end $$;
