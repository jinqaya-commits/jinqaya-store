-- Route new-order staff notifications to the official JINQAYA contact inbox.
-- The previous trigger hard-coded an unrelated Gmail address.
create or replace function public.enqueue_guest_order_emails()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_customer_name text;
  v_payload jsonb;
begin
  if new.checkout_idempotency_key is null then
    return new;
  end if;

  v_customer_name := coalesce(new.shipping_address_snapshot->>'recipient_name', '');
  v_payload := pg_catalog.jsonb_build_object(
    'eventType', 'order_received',
    'orderNumber', new.order_number,
    'customerName', v_customer_name,
    'customerEmail', new.customer_email,
    'subtotal', new.subtotal,
    'currency', new.currency
  );

  insert into public.order_email_outbox(
    order_id, event_type, recipient_type, recipient_email, payload
  )
  values
    (new.id, 'order_received', 'customer', new.customer_email, v_payload),
    (new.id, 'order_received', 'staff', 'info@jinqaya.com', v_payload)
  on conflict (order_id, event_type, recipient_type) do nothing;

  return new;
end;
$function$;
