-- Reserve stock atomically at guest checkout when every requested variant has available inventory.
-- Orders without complete inventory coverage remain on_hold and cannot be paid online.
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
 v_existing jsonb;
BEGIN
$old$;
  v_new := $new$
 v_existing jsonb;
 v_stock_ready boolean := true;
 v_stock_plan jsonb := '[]'::jsonb;
 v_stock_item record;
 v_warehouse_id uuid;
BEGIN
$new$;
  if position(v_old in v_definition)=0 then
    raise exception 'Could not locate guest checkout declaration block; migration stopped.';
  end if;
  v_definition := replace(v_definition,v_old,v_new);

  v_old := $old$
 IF v_count=0 THEN RAISE EXCEPTION 'Your bag is empty.'; END IF;
 UPDATE public.orders SET currency=coalesce(v_currency,'USD'),
$new$;
$old$;
  v_new := $new$
 IF v_count=0 THEN RAISE EXCEPTION 'Your bag is empty.'; END IF;

 -- Lock and plan one warehouse row per variant in a stable order. No inventory is
 -- changed unless every requested variant can be fully reserved.
 FOR v_stock_item IN
   SELECT oi.variant_id, sum(oi.quantity)::integer AS quantity
   FROM public.order_items oi
   WHERE oi.order_id=v_order_id
   GROUP BY oi.variant_id
   ORDER BY oi.variant_id
 LOOP
   v_warehouse_id := NULL;
   SELECT i.warehouse_id INTO v_warehouse_id
   FROM public.inventory i
   WHERE i.variant_id=v_stock_item.variant_id
     AND i.on_hand-i.reserved-i.damaged >= v_stock_item.quantity
   ORDER BY i.warehouse_id
   LIMIT 1
   FOR UPDATE OF i;

   IF v_warehouse_id IS NULL THEN
     v_stock_ready := false;
     EXIT;
   END IF;

   v_stock_plan := v_stock_plan || pg_catalog.jsonb_build_array(
     pg_catalog.jsonb_build_object(
       'variant_id',v_stock_item.variant_id,
       'warehouse_id',v_warehouse_id,
       'quantity',v_stock_item.quantity
     )
   );
 END LOOP;

 IF v_stock_ready THEN
   FOR v_stock_item IN
     SELECT
       (entry->>'variant_id')::uuid AS variant_id,
       (entry->>'warehouse_id')::uuid AS warehouse_id,
       (entry->>'quantity')::integer AS quantity
     FROM pg_catalog.jsonb_array_elements(v_stock_plan) AS plan(entry)
     ORDER BY (entry->>'variant_id')
   LOOP
     UPDATE public.inventory
       SET reserved=reserved+v_stock_item.quantity,
           updated_at=pg_catalog.now()
     WHERE warehouse_id=v_stock_item.warehouse_id
       AND variant_id=v_stock_item.variant_id
       AND on_hand-reserved-damaged >= v_stock_item.quantity;
     IF NOT FOUND THEN
       RAISE EXCEPTION 'Inventory changed during checkout. Please try again.';
     END IF;

     INSERT INTO public.stock_reservations(
       order_id,warehouse_id,variant_id,quantity,status,expires_at
     ) VALUES (
       v_order_id,v_stock_item.warehouse_id,v_stock_item.variant_id,
       v_stock_item.quantity,'active',pg_catalog.now()+interval '48 hours'
     );

     INSERT INTO public.inventory_movements(
       warehouse_id,variant_id,movement_type,quantity_change,reserved_change,
       reference_type,reference_id,notes,created_by
     ) VALUES (
       v_stock_item.warehouse_id,v_stock_item.variant_id,'reservation',
       0,v_stock_item.quantity,'order',v_order_id,
       'Stock reserved for 48 hours after guest checkout.',NULL
     );
   END LOOP;

   UPDATE public.orders
     SET status='pending_payment',
         internal_note='Stock reserved for 48 hours; awaiting PayPal payment.',
         updated_at=pg_catalog.now()
   WHERE id=v_order_id AND status='on_hold';

   INSERT INTO public.order_status_history(order_id,old_status,new_status,note)
   VALUES(v_order_id,'on_hold','pending_payment',
     'All requested items were reserved from available inventory for 48 hours; awaiting payment.');
 END IF;

 UPDATE public.orders SET currency=coalesce(v_currency,'USD'),
$new$;
  if position(v_old in v_definition)=0 then
    raise exception 'Could not locate guest checkout inventory insertion point; migration stopped.';
  end if;
  v_definition := replace(v_definition,v_old,v_new);

  v_old := $old$
  'order_id',v_order_id,'order_number',v_order_number,'status','on_hold',
  'subtotal',v_subtotal,'shipping_amount',round(v_subtotal*0.50,2),
  'total_amount',v_subtotal+round(v_subtotal*0.50,2),
  'shipping_status','estimated','payment_status','not_started','currency',coalesce(v_currency,'USD')
$new$;
$old$;
  v_new := $new$
  'order_id',v_order_id,'order_number',v_order_number,
  'status',case when v_stock_ready then 'pending_payment' else 'on_hold' end,
  'subtotal',v_subtotal,'shipping_amount',round(v_subtotal*0.50,2),
  'total_amount',v_subtotal+round(v_subtotal*0.50,2),
  'shipping_status','estimated','payment_status','not_started',
  'payment_ready',v_stock_ready,'currency',coalesce(v_currency,'USD')
$new$;
  if position(v_old in v_definition)=0 then
    raise exception 'Could not locate guest checkout response block; migration stopped.';
  end if;
  v_definition := replace(v_definition,v_old,v_new);
  execute v_definition;
end
$migration$;
