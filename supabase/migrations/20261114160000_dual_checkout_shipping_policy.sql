-- Dual checkout: immediate payment or request a manual shipping quote.
-- All prices are re-read from the database by submit_guest_order; client estimates are informational only.
CREATE OR REPLACE FUNCTION public.submit_guest_order_with_mode(
  p_idempotency_key text,
  p_customer jsonb,
  p_shipping_address jsonb,
  p_items jsonb,
  p_customer_note text,
  p_honeypot text,
  p_checkout_mode text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_result jsonb;
  v_order_id uuid;
  v_order public.orders%rowtype;
  v_item record;
  v_inventory public.inventory%rowtype;
  v_now timestamptz := pg_catalog.now();
  v_units integer := 0;
  v_shipping numeric(12,2);
  v_reserved integer := 0;
  v_stock_ok boolean := true;
BEGIN
  IF p_checkout_mode NOT IN ('pay_now','request_quote') THEN
    RAISE EXCEPTION 'Invalid checkout option.';
  END IF;

  v_result := public.submit_guest_order(
    p_idempotency_key, p_customer, p_shipping_address, p_items, p_customer_note, p_honeypot
  );
  v_order_id := nullif(v_result->>'order_id','')::uuid;
  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'The order could not be created.';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found.'; END IF;

  IF v_order.shipping_quote_snapshot ? 'checkout_mode'
     AND v_order.shipping_quote_snapshot->>'checkout_mode' <> p_checkout_mode THEN
    RAISE EXCEPTION 'This checkout request was already submitted using a different option. Please refresh checkout.';
  END IF;

  IF p_checkout_mode = 'request_quote' THEN
    IF v_order.status = 'on_hold' THEN
      UPDATE public.orders
         SET shipping_quote_snapshot = coalesce(shipping_quote_snapshot,'{}'::jsonb)
             || jsonb_build_object('checkout_mode','request_quote'),
             updated_at = v_now
       WHERE id = v_order_id;
    END IF;
    SELECT * INTO v_order FROM public.orders WHERE id = v_order_id;
    RETURN jsonb_build_object(
      'order_id',v_order.id,'order_number',v_order.order_number,'status',v_order.status,
      'subtotal',v_order.subtotal,'shipping_amount',v_order.shipping_amount,
      'total_amount',v_order.total_amount,'shipping_status',coalesce(v_order.shipping_quote_snapshot->>'status','quote_required'),
      'payment_status','not_started','payment_ready',false,'currency',v_order.currency,
      'checkout_mode','request_quote'
    );
  END IF;

  IF v_order.status = 'pending_payment'
     AND v_order.shipping_quote_snapshot->>'checkout_mode' = 'pay_now'
     AND v_order.shipping_quote_snapshot->>'status' = 'confirmed' THEN
    RETURN jsonb_build_object(
      'order_id',v_order.id,'order_number',v_order.order_number,'status',v_order.status,
      'subtotal',v_order.subtotal,'shipping_amount',v_order.shipping_amount,
      'total_amount',v_order.total_amount,'shipping_status','confirmed',
      'payment_status','not_started','payment_ready',true,'currency',v_order.currency,
      'checkout_mode','pay_now'
    );
  END IF;

  IF v_order.status <> 'on_hold' THEN
    RAISE EXCEPTION 'This order is no longer eligible for immediate checkout.';
  END IF;

  SELECT coalesce(sum(quantity),0)::integer INTO v_units
    FROM public.order_items WHERE order_id = v_order_id;
  v_shipping := CASE WHEN v_units <= 2 THEN 50.00 ELSE round(coalesce(v_order.subtotal,0) * 0.50,2) END;

  -- A nested block makes all reservations atomic. If any line cannot be reserved,
  -- the order remains safely on hold and the customer can still request a quote.
  BEGIN
    FOR v_item IN
      SELECT oi.variant_id, sum(oi.quantity)::integer AS quantity
        FROM public.order_items oi
       WHERE oi.order_id = v_order_id
       GROUP BY oi.variant_id
       ORDER BY oi.variant_id
    LOOP
      IF v_item.variant_id IS NULL THEN
        RAISE EXCEPTION 'An order item has no inventory variant.';
      END IF;

      SELECT i.* INTO v_inventory
        FROM public.inventory i
       WHERE i.variant_id = v_item.variant_id
         AND i.on_hand - i.reserved - i.damaged >= v_item.quantity
       ORDER BY i.warehouse_id
       LIMIT 1
       FOR UPDATE;

      IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient stock.'; END IF;

      UPDATE public.inventory
         SET reserved = reserved + v_item.quantity, updated_at = v_now
       WHERE id = v_inventory.id
         AND on_hand - reserved - damaged >= v_item.quantity;
      IF NOT FOUND THEN RAISE EXCEPTION 'Inventory changed during reservation.'; END IF;

      INSERT INTO public.stock_reservations(order_id,warehouse_id,variant_id,quantity,status,expires_at)
      VALUES(v_order_id,v_inventory.warehouse_id,v_item.variant_id,v_item.quantity,'active',v_now + interval '48 hours');

      INSERT INTO public.inventory_movements(
        warehouse_id,variant_id,movement_type,quantity_change,reserved_change,
        reference_type,reference_id,notes,created_by
      ) VALUES(
        v_inventory.warehouse_id,v_item.variant_id,'reservation',0,v_item.quantity,
        'order',v_order_id,'Stock reserved for immediate checkout.',NULL
      );
      v_reserved := v_reserved + v_item.quantity;
    END LOOP;

    UPDATE public.orders
       SET status = 'pending_payment',
           shipping_amount = v_shipping,
           total_amount = round(coalesce(subtotal,0) + v_shipping + coalesce(tax_amount,0) - coalesce(discount_amount,0),2),
           shipping_method_name = 'Standard shipping estimate',
           shipping_quote_snapshot = jsonb_build_object(
             'status','confirmed',
             'checkout_mode','pay_now',
             'calculation',CASE WHEN v_units <= 2 THEN 'flat_50_for_1_or_2_units' ELSE '50_percent_of_subtotal_for_3_plus_units' END,
             'units',v_units,
             'amount',v_shipping,
             'destination_country_code',shipping_address_snapshot->>'country_code'
           ),
           updated_at = v_now
     WHERE id = v_order_id;

    INSERT INTO public.order_status_history(order_id,old_status,new_status,note)
    VALUES(v_order_id,'on_hold','pending_payment','Stock reserved for 48 hours. Shipping estimate confirmed; awaiting PayPal payment.');
  EXCEPTION WHEN OTHERS THEN
    v_stock_ok := false;
  END;

  SELECT * INTO v_order FROM public.orders WHERE id = v_order_id;
  RETURN jsonb_build_object(
    'order_id',v_order.id,'order_number',v_order.order_number,'status',v_order.status,
    'subtotal',v_order.subtotal,'shipping_amount',v_order.shipping_amount,
    'total_amount',v_order.total_amount,
    'shipping_status',coalesce(v_order.shipping_quote_snapshot->>'status','quote_required'),
    'payment_status','not_started',
    'payment_ready',(v_stock_ok AND v_order.status = 'pending_payment'),
    'currency',v_order.currency,
    'checkout_mode','pay_now',
    'stock_review_required',NOT v_stock_ok
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_guest_order_with_mode(text,jsonb,jsonb,jsonb,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_guest_order_with_mode(text,jsonb,jsonb,jsonb,text,text,text) TO service_role;
