-- Reject NULL movement types explicitly rather than relying on enum NOT NULL.
create or replace function public.admin_record_inventory_movement(
  p_variant_id uuid,
  p_movement_type text,
  p_quantity integer,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_warehouse_id uuid;
  v_inventory public.inventory%rowtype;
  v_quantity_change integer := 0;
  v_damaged_change integer := 0;
  v_note text := nullif(btrim(coalesce(p_notes, '')), '');
begin
  if auth.uid() is null or not public.can_manage_catalog() then
    raise exception 'Not authorized to manage inventory';
  end if;
  if p_variant_id is null
     or p_movement_type is null
     or p_movement_type not in ('purchase_receipt', 'customer_return', 'supplier_return', 'damage')
     or p_quantity is null or p_quantity < 1 or p_quantity > 1000000
     or length(coalesce(p_notes, '')) < 3 or length(coalesce(p_notes, '')) > 500 then
    raise exception 'Invalid inventory movement details';
  end if;
  select id into v_warehouse_id from public.warehouses
  where is_default = true and is_active = true order by id limit 1;
  if not found then raise exception 'No active default warehouse is configured'; end if;
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved, damaged, reorder_point)
  values (v_warehouse_id, p_variant_id, 0, 0, 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;
  select * into v_inventory from public.inventory
  where warehouse_id = v_warehouse_id and variant_id = p_variant_id for update;
  if not found then raise exception 'Inventory record not found for this SKU'; end if;
  if p_movement_type in ('purchase_receipt', 'customer_return') then
    v_quantity_change := p_quantity;
  elsif p_movement_type = 'supplier_return' then
    if v_inventory.on_hand - v_inventory.reserved - v_inventory.damaged < p_quantity then
      raise exception 'Cannot return stock that is reserved or damaged';
    end if;
    v_quantity_change := -p_quantity;
  elsif p_movement_type = 'damage' then
    if v_inventory.on_hand - v_inventory.reserved - v_inventory.damaged < p_quantity then
      raise exception 'Cannot mark reserved or already damaged stock as damaged';
    end if;
    v_damaged_change := p_quantity;
  end if;
  update public.inventory set on_hand = on_hand + v_quantity_change,
    damaged = damaged + v_damaged_change, updated_at = now() where id = v_inventory.id;
  insert into public.inventory_movements (
    warehouse_id, variant_id, movement_type, quantity_change, reserved_change, damaged_change, notes, created_by
  ) values (
    v_warehouse_id, p_variant_id, p_movement_type::public.inventory_movement_type,
    v_quantity_change, 0, v_damaged_change, v_note, auth.uid()
  );
end;
$function$;
