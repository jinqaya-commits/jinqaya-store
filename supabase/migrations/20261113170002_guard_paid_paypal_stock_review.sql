-- Ensure PayPal captures with incomplete stock holds are flagged for review.
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
    OR round(coalesce(v_order.shipping_amount,0),2) <> round(coalesce(v_order.subtotal,0)*0.50,2)
    OR round(v_order.total_amount,2) <> round(v_order.subtotal+v_order.shipping_amount,2) THEN
    RAISE EXCEPTION 'The order shipping amount is not confirmed at the store 50 percent policy.';
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

-- Prevent paid PayPal orders with unresolved stock discrepancies from entering fulfilment.
CREATE OR REPLACE FUNCTION public.guard_paid_order_stock_review_before_processing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF OLD.status = 'paid' AND NEW.status = 'processing'
     AND EXISTS (
       SELECT 1 FROM public.payments p
       WHERE p.order_id = OLD.id AND p.provider = 'paypal'
         AND p.status = 'paid' AND p.stock_review_required IS TRUE
     ) THEN
    RAISE EXCEPTION 'Inventory review is required before this paid PayPal order can enter processing.';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_paid_order_stock_review_before_processing() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_paid_order_stock_review_before_processing ON public.orders;
CREATE TRIGGER guard_paid_order_stock_review_before_processing
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_paid_order_stock_review_before_processing();

