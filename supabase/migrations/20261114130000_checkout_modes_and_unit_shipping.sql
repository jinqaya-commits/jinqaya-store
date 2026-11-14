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


-- Preserve every staff shipping adjustment as an immutable audit row.
create table if not exists public.order_shipping_quote_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  original_shipping_amount numeric(12,2) not null check (original_shipping_amount >= 0),
  discount_amount numeric(12,2) not null check (discount_amount >= 0),
  final_shipping_amount numeric(12,2) not null check (final_shipping_amount >= 0),
  adjustment_reason text not null check (length(adjustment_reason) between 1 and 500),
  calculation text not null,
  unit_count integer not null check (unit_count >= 1),
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists order_shipping_quote_history_order_created_idx
  on public.order_shipping_quote_history(order_id, created_at desc);

alter table public.order_shipping_quote_history enable row level security;

-- The 9-argument overload records the staff reason and quote history while
-- delegating the existing permission, stock-reservation and status workflow.
create or replace function public.admin_process_order(
  p_order_id uuid,
  p_action text,
  p_shipping_amount numeric,
  p_shipping_method text,
  p_carrier_name text,
  p_tracking_number text,
  p_tracking_url text,
  p_note text,
  p_shipping_adjustment_reason text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_order public.orders%rowtype;
  v_result jsonb;
  v_units integer;
  v_original_shipping numeric(12,2);
  v_final_shipping numeric(12,2);
  v_discount numeric(12,2);
  v_reason text;
  v_calculation text;
begin
  if not public.can_manage_catalog() then
    raise exception 'You do not have permission to manage orders.';
  end if;
  if p_action <> 'confirm_quote' then
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

  v_result := public.admin_process_order(
    p_order_id, p_action, p_shipping_amount, p_shipping_method,
    p_carrier_name, p_tracking_number, p_tracking_url, p_note
  );
  v_final_shipping := coalesce((v_result->>'shipping_amount')::numeric, v_order.shipping_amount);
  v_discount := greatest(v_original_shipping - v_final_shipping, 0);

  update public.orders
     set shipping_quote_snapshot = coalesce(shipping_quote_snapshot,'{}'::jsonb)
       || pg_catalog.jsonb_build_object(
            'original_shipping_amount', v_original_shipping,
            'discount_amount', v_discount,
            'final_shipping_amount', v_final_shipping,
            'adjustment_reason', v_reason,
            'unit_count', v_units,
            'calculation', v_calculation
          ),
         updated_at = pg_catalog.now()
   where id = p_order_id;

  insert into public.order_shipping_quote_history(
    order_id, original_shipping_amount, discount_amount, final_shipping_amount,
    adjustment_reason, calculation, unit_count, created_by
  ) values (
    p_order_id, v_original_shipping, v_discount, v_final_shipping,
    v_reason, v_calculation, v_units, auth.uid()
  );

  insert into public.activity_logs(
    actor_user_id, action, entity_type, entity_id, old_values, new_values
  ) values (
    auth.uid(), 'order.shipping_quote_adjusted', 'order', p_order_id,
    pg_catalog.jsonb_build_object('original_shipping_amount',v_original_shipping),
    pg_catalog.jsonb_build_object(
      'discount_amount',v_discount,
      'final_shipping_amount',v_final_shipping,
      'adjustment_reason',v_reason,
      'unit_count',v_units
    )
  );

  return v_result || pg_catalog.jsonb_build_object(
    'original_shipping_amount',v_original_shipping,
    'discount_amount',v_discount,
    'final_shipping_amount',v_final_shipping,
    'adjustment_reason',v_reason
  );
end;
$function$;

revoke all on function public.admin_process_order(uuid,text,numeric,text,text,text,text,text,text) from public, anon;
grant execute on function public.admin_process_order(uuid,text,numeric,text,text,text,text,text,text) to authenticated;
