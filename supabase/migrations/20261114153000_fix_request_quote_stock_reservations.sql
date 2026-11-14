-- Correct the quote-request path: the legacy order RPC reserves stock when stock is
-- available. Quote requests must release that reservation, remain on_hold, and
-- must not enqueue a misleading "quote confirmed" email during the legacy call.
do $migration$
declare
  v_definition text;
  v_old text;
  v_new text;
begin
  v_definition := pg_catalog.pg_get_functiondef(
    'public.submit_guest_order(text,jsonb,jsonb,jsonb,text,text,text)'::regprocedure
  );

  v_old := $old$
  v_existing boolean := false;
$old$;
  v_new := $new$
  v_existing boolean := false;
  v_reservation public.stock_reservations%rowtype;
$new$;
  if pg_catalog.strpos(v_definition, v_old) > 0 then
    v_definition := pg_catalog.replace(v_definition, v_old, v_new);
  elsif pg_catalog.strpos(v_definition, v_new) = 0 then
    raise exception 'Could not locate checkout-mode function declaration; migration stopped.';
  end if;

  v_old := $old$
  v_result := public.submit_guest_order(
$old$;
  v_new := $new$
  perform pg_catalog.set_config('app.checkout_mode', p_checkout_mode, true);

  v_result := public.submit_guest_order(
$new$;
  if pg_catalog.strpos(v_definition, v_old) > 0 then
    v_definition := pg_catalog.replace(v_definition, v_old, v_new);
  elsif pg_catalog.strpos(v_definition, v_new) = 0 then
    raise exception 'Could not locate legacy guest-order call; migration stopped.';
  end if;

  v_old := $old$
  if p_checkout_mode = 'request_quote' then
    update public.orders
       set shipping_quote_snapshot = coalesce(shipping_quote_snapshot, '{}'::jsonb)
         || pg_catalog.jsonb_build_object(
              'checkout_mode', 'request_quote',
              'status', 'quote_required',
              'message', 'Your request has been received. Our team will review stock and shipping before confirming the final amount.'
            ),
           updated_at = v_now
     where id = v_order.id;

    return pg_catalog.jsonb_build_object(
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'status', 'on_hold',
      'subtotal', v_order.subtotal,
      'shipping_amount', 0,
      'total_amount', v_order.subtotal - v_order.discount_amount + v_order.tax_amount,
      'shipping_status', 'quote_required',
      'payment_status', 'not_started',
      'checkout_mode', 'request_quote',
      'payment_ready', false,
      'currency', v_order.currency
    );
  end if;
$old$;
  v_new := $new$
  if p_checkout_mode = 'request_quote' then
    -- Undo any reservations made by the legacy guest-order function. A quote
    -- request must not hold stock before staff confirms the final shipping quote.
    for v_reservation in
      select *
        from public.stock_reservations
       where order_id = v_order.id
         and status = 'active'
       order by id
       for update
    loop
      update public.inventory
         set reserved = reserved - v_reservation.quantity,
             updated_at = v_now
       where warehouse_id = v_reservation.warehouse_id
         and variant_id = v_reservation.variant_id
         and reserved >= v_reservation.quantity;
      if not found then
        raise exception 'Could not safely release a checkout stock reservation; reconcile inventory first.';
      end if;

      update public.stock_reservations
         set status = 'released',
             released_at = v_now,
             updated_at = v_now
       where id = v_reservation.id;

      insert into public.inventory_movements(
        warehouse_id, variant_id, movement_type, quantity_change, reserved_change,
        reference_type, reference_id, notes, created_by
      ) values (
        v_reservation.warehouse_id, v_reservation.variant_id, 'reservation_release',
        0, -v_reservation.quantity, 'order', v_order.id,
        'Stock reservation released because customer requested a shipping quote.', null
      );
    end loop;

    update public.orders
       set status = 'on_hold',
           shipping_amount = 0,
           total_amount = round(
             coalesce(subtotal, 0) + coalesce(tax_amount, 0) - coalesce(discount_amount, 0), 2
           ),
           shipping_quote_snapshot = coalesce(shipping_quote_snapshot, '{}'::jsonb)
             || pg_catalog.jsonb_build_object(
                  'checkout_mode', 'request_quote',
                  'status', 'quote_required',
                  'message', 'Your request has been received. Our team will review stock and shipping before confirming the final amount.'
                ),
           updated_at = v_now
     where id = v_order.id;

    if v_order.status <> 'on_hold' then
      insert into public.order_status_history(
        order_id, old_status, new_status, note, changed_by
      ) values (
        v_order.id, v_order.status, 'on_hold',
        'Customer requested a shipping quote; no stock is reserved and payment is not available.', null
      );
    end if;

    return pg_catalog.jsonb_build_object(
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'status', 'on_hold',
      'subtotal', v_order.subtotal,
      'shipping_amount', 0,
      'total_amount', round(
        coalesce(v_order.subtotal, 0) + coalesce(v_order.tax_amount, 0)
        - coalesce(v_order.discount_amount, 0), 2
      ),
      'shipping_status', 'quote_required',
      'payment_status', 'not_started',
      'checkout_mode', 'request_quote',
      'payment_ready', false,
      'currency', v_order.currency
    );
  end if;
$new$;
  if pg_catalog.strpos(v_definition, v_old) > 0 then
    v_definition := pg_catalog.replace(v_definition, v_old, v_new);
  elsif pg_catalog.strpos(v_definition, v_new) = 0 then
    raise exception 'Could not locate quote-request branch; migration stopped.';
  end if;

  execute v_definition;
end
$migration$;

-- The legacy RPC briefly changes an in-stock order to pending_payment before
-- the wrapper converts it to on_hold. Suppress that intermediate notification.
do $migration$
declare
  v_definition text;
  v_old text;
  v_new text;
begin
  v_definition := pg_catalog.pg_get_functiondef(
    'public.enqueue_order_status_email()'::regprocedure
  );

  v_new := pg_catalog.regexp_replace(
    v_definition,
    'BEGIN\s+IF\s+NEW\.status\s+IS\s+NOT\s+DISTINCT\s+FROM\s+OLD\.status\s+THEN\s+RETURN\s+NEW;\s+END\s+IF;',
    'BEGIN IF pg_catalog.current_setting(''app.checkout_mode'', true) = ''request_quote'' THEN RETURN NEW; END IF; IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;',
    'i'
  );
  if v_new = v_definition then
    raise exception 'Could not locate order email trigger guard; migration stopped.';
  end if;
  v_definition := v_new;

  execute v_definition;
end
$migration$;