-- Reconcile missing reservations from available inventory, then commit the full order.
CREATE OR REPLACE FUNCTION public.admin_resolve_paid_order_stock_review(
  p_order_id uuid, p_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_order public.orders%rowtype;
  v_reservation public.stock_reservations%rowtype;
  v_inventory public.inventory%rowtype;
  v_item record;
  v_now timestamptz := pg_catalog.now();
  v_note text := nullif(pg_catalog.left(pg_catalog.trim(coalesce(p_note,'')),1000),'');
  v_payment_count integer;
  v_reserved integer;
  v_remaining integer;
  v_add integer;
BEGIN
  IF NOT public.can_manage_catalog() THEN
    RAISE EXCEPTION 'You do not have permission to manage orders.';
  END IF;
  IF p_order_id IS NULL OR v_note IS NULL OR length(v_note) < 3 OR length(coalesce(p_note,'')) > 1000 THEN
    RAISE EXCEPTION 'A valid order and inventory review note are required.';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.status <> 'paid' THEN
    RAISE EXCEPTION 'Only paid orders can have their stock review resolved.';
  END IF;

  PERFORM 1 FROM public.payments
   WHERE order_id = p_order_id AND provider = 'paypal'
     AND status = 'paid' AND stock_review_required IS TRUE
   FOR UPDATE;
  GET DIAGNOSTICS v_payment_count = ROW_COUNT;
  IF v_payment_count = 0 THEN
    RAISE EXCEPTION 'This order does not have an outstanding PayPal stock review.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = p_order_id)
     OR EXISTS (SELECT 1 FROM public.order_items WHERE order_id = p_order_id AND variant_id IS NULL) THEN
    RAISE EXCEPTION 'Order items are missing inventory variants. Resolve the order data before continuing.';
  END IF;

  PERFORM 1 FROM public.stock_reservations
   WHERE order_id = p_order_id AND status = 'active' ORDER BY id FOR UPDATE;
  PERFORM 1
   FROM public.inventory i
   JOIN public.stock_reservations r
     ON i.warehouse_id = r.warehouse_id AND i.variant_id = r.variant_id
   WHERE r.order_id = p_order_id AND r.status = 'active'
   FOR UPDATE OF i;

  -- Release expired holds first; if the inventory counter cannot support the release,
  -- stop and require a manual inventory reconciliation rather than guessing.
  FOR v_reservation IN
    SELECT * FROM public.stock_reservations
    WHERE order_id = p_order_id AND status = 'active'
      AND (expires_at IS NULL OR expires_at <= v_now)
    ORDER BY id FOR UPDATE
  LOOP
    UPDATE public.inventory SET reserved = reserved - v_reservation.quantity, updated_at = v_now
     WHERE warehouse_id = v_reservation.warehouse_id
       AND variant_id = v_reservation.variant_id
       AND reserved >= v_reservation.quantity;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Expired reservation counters do not reconcile with inventory. Reconcile inventory before continuing.';
    END IF;
    UPDATE public.stock_reservations
       SET status = 'released', released_at = v_now, updated_at = v_now
     WHERE id = v_reservation.id;
    INSERT INTO public.inventory_movements(
      warehouse_id,variant_id,movement_type,quantity_change,reserved_change,
      reference_type,reference_id,notes,created_by
    ) VALUES (
      v_reservation.warehouse_id,v_reservation.variant_id,'reservation_release',
      0,-v_reservation.quantity,'order',p_order_id,
      'Expired reservation released during paid-order stock review.',auth.uid()
    );
  END LOOP;

  -- Fill any shortfall by reserving available units across active warehouses.
  FOR v_item IN
    SELECT variant_id, sum(quantity)::integer AS quantity
    FROM public.order_items WHERE order_id = p_order_id
    GROUP BY variant_id ORDER BY variant_id
  LOOP
    SELECT coalesce(sum(quantity),0)::integer INTO v_reserved
      FROM public.stock_reservations
     WHERE order_id = p_order_id AND variant_id = v_item.variant_id
       AND status = 'active' AND expires_at > v_now;
    IF v_reserved > v_item.quantity THEN
      RAISE EXCEPTION 'Active reservations exceed the ordered quantity. Reconcile reservations before continuing.';
    END IF;
    v_remaining := v_item.quantity - v_reserved;

    FOR v_inventory IN
      SELECT i.* FROM public.inventory i
      WHERE i.variant_id = v_item.variant_id
        AND i.on_hand - i.reserved - i.damaged > 0
      ORDER BY i.warehouse_id
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_add := least(v_remaining, v_inventory.on_hand - v_inventory.reserved - v_inventory.damaged);
      IF v_add > 0 THEN
        UPDATE public.inventory SET reserved = reserved + v_add, updated_at = v_now
         WHERE id = v_inventory.id
           AND on_hand - reserved - damaged >= v_add;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Inventory changed during stock review. Retry after checking inventory.';
        END IF;
        INSERT INTO public.stock_reservations(
          order_id,warehouse_id,variant_id,quantity,status,expires_at
        ) VALUES (
          p_order_id,v_inventory.warehouse_id,v_item.variant_id,v_add,
          'active',v_now + interval '48 hours'
        );
        INSERT INTO public.inventory_movements(
          warehouse_id,variant_id,movement_type,quantity_change,reserved_change,
          reference_type,reference_id,notes,created_by
        ) VALUES (
          v_inventory.warehouse_id,v_item.variant_id,'reservation',0,v_add,
          'order',p_order_id,'Additional stock reserved during paid-order review.',auth.uid()
        );
        v_remaining := v_remaining - v_add;
      END IF;
    END LOOP;

    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'Not enough available stock to cover this paid order. Receive or reconcile inventory before continuing.';
    END IF;
  END LOOP;

  -- No extra active reservations for variants absent from the order are allowed.
  IF EXISTS (
    SELECT 1 FROM public.stock_reservations r
    LEFT JOIN public.order_items oi
      ON oi.order_id = p_order_id AND oi.variant_id = r.variant_id
    WHERE r.order_id = p_order_id AND r.status = 'active'
      AND r.expires_at > v_now AND oi.variant_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Unexpected active stock reservations exist for this order. Reconcile them before continuing.';
  END IF;

  -- Commit every reservation only after the full order is covered.
  FOR v_reservation IN
    SELECT * FROM public.stock_reservations
    WHERE order_id = p_order_id AND status = 'active'
      AND expires_at > v_now
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
      RAISE EXCEPTION 'Inventory changed while committing stock review. No review changes were committed.';
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
      'Stock deducted after staff resolved PayPal stock review.',auth.uid()
    );
  END LOOP;

  UPDATE public.payments SET stock_review_required = false
   WHERE order_id = p_order_id AND provider = 'paypal'
     AND status = 'paid' AND stock_review_required IS TRUE;

  UPDATE public.orders
     SET internal_note = pg_catalog.left(
       pg_catalog.concat_ws(E'\\n',nullif(internal_note,''),
         'PayPal stock review completed: ' || v_note),2000),
         updated_at = v_now
   WHERE id = p_order_id;

  INSERT INTO public.order_status_history(order_id,old_status,new_status,note,changed_by)
  VALUES (p_order_id,'paid','paid',
    'Inventory reviewed and exact reservations committed. ' || v_note,auth.uid());
  INSERT INTO public.activity_logs(actor_user_id,action,entity_type,entity_id,old_values,new_values)
  VALUES (auth.uid(),'order.paypal_stock_review_resolved','order',p_order_id,
    jsonb_build_object('stock_review_required',true),
    jsonb_build_object('stock_review_required',false,'note',v_note));

  RETURN jsonb_build_object('order_id',p_order_id,'status','paid',
    'stock_review_required',false,'stock_committed',true);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_resolve_paid_order_stock_review(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_paid_order_stock_review(uuid,text) TO authenticated;
