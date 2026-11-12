-- Checkout freight policy and server-enforced destination restrictions.
-- This migration is intended for the isolated Preview/test database first.
create table if not exists public.checkout_country_restrictions (
  country_code text primary key check (country_code ~ '^[A-Z]{2}$'),
  country_name text not null,
  reason text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.checkout_country_restrictions(country_code,country_name,reason,is_active)
values
  ('KR','South Korea','Destination excluded by store shipping policy',true),
  ('BR','Brazil','Destination excluded by store shipping policy',true)
on conflict(country_code) do update
set country_name=excluded.country_name,
    reason=excluded.reason,
    is_active=true,
    updated_at=now();

alter table public.checkout_country_restrictions enable row level security;
revoke all on public.checkout_country_restrictions from public, anon, authenticated;
grant select, insert, update, delete on public.checkout_country_restrictions to service_role;

do $migration$
declare
  v_definition text;
  v_old text;
  v_new text;
begin
  v_definition := pg_get_functiondef(
    'public.submit_guest_order(text,jsonb,jsonb,jsonb,text,text)'::regprocedure
  );

  v_old := $old$
 SELECT jsonb_build_object('order_id',o.id,'order_number',o.order_number,'status',o.status,'total',o.total_amount,'currency',o.currency)
 INTO v_existing FROM public.orders o WHERE o.checkout_idempotency_key=p_idempotency_key AND lower(o.customer_email)=v_email LIMIT 1;
$old$;
  v_new := $new$
 SELECT jsonb_build_object(
  'order_id',o.id,'order_number',o.order_number,'status',o.status,
  'subtotal',o.subtotal,'shipping_amount',o.shipping_amount,'total_amount',o.total_amount,
  'total',o.total_amount,'shipping_status',coalesce(o.shipping_quote_snapshot->>'status','unknown'),
  'payment_status','not_started','payment_ready',(o.status='pending_payment'),'currency',o.currency
 )
 INTO v_existing FROM public.orders o WHERE o.checkout_idempotency_key=p_idempotency_key AND lower(o.customer_email)=v_email LIMIT 1;
$new$;
  if position(v_old in v_definition)=0 then
    raise exception 'Could not locate guest checkout idempotency response block; migration stopped.';
  end if;
  v_definition := replace(v_definition,v_old,v_new);

  v_old := $old$
 IF length(v_address->>'country_code')<>2 OR length(v_address->>'country')<2 OR length(v_address->>'country')>100
 OR length(v_address->>'city')<1 OR length(v_address->>'city')>100 OR length(v_address->>'address_line1')<3
 OR length(v_address->>'address_line1')>200 OR length(coalesce(v_address->>'address_line2',''))>200
 OR length(coalesce(v_address->>'state_region',''))>100 OR length(coalesce(v_address->>'postal_code',''))>30 THEN
  RAISE EXCEPTION 'Please complete the shipping address.';
 END IF;
$old$;
  v_new := $new$
 IF length(v_address->>'country_code')<>2 OR length(v_address->>'country')<2 OR length(v_address->>'country')>100
 OR length(v_address->>'city')<1 OR length(v_address->>'city')>100 OR length(v_address->>'address_line1')<3
 OR length(v_address->>'address_line1')>200 OR length(coalesce(v_address->>'address_line2',''))>200
 OR length(coalesce(v_address->>'state_region',''))>100 OR length(coalesce(v_address->>'postal_code',''))>30 THEN
  RAISE EXCEPTION 'Please complete the shipping address.';
 END IF;

 IF EXISTS (
   SELECT 1 FROM public.checkout_country_restrictions r
   WHERE r.country_code = v_address->>'country_code' AND r.is_active = true
 ) THEN
  RAISE EXCEPTION 'We do not currently ship to this destination.';
 END IF;
$new$;
  if position(v_old in v_definition)=0 then
    raise exception 'Could not locate guest checkout address validation block; migration stopped.';
  end if;
  v_definition := replace(v_definition,v_old,v_new);

  v_old := $old$
 UPDATE public.orders SET currency=coalesce(v_currency,'USD'),subtotal=v_subtotal,total_amount=v_subtotal,
  shipping_quote_snapshot=jsonb_build_object('status','quote_required','message','Shipping cost and delivery options require confirmation.',
  'destination_country_code',v_address->>'country_code') WHERE id=v_order_id;
 RETURN jsonb_build_object('order_id',v_order_id,'order_number',v_order_number,'status','on_hold','subtotal',v_subtotal,
  'shipping_status','quote_required','payment_status','not_started','currency',coalesce(v_currency,'USD'));
$old$;
  v_new := $new$
 UPDATE public.orders SET currency=coalesce(v_currency,'USD'),
  subtotal=v_subtotal,
  shipping_amount=round(v_subtotal*0.50,2),
  total_amount=v_subtotal+round(v_subtotal*0.50,2),
  shipping_method_name='Estimated shipping (50% of merchandise subtotal)',
  shipping_quote_snapshot=jsonb_build_object(
   'status','estimated',
   'calculation','50_percent_of_subtotal',
   'rate',0.50,
   'amount',round(v_subtotal*0.50,2),
   'destination_country_code',v_address->>'country_code'
  )
 WHERE id=v_order_id;
 RETURN jsonb_build_object(
  'order_id',v_order_id,'order_number',v_order_number,'status','on_hold',
  'subtotal',v_subtotal,'shipping_amount',round(v_subtotal*0.50,2),
  'total_amount',v_subtotal+round(v_subtotal*0.50,2),
  'shipping_status','estimated','payment_status','not_started','currency',coalesce(v_currency,'USD')
 );
$new$;
  if position(v_old in v_definition)=0 then
    raise exception 'Could not locate guest checkout shipping calculation block; migration stopped.';
  end if;
  v_definition := replace(v_definition,v_old,v_new);
  execute v_definition;
end
$migration$;
