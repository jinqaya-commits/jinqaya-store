alter table public.payments add column if not exists provider_order_id text;\nalter table public.payments add column if not exists stock_review_required boolean not null default false;

create unique index if not exists payments_paypal_order_unique_idx
  on public.payments(provider, provider_order_id)
  where provider = 'paypal' and provider_order_id is not null;

create or replace function public.get_customer_order_status(p_token_hash text)
returns jsonb language sql security definer set search_path to ''
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
      o.status='pending_payment' and o.total_amount>0 and exists (
        select 1 from public.stock_reservations r
        where r.order_id=o.id and r.status='active' and r.expires_at>now()
      )
    ),
    'payment_status', (
      select p.status::text from public.payments p
      where p.order_id=o.id order by p.created_at desc limit 1
    ),
    'payment_stock_review_required', coalesce((
      select p.stock_review_required from public.payments p
      where p.order_id=o.id order by p.created_at desc limit 1
    ), false),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_name',oi.product_name,'variant_name',oi.variant_name,'quantity',oi.quantity
      ) order by oi.created_at)
      from public.order_items oi where oi.order_id=o.id
    ),'[]'::jsonb),
    'shipment', case when sh.id is null then null else jsonb_build_object(
      'status',sh.status,'carrier',sh.carrier_name,'tracking_number',sh.tracking_number,
      'tracking_url',sh.tracking_url,'shipped_at',sh.shipped_at,'delivered_at',sh.delivered_at
    ) end
  )
  from public.customer_order_status_sessions s
  join public.orders o on o.id=s.order_id
  left join lateral (
    select x.* from public.shipments x where x.order_id=o.id order by x.created_at desc limit 1
  ) sh on true
  where s.token_hash=p_token_hash and s.expires_at>now()
  order by s.created_at desc limit 1;
$function$;

create or replace function public.record_paypal_order_payment(
  p_order_id uuid,p_paypal_order_id text,p_capture_id text,p_amount numeric,p_currency text
)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
  v_order public.orders%rowtype;
  v_reservation public.stock_reservations%rowtype;
  v_existing public.payments%rowtype;
  v_now timestamptz:=now();
  v_stock_review boolean:=false;
  v_new_status public.order_status;
  v_customer_name text;
  v_payload jsonb;
