alter table public.payments
  add column if not exists provider_order_id text;

create unique index if not exists payments_paypal_order_unique_idx
  on public.payments(provider, provider_order_id)
  where provider = 'paypal' and provider_order_id is not null;

create or replace function public.get_customer_order_status(p_token_hash text)
returns jsonb
language sql
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'order_id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'currency', o.currency,
    'subtotal', o.subtotal,
    'shipping_amount', o.shipping_amount,
    'total_amount', o.total_amount,
    'shipping_method', o.shipping_method_name,
    'payment_ready', (
      o.status = 'pending_payment'
      and exists (
        select 1 from public.stock_reservations r
        where r.order_id = o.id
          and r.status = 'active'
          and r.expires_at > now()
      )
      and o.total_amount > 0
    ),
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

create or replace function public.record_paypal_order_payment(
  p_order_id uuid,
  p_paypal_order_id text,
  p_capture_id text,
  p_amount numeric,
  p_currency text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_order public.orders%rowtype;
  v_reservation public.stock_reservations%rowtype;
  v_now timestamptz := now();
  v_existing public.payments%rowtype;
begin
  if p_order_id is null
     or coalesce(length(trim(p_paypal_order_id)), 0) < 5
     or coalesce(length(trim(p_capture_id)), 0) < 5
     or p_amount is null or p_amount <= 0
     or upper(trim(coalesce(p_currency,''))) !~ '^[A-Z]{3}$' then
    raise exception 'Invalid PayPal payment details.';
  end if;

  select * into v_order
    from public.orders
   where id = p_order_id
   for update;
  if not found then raise exception 'Order not found.'; end if;

  select * into v_existing
    from public.payments
   where provider = 'paypal'
     and (provider_order_id = trim(p_paypal_order_id)
       or provider_payment_id = trim(p_capture_id))
   limit 1
   for update;

  if found then
    if v_existing.order_id = p_order_id
       and v_existing.provider_order_id = trim(p_paypal_order_id)
       and v_existing.provider_payment_id = trim(p_capture_id)
       and v_existing.status = 'paid'
       and round(v_existing.amount,2) = round(p_amount,2)
       and upper(trim(v_existing.currency)) = upper(trim(p_currency)) then
      return jsonb_build_object('order_id',p_order_id,'status','paid','already_recorded',true);
    end if;
    raise exception 'This PayPal transaction has already been used.';
  end if;

  if v_order.status <> 'pending_payment' then
    raise exception 'This order is not awaiting payment.';
  end if;
  if round(v_order.total_amount,2) <> round(p_amount,2)
     or upper(trim(v_order.currency)) <> upper(trim(p_currency)) then
    raise exception 'The captured amount does not match the confirmed order total.';
  end if;

  if not exists (
    select 1 from public.stock_reservations r
    where r.order_id=p_order_id and r.status='active' and r.expires_at > v_now
  ) then
    raise exception 'The stock reservation has expired. Please reconfirm stock and shipping.';
  end if;

  for v_reservation in
    select * from public.stock_reservations
     where order_id=p_order_id and status='active'
     order by id
     for update
  loop
    if v_reservation.expires_at is not null and v_reservation.expires_at <= v_now then
      raise exception 'The stock reservation has expired. Please reconfirm stock and shipping.';
    end if;

    update public.inventory
       set on_hand=on_hand-v_reservation.quantity,
           reserved=reserved-v_reservation.quantity,
           updated_at=v_now
     where warehouse_id=v_reservation.warehouse_id
       and variant_id=v_reservation.variant_id
       and on_hand>=v_reservation.quantity
       and reserved>=v_reservation.quantity;
    if not found then
      raise exception 'Inventory changed unexpectedly. Payment was captured but the order needs manual review.';
    end if;

    update public.stock_reservations
       set status='committed',committed_at=v_now
     where id=v_reservation.id;

    insert into public.inventory_movements(
      warehouse_id,variant_id,movement_type,quantity_change,reserved_change,
      reference_type,reference_id,notes,created_by
    ) values (
      v_reservation.warehouse_id,v_reservation.variant_id,'sale',
      -v_reservation.quantity,-v_reservation.quantity,'order',p_order_id,
      'Stock deducted after PayPal payment was verified',null
    );
  end loop;

  insert into public.payments(
    order_id,provider,provider_order_id,provider_payment_id,status,
    amount,currency,payment_method_type,idempotency_key,paid_at
  ) values (
    p_order_id,'paypal',trim(p_paypal_order_id),trim(p_capture_id),'paid',
    round(p_amount,2),upper(trim(p_currency)),'paypal',
    'paypal-capture:'||trim(p_capture_id),v_now
  );

  update public.orders set status='paid',paid_at=v_now where id=p_order_id;

  insert into public.order_status_history(order_id,old_status,new_status,note,changed_by)
  values(p_order_id,'pending_payment','paid','PayPal payment verified automatically.',null);

  insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,old_values,new_values)
  values(
    null,'order.paypal_payment_captured','order',p_order_id,
    jsonb_build_object('status','pending_payment'),
    jsonb_build_object('status','paid','provider','paypal','provider_order_id',trim(p_paypal_order_id),'capture_id',trim(p_capture_id),'amount',round(p_amount,2),'currency',upper(trim(p_currency)))
  );

  return jsonb_build_object('order_id',p_order_id,'status','paid','already_recorded',false);
end;
$function$;

revoke all on function public.record_paypal_order_payment(uuid,text,text,numeric,text) from public, anon, authenticated;
grant execute on function public.record_paypal_order_payment(uuid,text,text,numeric,text) to service_role;
