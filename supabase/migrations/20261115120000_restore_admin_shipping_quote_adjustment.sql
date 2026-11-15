-- Restore the source-controlled definition of the production shipping-quote RPC.
-- This is a forward-only reconciliation: the original 20261113165630 migration
-- is recorded in production but its source file is absent from the repository.
-- The function body below was read from the live production database.

create table if not exists public.order_shipping_quote_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  original_shipping_amount numeric not null check (original_shipping_amount >= 0),
  discount_amount numeric not null check (discount_amount >= 0),
  final_shipping_amount numeric not null check (final_shipping_amount >= 0),
  adjustment_reason text not null check (length(adjustment_reason) >= 1 and length(adjustment_reason) <= 500),
  calculation text not null,
  unit_count integer not null check (unit_count >= 1),
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists order_shipping_quote_history_order_created_idx
  on public.order_shipping_quote_history (order_id, created_at desc);

alter table public.order_shipping_quote_history enable row level security;

drop policy if exists order_shipping_quote_history_manager_read
  on public.order_shipping_quote_history;

create policy order_shipping_quote_history_manager_read
  on public.order_shipping_quote_history
  for select
  to authenticated
  using (public.can_manage_catalog());

revoke all on table public.order_shipping_quote_history from anon, authenticated;
grant select on table public.order_shipping_quote_history to authenticated;
grant all on table public.order_shipping_quote_history to service_role;

