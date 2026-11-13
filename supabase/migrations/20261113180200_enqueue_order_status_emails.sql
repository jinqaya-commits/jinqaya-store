-- Enqueue customer and staff notifications for order status transitions.
-- Existing rows are not touched; only future status changes create notifications.
create or replace function public.enqueue_order_status_emails()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event_type text;
  v_payload jsonb;
  v_tracking_number text;
  v_tracking_url text;
  v_stock_review_required boolean := false;
  v_customer_name text := coalesce(new.shipping_address_snapshot->>'recipient_name', '');
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  v_event_type := case new.status::text
    when 'pending_payment' then 'quote_confirmed'
    when 'paid' then 'payment_received'
    when 'shipped' then 'shipped'
    when 'delivered' then 'delivered'
    when 'cancelled' then 'cancelled'
    else null
  end;
  if v_event_type is null then
    return new;
  end if;

  if v_event_type = 'shipped' then
    select s.tracking_number, s.tracking_url
      into v_tracking_number, v_tracking_url
      from public.shipments s
     where s.order_id = new.id
     order by s.created_at desc
     limit 1;
  end if;

  if v_event_type = 'payment_received' then
    select coalesce(bool_or(p.stock_review_required), false)
      into v_stock_review_required
      from public.payments p
     where p.order_id = new.id and p.status = 'paid';
  end if;

  v_payload := pg_catalog.jsonb_build_object(
    'eventType', v_event_type,
    'orderNumber', new.order_number,
    'customerName', v_customer_name,
    'customerEmail', new.customer_email,
    'subtotal', new.subtotal,
    'currency', new.currency,
    'shippingAmount', new.shipping_amount,
    'shippingMethod', new.shipping_method_name,
    'trackingNumber', v_tracking_number,
    'trackingUrl', v_tracking_url,
    'stockReviewRequired', v_stock_review_required
  );

  if new.customer_email is not null
     and length(pg_catalog.btrim(new.customer_email)) between 5 and 254 then
    insert into public.order_email_outbox(
      order_id, event_type, recipient_type, recipient_email, payload
    ) values (
      new.id, v_event_type, 'customer', pg_catalog.btrim(new.customer_email), v_payload
    ) on conflict (order_id, event_type, recipient_type) do nothing;
  end if;

  insert into public.order_email_outbox(
    order_id, event_type, recipient_type, recipient_email, payload
  ) values (
    new.id, v_event_type, 'staff', 'jinqaya@gmail.com', v_payload
  ) on conflict (order_id, event_type, recipient_type) do nothing;

  return new;
end;
$function$;

revoke all on function public.enqueue_order_status_emails() from public, anon, authenticated;

drop trigger if exists orders_enqueue_status_emails on public.orders;
create trigger orders_enqueue_status_emails
after update of status on public.orders
for each row
when (old.status is distinct from new.status)
execute function public.enqueue_order_status_emails();
