-- Dual checkout paths with server-authoritative shipping calculation.
-- direct_payment: reserve stock and use USD 50 for 1-2 total units, otherwise 50% of subtotal.
-- manual_quote: do not reserve stock or collect payment; leave the order on_hold for staff review.
DO $migration$
DECLARE
  v_definition text;
  v_old text;
  v_new text;
BEGIN
  v_definition := pg_catalog.pg_get_functiondef(
    'public.submit_guest_order(text,jsonb,jsonb,jsonb,text,text)'::regprocedure
  );

  v_old := 'CREATE OR REPLACE FUNCTION public.submit_guest_order(p_idempotency_key text, p_customer jsonb, p_shipping_address jsonb, p_items jsonb, p_customer_note text DEFAULT NULL::text, p_honeypot text DEFAULT ''''::text)';
  v_new := 'CREATE OR REPLACE FUNCTION public.submit_guest_order(p_idempotency_key text, p_customer jsonb, p_shipping_address jsonb, p_items jsonb, p_customer_note text DEFAULT NULL::text, p_honeypot text DEFAULT ''''::text, p_checkout_mode text DEFAULT ''direct_payment''::text)';
  IF pg_catalog.position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate the existing guest checkout function signature; migration stopped.';
  END IF;
  v_definition := pg_catalog.replace(v_definition, v_old, v_new);

  v_old := ' v_count integer := 0;';
  v_new := ' v_count integer := 0;
 v_total_units integer := 0;';
  IF pg_catalog.position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate guest checkout quantity declaration; migration stopped.';
  END IF;
  v_definition := pg_catalog.replace(v_definition, v_old, v_new);

  v_old := 'BEGIN
 IF coalesce(p_honeypot,'''') <> '''' THEN RAISE EXCEPTION ''Unable to submit checkout request''; END IF;';
  v_new := 'BEGIN
 IF coalesce(p_checkout_mode,''direct_payment'') NOT IN (''direct_payment'',''manual_quote'') THEN RAISE EXCEPTION ''Invalid checkout option.''; END IF;
 IF coalesce(p_honeypot,'''') <> '''' THEN RAISE EXCEPTION ''Unable to submit checkout request''; END IF;';
  IF pg_catalog.position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate guest checkout validation block; migration stopped.';
  END IF;
  v_definition := pg_catalog.replace(v_definition, v_old, v_new);

  v_old := '  v_quantity := (v_item->>''quantity'')::integer;';
  v_new := '  v_quantity := (v_item->>''quantity'')::integer;
  v_total_units := v_total_units + v_quantity;';
  IF pg_catalog.position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate guest checkout item quantity calculation; migration stopped.';
  END IF;
  v_definition := pg_catalog.replace(v_definition, v_old, v_new);

  v_old := ' -- Lock and plan one warehouse row per variant in a stable order. No inventory is
 -- changed unless every requested variant can be fully reserved.';
  v_new := ' IF p_checkout_mode = ''direct_payment'' THEN
 -- Lock and plan one warehouse row per variant in a stable order. No inventory is
 -- changed unless every requested variant can be fully reserved.';
  IF pg_catalog.position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate guest checkout stock reservation block; migration stopped.';
  END IF;
  v_definition := pg_catalog.replace(v_definition, v_old, v_new);

  v_old := ' END IF;

 UPDATE public.orders SET currency=coalesce(v_currency,''USD''),';
  v_new := ' END IF;
 ELSE
   v_stock_ready := false;
 END IF;

 UPDATE public.orders SET currency=coalesce(v_currency,''USD''),';
  IF pg_catalog.position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate the end of guest checkout stock reservation block; migration stopped.';
  END IF;
  v_definition := pg_catalog.replace(v_definition, v_old, v_new);

  v_old := ' UPDATE public.orders SET currency=coalesce(v_currency,''USD''),
  subtotal=v_subtotal,
  shipping_amount=round(v_subtotal*0.50,2),
  total_amount=v_subtotal+round(v_subtotal*0.50,2),
  shipping_method_name=''Shipping (50% of merchandise subtotal)'',
  shipping_quote_snapshot=jsonb_build_object(
   ''status'',''confirmed'',
   ''calculation'',''50_percent_of_subtotal'',
   ''rate'',0.50,
   ''amount'',round(v_subtotal*0.50,2),
   ''destination_country_code'',v_address->>''country_code''
  )
 WHERE id=v_order_id;';
  v_new := ' UPDATE public.orders SET currency=coalesce(v_currency,''USD''),
  subtotal=v_subtotal,
  shipping_amount=CASE WHEN p_checkout_mode=''direct_payment'' THEN CASE WHEN v_total_units<=2 THEN 50.00 ELSE round(v_subtotal*0.50,2) END ELSE 0 END,
  total_amount=v_subtotal+CASE WHEN p_checkout_mode=''direct_payment'' THEN CASE WHEN v_total_units<=2 THEN 50.00 ELSE round(v_subtotal*0.50,2) END ELSE 0 END,
  shipping_method_name=CASE WHEN p_checkout_mode=''direct_payment'' THEN CASE WHEN v_total_units<=2 THEN ''Standard shipping (USD 50 for 1-2 items)'' ELSE ''Standard shipping (50% of merchandise subtotal)'' END ELSE NULL END,
  shipping_quote_snapshot=CASE WHEN p_checkout_mode=''direct_payment'' THEN jsonb_build_object(
   ''status'',''confirmed'',
   ''checkout_mode'',''direct_payment'',
   ''calculation'',CASE WHEN v_total_units<=2 THEN ''flat_50_usd_for_1_to_2_items'' ELSE ''50_percent_of_subtotal_for_3_plus_items'' END,
   ''rate'',CASE WHEN v_total_units<=2 THEN NULL ELSE 0.50 END,
   ''amount'',CASE WHEN v_total_units<=2 THEN 50.00 ELSE round(v_subtotal*0.50,2) END,
   ''total_units'',v_total_units,
   ''destination_country_code'',v_address->>''country_code''
  ) ELSE jsonb_build_object(
   ''status'',''quote_required'',
   ''checkout_mode'',''manual_quote'',
   ''message'',''Shipping will be confirmed by our team before payment.'',
   ''destination_country_code'',v_address->>''country_code''
  ) END
 WHERE id=v_order_id;';
  IF pg_catalog.position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate guest checkout shipping calculation block; migration stopped.';
  END IF;
  v_definition := pg_catalog.replace(v_definition, v_old, v_new);

  v_old := ' RETURN jsonb_build_object(
  ''order_id'',v_order_id,''order_number'',v_order_number,
  ''status'',case when v_stock_ready then ''pending_payment'' else ''on_hold'' end,
  ''subtotal'',v_subtotal,''shipping_amount'',round(v_subtotal*0.50,2),
  ''total_amount'',v_subtotal+round(v_subtotal*0.50,2),
  ''shipping_status'',''confirmed'',''payment_status'',''not_started'',
  ''payment_ready'',v_stock_ready,''currency'',coalesce(v_currency,''USD'')
 );';
  v_new := ' RETURN jsonb_build_object(
  ''order_id'',v_order_id,''order_number'',v_order_number,
  ''status'',CASE WHEN p_checkout_mode=''direct_payment'' AND v_stock_ready THEN ''pending_payment'' ELSE ''on_hold'' END,
  ''subtotal'',v_subtotal,
  ''shipping_amount'',CASE WHEN p_checkout_mode=''direct_payment'' THEN CASE WHEN v_total_units<=2 THEN 50.00 ELSE round(v_subtotal*0.50,2) END ELSE 0 END,
  ''total_amount'',v_subtotal+CASE WHEN p_checkout_mode=''direct_payment'' THEN CASE WHEN v_total_units<=2 THEN 50.00 ELSE round(v_subtotal*0.50,2) END ELSE 0 END,
  ''shipping_status'',CASE WHEN p_checkout_mode=''direct_payment'' THEN ''confirmed'' ELSE ''quote_required'' END,
  ''payment_status'',''not_started'',
  ''payment_ready'',(p_checkout_mode=''direct_payment'' AND v_stock_ready),
  ''checkout_mode'',p_checkout_mode,
  ''currency'',coalesce(v_currency,''USD'')
 );';
  IF pg_catalog.position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate guest checkout response block; migration stopped.';
  END IF;
  v_definition := pg_catalog.replace(v_definition, v_old, v_new);

  v_old := '''payment_status'',''not_started'',''payment_ready'',(o.status=''pending_payment''),''currency'',o.currency';
  v_new := '''payment_status'',''not_started'',''payment_ready'',(o.status=''pending_payment''),''checkout_mode'',coalesce(o.shipping_quote_snapshot->>''checkout_mode'',''direct_payment''),''currency'',o.currency';
  IF pg_catalog.position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate guest checkout idempotency response; migration stopped.';
  END IF;
  v_definition := pg_catalog.replace(v_definition, v_old, v_new);

  EXECUTE v_definition;
END
$migration$;

REVOKE ALL ON FUNCTION public.submit_guest_order(text,jsonb,jsonb,jsonb,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_guest_order(text,jsonb,jsonb,jsonb,text,text,text) TO service_role;
