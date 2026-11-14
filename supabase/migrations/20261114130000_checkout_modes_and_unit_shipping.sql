-- Add an explicit checkout mode while preserving the existing six-argument
-- RPC for older internal callers. The wrapper runs in the same transaction as
-- the original order creation, so a failed stock reservation rolls back the order.
create or replace function public.submit_guest_order(
  p_idempotency_key text,
  p_customer jsonb,
  p_shipping_address jsonb,
  p_items jsonb,
  p_customer_note text,
  p_honeypot text,
  p_checkout_mode text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_result jsonb;
  v_order public.orders%rowtype;
  v_item record;
  v_inventory public.inventory%rowtype;
  v_reservation_count integer := 0;
  v_total_units integer := 0;
  v_shipping numeric(12,2);
  v_now timestamptz := pg_catalog.now();
  v_existing boolean := false;
begin
  if p_checkout_mode is null or p_checkout_mode not in ('pay_now', 'request_quote') then
    raise exception 'Invalid checkout option.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_idempotency_key));

  select o.* into v_order
    from public.orders o
   where o.checkout_idempotency_key = p_idempotency_key
   for update;
  v_existing := found;

  if v_existing then
    if lower(v_order.customer_email) <> lower(pg_catalog.trim(coalesce(p_customer->>'email',''))) then
      raise exception 'This checkout request key has already been used. Please refresh checkout and try again.';
    end if;
    if coalesce(v_order.shipping_quote_snapshot->>'checkout_mode','') <> p_checkout_mode then
      raise exception 'This checkout request was already submitted with a different checkout option. Please refresh checkout.';
    end if;
    if p_checkout_mode = 'pay_now' then
      if v_order.status <> 'pending_payment'
         or coalesce(v_order.shipping_quote_snapshot->>'status','') <> 'confirmed'
         or round(v_order.shipping_amount,2) <> round(coalesce((v_order.shipping_quote_snapshot->>'amount')::numeric,-1),2)
         or round(v_order.total_amount,2) <> round(coalesce(v_order.subtotal,0) + v_order.shipping_amount + coalesce(v_order.tax_amount,0) - coalesce(v_order.discount_amount,0),2)
         or not exists (
           select 1 from public.stock_reservations r
            where r.order_id = v_order.id
              and r.status = 'active'
              and r.expires_at > v_now
         ) then
        raise exception 'The previous payment reservation is no longer valid. Please contact support before retrying.';
      end if;
      return pg_catalog.jsonb_build_object(
        'order_id', v_order.id,
        'order_number', v_order.order_number,
        'status', v_order.status,
        'subtotal', v_order.subtotal,
        'shipping_amount', v_order.shipping_amount,
        'total_amount', v_order.total_amount,
        'shipping_status', 'confirmed',
        'payment_status', 'not_started',
        'checkout_mode', 'pay_now',
        'payment_ready', true,
        'currency', v_order.currency
      );
    end if;
    return pg_catalog.jsonb_build_object(
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'status', v_order.status,
      'subtotal', v_order.subtotal,
      'shipping_amount', v_order.shipping_amount,
      'total_amount', v_order.total_amount,
      'shipping_status', 'quote_required',
      'payment_status', 'not_started',
      'checkout_mode', 'request_quote',
      'payment_ready', false,
      'currency', v_order.currency
    );
  end if;

  -- Reuse the existing validated guest-order pipeline for customer, address,
  -- product/variant price snapshots, rate limiting and idempotency checks.
  v_result := public.submit_guest_order(
    p_idempotency_key,
    p_customer,
    p_shipping_address,
    p_items,
    p_customer_note,
    p_honeypot
  );

  select o.* into v_order
    from public.orders o
   where o.id = (v_result->>'order_id')::uuid
   for update;

  if p_checkout_mode = 'request_quote' then
    update public.orders
       set shipping_quote_snapshot = coalesce(shipping_quote_snapshot, '{}'::jsonb)
         || pg_catalog.jsonb_build_object(
              'checkout_mode', 'request_quote',
              'status', 'quote_required',
              'message', 'Your request has been received. Our team will review stock and shipping before confirming the final amount.'
            ),
           updated_at = v_now
     where id = v_order.id;

    return pg_catalog.jsonb_build_object(
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'status', 'on_hold',
      'subtotal', v_order.subtotal,
      'shipping_amount', 0,
      'total_amount', v_order.subtotal - v_order.discount_amount + v_order.tax_amount,
      'shipping_status', 'quote_required',
      'payment_status', 'not_started',
      'checkout_mode', 'request_quote',
      'payment_ready', false,
      'currency', v_order.currency
    );
  end if;

  -- Automatic shipping rule: count units across all order lines and variants.
  select coalesce(sum(oi.quantity), 0)::integer
    into v_total_units
    from public.order_items oi
   where oi.order_id = v_order.id;

  if v_total_units < 1 then
    raise exception 'Your bag is empty.';
  end if;

  if v_total_units <= 2 then
    v_shipping := 50.00;
  else
    v_shipping := round(v_order.subtotal * 0.50, 2);
  end if;

  -- Reserve all requested units atomically for 48 hours, using the same
  -- inventory ledger conventions as the existing staff quote-confirmation flow.
  for v_item in
    select oi.variant_id, sum(oi.quantity)::integer as quantity
      from public.order_items oi
     where oi.order_id = v_order.id
     group by oi.variant_id
     order by oi.variant_id
  loop
    if v_item.variant_id is null then
      raise exception 'An item in your bag has no inventory variant. Please contact support.';
    end if;

    select i.* into v_inventory
      from public.inventory i
     where i.variant_id = v_item.variant_id
       and i.on_hand - i.reserved - i.damaged >= v_item.quantity
     order by i.warehouse_id
     limit 1
     for update;

    if not found then
      raise exception 'Insufficient stock for one or more items. Choose the shipping quote option or contact support.';
    end if;

    update public.inventory
       set reserved = reserved + v_item.quantity,
           updated_at = v_now
     where id = v_inventory.id
       and on_hand - reserved - damaged >= v_item.quantity;

    if not found then
      raise exception 'Inventory changed while reserving stock. Please retry.';
    end if;

    insert into public.stock_reservations(
      order_id, warehouse_id, variant_id, quantity, status, expires_at
    ) values (
      v_order.id, v_inventory.warehouse_id, v_item.variant_id,
      v_item.quantity, 'active', v_now + interval '48 hours'
    );

    insert into public.inventory_movements(
      warehouse_id, variant_id, movement_type, quantity_change, reserved_change,
      reference_type, reference_id, notes, created_by
    ) values (
      v_inventory.warehouse_id, v_item.variant_id, 'reservation', 0, v_item.quantity,
      'order', v_order.id, 'Stock reserved for 48-hour customer PayPal checkout.', null
    );

    v_reservation_count := v_reservation_count + v_item.quantity;
  end loop;

  update public.orders
     set status = 'pending_payment',
         shipping_amount = v_shipping,
         total_amount = round(
           coalesce(subtotal, 0) + v_shipping
           + coalesce(tax_amount, 0) - coalesce(discount_amount, 0), 2
         ),
         shipping_method_name = 'Standard shipping',
         shipping_quote_snapshot = pg_catalog.jsonb_build_object(
           'checkout_mode', 'pay_now',
           'status', 'confirmed',
           'calculation', case when v_total_units <= 2 then 'flat_50_for_one_or_two_units' else '50_percent_of_subtotal_for_three_or_more_units' end,
           'unit_count', v_total_units,
           'original_shipping_amount', v_shipping,
           'discount_amount', 0,
           'adjustment_reason', null,
           'amount', v_shipping,
           'confirmed_at', v_now,
           'expires_at', v_now + interval '48 hours',
           'destination_country_code', shipping_address_snapshot->>'country_code'
         ),
         internal_note = pg_catalog.left(
           pg_catalog.concat_ws(E'\\n', nullif(internal_note,''), 'Customer selected immediate PayPal payment; stock reserved for 48 hours.'),
           2000
         ),
         updated_at = v_now
   where id = v_order.id;

  insert into public.order_status_history(order_id, old_status, new_status, note, changed_by)
  values(v_order.id, 'on_hold', 'pending_payment', 'Stock reserved for 48 hours; shipping confirmed for immediate PayPal payment.', null);

  insert into public.activity_logs(actor_user_id, action, entity_type, entity_id, old_values, new_values)
  values(
    null, 'order.checkout_pay_now_created', 'order', v_order.id,
    pg_catalog.jsonb_build_object('status','on_hold'),
    pg_catalog.jsonb_build_object(
      'status','pending_payment',
      'checkout_mode','pay_now',
      'unit_count',v_total_units,
      'shipping_amount',v_shipping,
      'reserved_units',v_reservation_count
    )
  );

  return pg_catalog.jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'status', 'pending_payment',
    'subtotal', v_order.subtotal,
    'shipping_amount', v_shipping,
    'total_amount', round(v_order.subtotal + v_shipping + coalesce(v_order.tax_amount,0) - coalesce(v_order.discount_amount,0), 2),
    'shipping_status', 'confirmed',
    'payment_status', 'not_started',
    'payment_ready', true,
    'reserved_units', v_reservation_count,
    'unit_count', v_total_units,
    'currency', v_order.currency
  );
end;
$function$;

revoke all on function public.submit_guest_order(text,jsonb,jsonb,jsonb,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_guest_order(text,jsonb,jsonb,jsonb,text,text,text) to service_role;
