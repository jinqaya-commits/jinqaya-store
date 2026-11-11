-- Enqueue one customer notification in the same transaction that expires a reservation.
-- Allow the new event in the outbox event type constraint.
ALTER TABLE public.order_email_outbox
  DROP CONSTRAINT IF EXISTS order_email_outbox_event_type_check;
ALTER TABLE public.order_email_outbox
  ADD CONSTRAINT order_email_outbox_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'order_received',
    'quote_confirmed',
    'payment_received',
    'shipped',
    'delivered',
    'cancelled',
    'reservation_expired'
  ]::text[]));

-- Replaces the expiry worker so inventory release, order state and email enqueue are atomic.
-- Release expired stock reservations for unpaid orders.
-- Runs transactionally: inventory, reservation ledger, order state and history stay in sync.
CREATE OR REPLACE FUNCTION public.release_expired_stock_reservations(p_limit integer DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_order_id uuid;
  v_order record;
  v_reservation public.stock_reservations%rowtype;
  v_released_orders integer := 0;
  v_released_lines integer := 0;
  v_released_units integer := 0;
  v_order_released_units integer := 0;
  v_now timestamptz := pg_catalog.now();
BEGIN
  FOR v_order_id IN
    SELECT o.id
      FROM public.orders o
     WHERE o.status = 'pending_payment'
       AND EXISTS (
         SELECT 1
           FROM public.stock_reservations r
          WHERE r.order_id = o.id
            AND r.status = 'active'
            AND r.expires_at IS NOT NULL
            AND r.expires_at <= v_now
       )
       AND NOT EXISTS (
         SELECT 1
           FROM public.stock_reservations r
          WHERE r.order_id = o.id
            AND r.status = 'active'
            AND (r.expires_at IS NULL OR r.expires_at > v_now)
       )
     ORDER BY o.created_at
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
     FOR UPDATE OF o SKIP LOCKED
  LOOP
    v_order_released_units := 0;

    FOR v_reservation IN
      SELECT *
        FROM public.stock_reservations
       WHERE order_id = v_order_id
         AND status = 'active'
       ORDER BY warehouse_id, variant_id
       FOR UPDATE
    LOOP
      UPDATE public.inventory
         SET reserved = reserved - v_reservation.quantity,
             updated_at = v_now
       WHERE warehouse_id = v_reservation.warehouse_id
         AND variant_id = v_reservation.variant_id
         AND reserved >= v_reservation.quantity;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Unable to safely release expired reservation % for order %.',
          v_reservation.id, v_order_id;
      END IF;

      UPDATE public.stock_reservations
         SET status = 'expired',
             released_at = v_now,
             updated_at = v_now
       WHERE id = v_reservation.id;

      INSERT INTO public.inventory_movements(
        warehouse_id, variant_id, movement_type, quantity_change, reserved_change,
        reference_type, reference_id, notes, created_by
      )
      VALUES (
        v_reservation.warehouse_id, v_reservation.variant_id,
        'reservation_release', 0, -v_reservation.quantity,
        'order', v_order_id,
        'Stock reservation automatically released after 48-hour payment window expired.',
        NULL
      );

      v_released_lines := v_released_lines + 1;
      v_released_units := v_released_units + v_reservation.quantity;
      v_order_released_units := v_order_released_units + v_reservation.quantity;
    END LOOP;

    UPDATE public.orders
       SET status = 'on_hold',
           shipping_amount = 0,
           total_amount = subtotal - discount_amount + tax_amount,
           shipping_method_name = NULL,
           shipping_quote_snapshot = pg_catalog.jsonb_build_object(
             'status', 'expired',
             'message', 'The stock reservation expired. Please confirm stock and shipping again.',
             'expired_at', v_now
           ),
           updated_at = v_now
     WHERE id = v_order_id
       AND status = 'pending_payment';

    IF FOUND THEN
      INSERT INTO public.order_status_history(
        order_id, old_status, new_status, note, changed_by
      )
      VALUES (
        v_order_id, 'pending_payment', 'on_hold',
        'Stock reservation expired automatically; order requires a new shipping quote.',
        NULL
      );

      INSERT INTO public.activity_logs(
        actor_user_id, action, entity_type, entity_id, old_values, new_values
      )
      VALUES (
        NULL,
        'order.reservation_expired',
        'order',
        v_order_id,
        pg_catalog.jsonb_build_object('status', 'pending_payment'),
        pg_catalog.jsonb_build_object(
          'status', 'on_hold',
          'released_units', v_order_released_units,
          'reason', 'stock_reservation_expired'
        )
      );
      SELECT o.order_number, o.customer_email, o.shipping_address_snapshot,
             o.subtotal, o.currency, o.shipping_amount, o.shipping_method_name
        INTO v_order
        FROM public.orders o
       WHERE o.id = v_order_id;

      IF NULLIF(pg_catalog.btrim(v_order.customer_email), '') IS NOT NULL THEN
        INSERT INTO public.order_email_outbox(
          order_id, event_type, recipient_type, recipient_email, payload
        )
        VALUES (
          v_order_id,
          'reservation_expired',
          'customer',
          v_order.customer_email,
          pg_catalog.jsonb_build_object(
            'eventType', 'reservation_expired',
            'orderNumber', v_order.order_number,
            'customerName', COALESCE(v_order.shipping_address_snapshot->>'recipient_name', ''),
            'customerEmail', v_order.customer_email,
            'subtotal', v_order.subtotal,
            'currency', v_order.currency,
            'shippingAmount', v_order.shipping_amount,
            'shippingMethod', v_order.shipping_method_name
          )
        )
        ON CONFLICT (order_id, event_type, recipient_type) DO NOTHING;
      END IF;

      v_released_orders := v_released_orders + 1;
    END IF;
  END LOOP;

  RETURN pg_catalog.jsonb_build_object(
    'released_orders', v_released_orders,
    'released_lines', v_released_lines,
    'released_units', v_released_units
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.release_expired_stock_reservations(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_expired_stock_reservations(integer) TO service_role;