begin
  if p_order_id is null or coalesce(length(trim(p_paypal_order_id)),0)<5
    or coalesce(length(trim(p_capture_id)),0)<5 or p_amount is null or p_amount<=0
    or upper(trim(coalesce(p_currency,''))) !~ '^[A-Z]{3}$' then
    raise exception 'Invalid PayPal payment details.';
  end if;

  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;

  select * into v_existing from public.payments
   where provider='paypal' and (provider_order_id=trim(p_paypal_order_id)
     or provider_payment_id=trim(p_capture_id))
   limit 1 for update;
  if found then
    if v_existing.order_id=p_order_id
      and v_existing.provider_order_id=trim(p_paypal_order_id)
      and v_existing.provider_payment_id=trim(p_capture_id)
      and v_existing.status='paid'
      and round(v_existing.amount,2)=round(p_amount,2)
      and upper(trim(v_existing.currency))=upper(trim(p_currency)) then
      return jsonb_build_object('order_id',p_order_id,'status',v_order.status,
        'already_recorded',true,'stock_review_required',v_existing.stock_review_required);
    end if;
    raise exception 'This PayPal transaction has already been used.';
  end if;

  if v_order.status<>'pending_payment' then raise exception 'This order is not awaiting payment.'; end if;
  if round(v_order.total_amount,2)<>round(p_amount,2)
    or upper(trim(v_order.currency))<>upper(trim(p_currency)) then
    raise exception 'The captured amount does not match the confirmed order total.';
  end if;

  perform 1 from public.stock_reservations r
    where r.order_id=p_order_id and r.status='active'
    for update;
  perform 1 from public.inventory i
    join public.stock_reservations r
      on i.warehouse_id=r.warehouse_id and i.variant_id=r.variant_id
    where r.order_id=p_order_id and r.status='active'
    for update of i;

  if not exists(select 1 from public.stock_reservations r
      where r.order_id=p_order_id and r.status='active')
    or exists(select 1 from public.stock_reservations r
      left join public.inventory i on i.warehouse_id=r.warehouse_id and i.variant_id=r.variant_id
      where r.order_id=p_order_id and r.status='active'
        and (r.expires_at is null or r.expires_at<=v_now or i.variant_id is null
          or i.on_hand<r.quantity or i.reserved<r.quantity)) then
    v_stock_review:=true;
  end if;

  if not v_stock_review then
    for v_reservation in select * from public.stock_reservations
      where order_id=p_order_id and status='active' order by id for update
    loop
      update public.inventory set on_hand=on_hand-v_reservation.quantity,
        reserved=reserved-v_reservation.quantity,updated_at=v_now
       where warehouse_id=v_reservation.warehouse_id and variant_id=v_reservation.variant_id
         and on_hand>=v_reservation.quantity and reserved>=v_reservation.quantity;
      if not found then raise exception 'Inventory changed during payment recording. Please reconcile this paid order.'; end if;
      update public.stock_reservations set status='committed',committed_at=v_now where id=v_reservation.id;
      insert into public.inventory_movements(
        warehouse_id,variant_id,movement_type,quantity_change,reserved_change,
        reference_type,reference_id,notes,created_by
      ) values(v_reservation.warehouse_id,v_reservation.variant_id,'sale',
        -v_reservation.quantity,-v_reservation.quantity,'order',p_order_id,
        'Stock deducted after PayPal payment was verified',null);
    end loop;
  end if;

  insert into public.payments(
    order_id,provider,provider_order_id,provider_payment_id,status,amount,currency,
    payment_method_type,idempotency_key,paid_at,stock_review_required
  ) values(p_order_id,'paypal',trim(p_paypal_order_id),trim(p_capture_id),'paid',
    round(p_amount,2),upper(trim(p_currency)),'paypal','paypal-capture:'||trim(p_capture_id),v_now,v_stock_review);

  v_new_status:='paid'::public.order_status;
  update public.orders set status=v_new_status,paid_at=v_now,
    internal_note=case when v_stock_review
      then left(concat_ws(E'\\n',nullif(internal_note,''),'PayPal payment received. Stock reservation requires manual review before fulfilment.'),2000)
      else internal_note end
  where id=p_order_id;

  insert into public.order_status_history(order_id,old_status,new_status,note,changed_by)
  values(p_order_id,'pending_payment',v_new_status,
    case when v_stock_review then 'PayPal payment verified. Stock requires manual review before fulfilment.'
      else 'PayPal payment verified automatically.' end,null);

  insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,old_values,new_values)
  values(null,'order.paypal_payment_captured','order',p_order_id,
    jsonb_build_object('status','pending_payment'),
    jsonb_build_object('status',v_new_status,'provider','paypal','provider_order_id',trim(p_paypal_order_id),
      'capture_id',trim(p_capture_id),'amount',round(p_amount,2),'currency',upper(trim(p_currency)),
      'stock_review_required',v_stock_review));

  if v_stock_review then
    update public.order_email_outbox
      set payload=payload || pg_catalog.jsonb_build_object('stockReviewRequired',true)
      where order_id=p_order_id and event_type='payment_received' and recipient_type='customer';
    v_customer_name:=coalesce(v_order.shipping_address_snapshot->>'recipient_name','');
    v_payload:=pg_catalog.jsonb_build_object('eventType','payment_received',
      'orderNumber',v_order.order_number,'customerName',v_customer_name,
      'customerEmail',v_order.customer_email,'subtotal',v_order.subtotal,'currency',v_order.currency,
      'shippingAmount',v_order.shipping_amount,'shippingMethod',v_order.shipping_method_name,
      'stockReviewRequired',true);
    insert into public.order_email_outbox(order_id,event_type,recipient_type,recipient_email,payload)
    values(p_order_id,'payment_received','staff','info@jinqaya.com',v_payload)
    on conflict(order_id,event_type,recipient_type) do nothing;
  end if;

  return jsonb_build_object('order_id',p_order_id,'status',v_new_status,
    'already_recorded',false,'stock_review_required',v_stock_review);
end;
$function$;

revoke all on function public.record_paypal_order_payment(uuid,text,text,numeric,text) from public,anon,authenticated;
grant execute on function public.record_paypal_order_payment(uuid,text,text,numeric,text) to service_role;
