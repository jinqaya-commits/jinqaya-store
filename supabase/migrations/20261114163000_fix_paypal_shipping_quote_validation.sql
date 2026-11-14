-- Align PayPal capture validation with the confirmed checkout shipping quote.
-- The previous guard incorrectly required every order's shipping to equal 50%
-- of subtotal, which rejected the flat $50 rule for 1–2 items and ignored
-- tax/discount components in the final total.
CREATE OR REPLACE FUNCTION public.record_paypal_order_payment(
  p_order_id uuid, p_paypal_order_id text, p_capture_id text, p_amount numeric, p_currency text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_order public.orders%rowtype;
  v_reservation public.stock_reservations%rowtype;
  v_existing public.payments%rowtype;
  v_now timestamptz := pg_catalog.now();
  v_stock_review boolean := false;
  v_new_status public.order_status;
  v_customer_name text;
  v_payload jsonb;
BEGIN
  IF p_order_id IS NULL OR coalesce(length(trim(p_paypal_order_id)),0) < 5
    OR coalesce(length(trim(p_capture_id)),0) < 5 OR p_amount IS NULL OR p_amount <= 0
    OR upper(trim(coalesce(p_currency,''))) !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Invalid PayPal payment details.';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found.'; END IF;

  SELECT * INTO v_existing FROM public.payments
   WHERE provider = 'paypal'
     AND (provider_order_id = trim(p_paypal_order_id) OR provider_payment_id = trim(p_capture_id))
   LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    IF v_existing.order_id = p_order_id
      AND v_existing.provider_order_id = trim(p_paypal_order_id)
      AND v_existing.provider_payment_id = trim(p_capture_id)
      AND v_existing.status = 'paid'
      AND round(v_existing.amount,2) = round(p_amount,2)
      AND upper(trim(v_existing.currency)) = upper(trim(p_currency)) THEN
      RETURN jsonb_build_object('order_id',p_order_id,'status',v_order.status,
        'already_recorded',true,'stock_review_required',v_existing.stock_review_required);
    END IF;
    RAISE EXCEPTION 'This PayPal transaction has already been used.';
  END IF;

  IF v_order.status <> 'pending_payment' THEN RAISE EXCEPTION 'This order is not awaiting payment.'; END IF;
  IF coalesce(v_order.shipping_quote_snapshot->>'status','') <> 'confirmed'
    OR coalesce(v_order.shipping_quote_snapshot->>'checkout_mode','') NOT IN ('pay_now','request_quote')
    OR round(coalesce(v_order.shipping_amount,0),2)
       <> round(coalesce((v_order.shipping_quote_snapshot->>'amount')::numeric,-1),2)
    OR round(v_order.total_amount,2)
       <> round(coalesce(v_order.subtotal,0) + coalesce(v_order.shipping_amount,0)
          + coalesce(v_order.tax_amount,0) - coalesce(v_order.discount_amount,0),2) THEN
    RAISE EXCEPTION 'The order shipping quote or final total is not confirmed.';
  END IF;
  IF round(v_order.total_amount,2) <> round(p_amount,2)
    OR upper(trim(v_order.currency)) <> upper(trim(p_currency)) THEN
    RAISE EXCEPTION 'The captured amount does not match the confirmed order total.';
  END IF;

  PERFORM 1 FROM public.stock_reservations r
   WHERE r.order_id = p_order_id AND r.status = 'active' FOR UPDATE;
  PERFORM 1 FROM public.inventory i
   JOIN public.stock_reservations r
     ON i.warehouse_id = r.warehouse_id AND i.variant_id = r.variant_id
   WHERE r.order_id = p_order_id AND r.status = 'active' FOR UPDATE OF i;

  -- A payment may be captured even if the stock hold is missing, expired, partial,
  -- excessive, or contains a variant not present in the order. Never commit partial stock.
  IF NOT EXISTS (
       SELECT 1 FROM public.stock_reservations r
       WHERE r.order_id = p_order_id AND r.status = 'active'
     )
     OR EXISTS (
       SELECT 1 FROM public.order_items oi
       WHERE oi.order_id = p_order_id AND oi.variant_id IS NULL
     )
     OR EXISTS (
       SELECT 1
       FROM (
         SELECT variant_id, sum(quantity)::integer AS quantity
         FROM public.order_items WHERE order_id = p_order_id GROUP BY variant_id
       ) oi
       LEFT JOIN (
         SELECT variant_id, sum(quantity)::integer AS quantity
         FROM public.stock_reservations
         WHERE order_id = p_order_id AND status = 'active'
         GROUP BY variant_id
       ) sr USING (variant_id)
       WHERE coalesce(sr.quantity,0) <> oi.quantity
     )
     OR EXISTS (
       SELECT 1 FROM public.stock_reservations r
       LEFT JOIN public.order_items oi
         ON oi.order_id = p_order_id AND oi.variant_id = r.variant_id
       WHERE r.order_id = p_order_id AND r.status = 'active'
         AND oi.variant_id IS NULL
     )
     OR EXISTS (
       SELECT 1 FROM public.stock_reservations r
       LEFT JOIN public.inventory i
         ON i.warehouse_id = r.warehouse_id AND i.variant_id = r.variant_id
       WHERE r.order_id = p_order_id AND r.status = 'active'
         AND (r.expires_at IS NULL OR r.expires_at <= v_now
           OR i.variant_id IS NULL OR i.on_hand < r.quantity OR i.reserved < r.quantity)
     ) THEN
    v_stock_review := true;
  END IF;

  IF NOT v_stock_review THEN
    FOR v_reservation IN
      SELECT * FROM public.stock_reservations
      WHERE order_id = p_order_id AND status = 'active'
      ORDER BY id FOR UPDATE
    LOOP
      UPDATE public.inventory
         SET on_hand = on_hand - v_reservation.quantity,
             reserved = reserved - v_reservation.quantity,
             updated_at = v_now
       WHERE warehouse_id = v_reservation.warehouse_id
         AND variant_id = v_reservation.variant_id
         AND on_hand >= v_reservation.quantity
         AND reserved >= v_reservation.quantity;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory changed during payment recording. Please reconcile this paid order.';
      END IF;
      UPDATE public.stock_reservations
         SET status = 'committed', committed_at = v_now, updated_at = v_now
       WHERE id = v_reservation.id;
      INSERT INTO public.inventory_movements(
        warehouse_id,variant_id,movement_type,quantity_change,reserved_change,
        reference_type,reference_id,notes,created_by
      ) VALUES (
        v_reservation.warehouse_id,v_reservation.variant_id,'sale',
        -v_reservation.quantity,-v_reservation.quantity,'order',p_order_id,
        'Stock deducted after PayPal payment was verified',null
      );
    END LOOP;
  END IF;

  INSERT INTO public.payments(
    order_id,provider,provider_order_id,provider_payment_id,status,amount,currency,
    payment_method_type,idempotency_key,paid_at,stock_review_required
  ) VALUES (
    p_order_id,'paypal',trim(p_paypal_order_id),trim(p_capture_id),'paid',
    round(p_amount,2),upper(trim(p_currency)),'paypal',
    'paypal-capture:'||trim(p_capture_id),v_now,v_stock_review
  );

  v_new_status := 'paid'::public.order_status;
  UPDATE public.orders
     SET status = v_new_status, paid_at = v_now,
         internal_note = CASE WHEN v_stock_review
           THEN pg_catalog.left(pg_catalog.concat_ws(' | ',nullif(internal_note,''),
             'PayPal payment received. Stock reservation requires manual review before fulfilment.'),2000)
           ELSE internal_note END
   WHERE id = p_order_id;

  INSERT INTO public.order_status_history(order_id,old_status,new_status,note,changed_by)
  VALUES (p_order_id,'pending_payment',v_new_status,
    CASE WHEN v_stock_review
      THEN 'PayPal payment verified. Stock requires manual review before fulfilment.'
      ELSE 'PayPal payment verified automatically.' END,null);

  INSERT INTO public.activity_logs(actor_user_id,action,entity_type,entity_id,old_values,new_values)
  VALUES (null,'order.paypal_payment_captured','order',p_order_id,
    jsonb_build_object('status','pending_payment'),
    jsonb_build_object('status',v_new_status,'provider','paypal',
      'provider_order_id',trim(p_paypal_order_id),'capture_id',trim(p_capture_id),
      'amount',round(p_amount,2),'currency',upper(trim(p_currency)),
      'stock_review_required',v_stock_review));

  IF v_stock_review THEN
    UPDATE public.order_email_outbox
       SET payload = payload || pg_catalog.jsonb_build_object('stockReviewRequired',true)
     WHERE order_id = p_order_id AND event_type = 'payment_received'
       AND recipient_type = 'customer';
  END IF;

  v_customer_name := coalesce(v_order.shipping_address_snapshot->>'recipient_name','');
  v_payload := pg_catalog.jsonb_build_object('eventType','payment_received',
    'orderNumber',v_order.order_number,'customerName',v_customer_name,
    'customerEmail',v_order.customer_email,'subtotal',v_order.subtotal,
    'currency',v_order.currency,'shippingAmount',v_order.shipping_amount,
    'shippingMethod',v_order.shipping_method_name,'stockReviewRequired',v_stock_review);
  INSERT INTO public.order_email_outbox(order_id,event_type,recipient_type,recipient_email,payload)
  VALUES (p_order_id,'payment_received','staff','info@jinqaya.com',v_payload)
  ON CONFLICT(order_id,event_type,recipient_type) DO NOTHING;

  RETURN jsonb_build_object('order_id',p_order_id,'status',v_new_status,
    'already_recorded',false,'stock_review_required',v_stock_review);
END;
$function$;

REVOKE ALL ON FUNCTION public.record_paypal_order_payment(uuid,text,text,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_paypal_order_payment(uuid,text,text,numeric,text) TO service_role;