CREATE OR REPLACE FUNCTION public.admin_process_order(p_order_id uuid, p_action text, p_shipping_amount numeric, p_shipping_method text, p_carrier_name text, p_tracking_number text, p_tracking_url text, p_note text, p_shipping_adjustment_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_order public.orders%rowtype;
  v_inventory public.inventory%rowtype;
  v_item record;
  v_result jsonb;
  v_units integer;
  v_reserved integer := 0;
  v_remaining integer := 0;
  v_take integer := 0;
  v_original_shipping numeric(12,2);
  v_final_shipping numeric(12,2);
  v_discount numeric(12,2);
  v_shipping numeric(12,2);
  v_method text;
  v_reason text;
  v_calculation text;
  v_now timestamptz := pg_catalog.now();
begin
  if not public.can_manage_catalog() then
    raise exception 'You do not have permission to manage orders.';
  end if;
  if p_action is distinct from 'confirm_quote' then
    return public.admin_process_order(
      p_order_id, p_action, p_shipping_amount, p_shipping_method,
      p_carrier_name, p_tracking_number, p_tracking_url, p_note
    );
  end if;
  if length(coalesce(p_shipping_adjustment_reason,'')) > 500 then
    raise exception 'Shipping adjustment reason must be 500 characters or fewer.';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;

  select coalesce(sum(oi.quantity),0)::integer
    into v_units
    from public.order_items oi
   where oi.order_id = p_order_id;
  if v_units < 1 then raise exception 'Order has no valid item quantities.'; end if;

  if v_units <= 2 then
    v_original_shipping := 50.00;
    v_calculation := 'flat_50_for_one_or_two_units';
  else
    v_original_shipping := round(coalesce(v_order.subtotal,0) * 0.50,2);
    v_calculation := '50_percent_of_subtotal_for_three_or_more_units';
  end if;

  v_reason := coalesce(
    nullif(pg_catalog.btrim(coalesce(p_shipping_adjustment_reason,'')), ''),
    'Standard shipping quote confirmed'
  );

  if v_order.status <> 'on_hold' then
    raise exception 'Only orders needing review can be confirmed.';
  end if;
  if p_shipping_amount is not null and (
    p_shipping_amount < 0 or p_shipping_amount > 99999999.99
    or p_shipping_amount <> round(p_shipping_amount,2)
  ) then
    raise exception 'Shipping amount must be a non-negative amount with no more than two decimal places.';
  end if;

  v_shipping := round(coalesce(
    p_shipping_amount,
    case when v_units <= 2 then 50.00 else coalesce(v_order.subtotal,0) * 0.50 end
  ),2);
  v_method := coalesce(
    nullif(pg_catalog.btrim(coalesce(p_shipping_method,'')),''),
    case when p_shipping_amount is null then 'Standard shipping' else 'Custom shipping quote' end
  );

  if exists (
    select 1 from public.stock_reservations
     where order_id = p_order_id and status = 'active'
  ) then
    raise exception 'This order already has active stock reservations. Review inventory before continuing.';
  end if;

  -- Reserve across warehouses atomically, matching the customer Pay now flow.
  for v_item in
    select oi.variant_id, sum(oi.quantity)::integer as quantity
      from public.order_items oi
     where oi.order_id = p_order_id
     group by oi.variant_id
     order by oi.variant_id
  loop
    if v_item.variant_id is null then
      raise exception 'An order item has no inventory variant. Please review this order manually.';
    end if;

    v_remaining := v_item.quantity;
    for v_inventory in
      select i.*
        from public.inventory i
       where i.variant_id = v_item.variant_id
         and i.on_hand - i.reserved - i.damaged > 0
       order by i.warehouse_id
       for update
    loop
      exit when v_remaining <= 0;
      v_take := least(
        v_remaining,
        greatest(v_inventory.on_hand - v_inventory.reserved - v_inventory.damaged,0)
      );
      if v_take > 0 then
        update public.inventory
           set reserved = reserved + v_take, updated_at = v_now
         where id = v_inventory.id
           and on_hand - reserved - damaged >= v_take;
        if not found then
          raise exception 'Inventory changed while reserving stock. Please retry.';
        end if;

        insert into public.stock_reservations(
          order_id, warehouse_id, variant_id, quantity, status, expires_at
        ) values (
          p_order_id, v_inventory.warehouse_id, v_item.variant_id,
          v_take, 'active', v_now + interval '48 hours'
        );

        insert into public.inventory_movements(
          warehouse_id, variant_id, movement_type, quantity_change, reserved_change,
          reference_type, reference_id, notes, created_by
        ) values (
          v_inventory.warehouse_id, v_item.variant_id, 'reservation', 0, v_take,
          'order', p_order_id, 'Stock reserved by staff after shipping quote review.', auth.uid()
        );

        v_remaining := v_remaining - v_take;
        v_reserved := v_reserved + v_take;
      end if;
    end loop;
    if v_remaining > 0 then
      raise exception 'Insufficient stock for one or more items. The order remains on hold.';
    end if;
  end loop;

  v_final_shipping := v_shipping;
  v_discount := greatest(v_original_shipping - v_final_shipping, 0);

  update public.orders
     set status = 'pending_payment',
         shipping_amount = v_final_shipping,
         total_amount = round(
           coalesce(subtotal,0) + v_final_shipping
           + coalesce(tax_amount,0) - coalesce(discount_amount,0), 2
         ),
         shipping_method_name = v_method,
         shipping_quote_snapshot = coalesce(shipping_quote_snapshot,'{}'::jsonb)
           || pg_catalog.jsonb_build_object(
                'checkout_mode', 'request_quote',
                'status', 'confirmed',
                'original_shipping_amount', v_original_shipping,
                'discount_amount', v_discount,
                'final_shipping_amount', v_final_shipping,
                'adjustment_reason', v_reason,
                'unit_count', v_units,
                'calculation', v_calculation,
                'amount', v_final_shipping,
                'confirmed_at', v_now,
                'expires_at', v_now + interval '48 hours'
              ),
         internal_note = pg_catalog.left(
           pg_catalog.concat_ws(E'\\n', nullif(internal_note,''), nullif(pg_catalog.btrim(coalesce(p_note,'')),'')),
           2000
         ),
         updated_at = v_now
   where id = p_order_id;

  insert into public.order_status_history(order_id,old_status,new_status,note,changed_by)
  values(
    p_order_id,'on_hold','pending_payment',
    'Shipping quote confirmed and stock reserved for 48-hour payment window.',
    auth.uid()
  );

  insert into public.activity_logs(
    actor_user_id, action, entity_type, entity_id, old_values, new_values
  ) values (
    auth.uid(), 'order.shipping_quote_adjusted', 'order', p_order_id,
    pg_catalog.jsonb_build_object('status','on_hold','original_shipping_amount',v_original_shipping),
    pg_catalog.jsonb_build_object(
      'status','pending_payment',
      'discount_amount',v_discount,
      'final_shipping_amount',v_final_shipping,
      'adjustment_reason',v_reason,
      'unit_count',v_units,
      'reserved_units',v_reserved
    )
  );

  insert into public.order_shipping_quote_history(
    order_id, original_shipping_amount, discount_amount, final_shipping_amount,
    adjustment_reason, calculation, unit_count, created_by
  ) values (
    p_order_id, v_original_shipping, v_discount, v_final_shipping,
    v_reason, v_calculation, v_units, auth.uid()
  );

  return pg_catalog.jsonb_build_object(
    'order_id',p_order_id,
    'status','pending_payment',
    'shipping_amount',v_final_shipping,
    'total_amount',round(
      coalesce(v_order.subtotal,0) + v_final_shipping
      + coalesce(v_order.tax_amount,0) - coalesce(v_order.discount_amount,0),2
    ),
    'reserved_units',v_reserved,
    'original_shipping_amount',v_original_shipping,
    'discount_amount',v_discount,
    'final_shipping_amount',v_final_shipping,
    'adjustment_reason',v_reason
  );
end;
$function$;

revoke all on function public.admin_process_order(uuid,text,numeric,text,text,text,text,text,text) from public, anon;
grant execute on function public.admin_process_order(uuid,text,numeric,text,text,text,text,text,text) to authenticated, service_role;
