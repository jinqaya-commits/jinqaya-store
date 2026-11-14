-- Staff-only order workflow. Shipping defaults to 50% of merchandise subtotal; staff may enter an agreed actual quote.
CREATE OR REPLACE FUNCTION public.admin_process_order(p_order_id uuid, p_action text, p_shipping_amount numeric DEFAULT NULL::numeric, p_shipping_method text DEFAULT NULL::text, p_carrier_name text DEFAULT NULL::text, p_tracking_number text DEFAULT NULL::text, p_tracking_url text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_order public.orders%rowtype; v_item record; v_inventory public.inventory%rowtype;
 v_reservation public.stock_reservations%rowtype; v_shipment uuid; v_old_status public.order_status; v_new_status public.order_status;
 v_now timestamptz:=pg_catalog.now(); v_shipping numeric(12,2); v_auto_shipping numeric(12,2); v_adjustment numeric(12,2); v_units integer:=0; v_method text;
 v_note text:=nullif(pg_catalog.left(pg_catalog.trim(coalesce(p_note,'')),2000),'');
 v_carrier text:=nullif(pg_catalog.left(pg_catalog.trim(coalesce(p_carrier_name,'')),100),'');
 v_tracking text:=nullif(pg_catalog.left(pg_catalog.trim(coalesce(p_tracking_number,'')),150),'');
 v_url text:=nullif(pg_catalog.trim(coalesce(p_tracking_url,'')),''); v_reserved integer:=0;
begin
 if not public.can_manage_catalog() then raise exception 'You do not have permission to manage orders.'; end if;
 if p_order_id is null or coalesce(p_action,'') not in ('confirm_quote','reconfirm_stock','confirm_payment','start_processing','ship','delivered','cancel','save_note') then raise exception 'Invalid order action.'; end if;
 if length(coalesce(p_note,''))>2000 or length(coalesce(p_shipping_method,''))>100 or length(coalesce(p_carrier_name,''))>100 or length(coalesce(p_tracking_number,''))>150 or length(coalesce(p_tracking_url,''))>2000 then raise exception 'One or more order fields exceed the allowed length.'; end if;
 if v_url is not null and v_url !~* '^https?://' then raise exception 'Tracking URL must begin with http:// or https://.'; end if;
 select * into v_order from public.orders where id=p_order_id for update;
 if not found then raise exception 'Order not found.'; end if;
 v_old_status:=v_order.status;
 if p_action='save_note' then
  update public.orders set internal_note=case when v_note is null then internal_note else pg_catalog.left(concat_ws(E'\n',nullif(internal_note,''),v_note),2000) end,updated_at=v_now where id=p_order_id;
  insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,old_values,new_values) values(auth.uid(),'order.internal_note_updated','order',p_order_id,jsonb_build_object('status',v_old_status),jsonb_build_object('note_added',v_note));
  return jsonb_build_object('order_id',p_order_id,'status',v_old_status,'action',p_action);
 end if;
 if p_action='confirm_quote' then
  if v_old_status<>'on_hold' then raise exception 'Only orders needing review can be confirmed.'; end if;
  if p_shipping_amount is not null and (p_shipping_amount<0 or p_shipping_amount>99999999.99 or p_shipping_amount<>round(p_shipping_amount,2)) then
   raise exception 'Shipping amount must be a non-negative amount with no more than two decimal places.';
  end if;
  select coalesce(sum(oi.quantity),0)::integer into v_units from public.order_items oi where oi.order_id=p_order_id;
  v_auto_shipping:=case when v_units<=2 then 50.00 else round(coalesce(v_order.subtotal,0)*0.50,2) end;
  v_shipping:=round(coalesce(p_shipping_amount,v_auto_shipping),2);
  v_adjustment:=round(v_shipping-v_auto_shipping,2);
  v_method:=coalesce(nullif(pg_catalog.trim(coalesce(p_shipping_method,'')),''),case when v_shipping=v_auto_shipping then 'Standard shipping estimate' else 'Custom shipping quote' end);
  if exists(select 1 from public.stock_reservations where order_id=p_order_id and status='active') then raise exception 'This order already has active stock reservations. Review inventory before continuing.'; end if;
  for v_item in select oi.variant_id,sum(oi.quantity)::integer quantity from public.order_items oi where oi.order_id=p_order_id group by oi.variant_id order by oi.variant_id loop
   if v_item.variant_id is null then raise exception 'An order item has no inventory variant. Please review this order manually.'; end if;
   select i.* into v_inventory from public.inventory i where i.variant_id=v_item.variant_id and i.on_hand-i.reserved-i.damaged>=v_item.quantity order by i.warehouse_id limit 1 for update;
   if not found then raise exception 'Insufficient stock for one or more items. The order remains on hold.'; end if;
   update public.inventory set reserved=reserved+v_item.quantity,updated_at=v_now where id=v_inventory.id and on_hand-reserved-damaged>=v_item.quantity;
   if not found then raise exception 'Inventory changed while reserving stock. Please retry.'; end if;
   insert into public.stock_reservations(order_id,warehouse_id,variant_id,quantity,status,expires_at) values(p_order_id,v_inventory.warehouse_id,v_item.variant_id,v_item.quantity,'active',v_now+interval '48 hours');
   insert into public.inventory_movements(warehouse_id,variant_id,movement_type,quantity_change,reserved_change,reference_type,reference_id,notes,created_by) values(v_inventory.warehouse_id,v_item.variant_id,'reservation',0,v_item.quantity,'order',p_order_id,'Stock reserved by staff after order review.',auth.uid());
   v_reserved:=v_reserved+v_item.quantity;
  end loop;
  update public.orders set status='pending_payment',shipping_amount=v_shipping,total_amount=round(coalesce(subtotal,0)+v_shipping+coalesce(tax_amount,0)-coalesce(discount_amount,0),2),shipping_method_name=v_method,
   shipping_quote_snapshot=jsonb_build_object('status','confirmed','calculation',case when v_units<=2 then 'flat_50_for_1_or_2_units' else '50_percent_of_subtotal_for_3_plus_units' end,'units',v_units,'automatic_amount',v_auto_shipping,'adjustment_amount',v_adjustment,'discount_amount',greatest(v_auto_shipping-v_shipping,0),'custom_amount',v_shipping<>v_auto_shipping,'reason',v_note,'amount',v_shipping,'destination_country_code',shipping_address_snapshot->>'country_code'),
   internal_note=case when v_note is null then internal_note else pg_catalog.left(concat_ws(E'\n',nullif(internal_note,''),v_note),2000) end,updated_at=v_now where id=p_order_id;
  v_new_status:='pending_payment';
  insert into public.order_status_history(order_id,old_status,new_status,note,changed_by) values(p_order_id,v_old_status,v_new_status,'Stock reserved for 48 hours. Shipping quote confirmed; awaiting payment.',auth.uid());
  insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,old_values,new_values) values(auth.uid(),'order.shipping_confirmed','order',p_order_id,jsonb_build_object('status',v_old_status),jsonb_build_object('status',v_new_status,'shipping_amount',v_shipping,'shipping_method',v_method,'shipping_calculation',case when v_units<=2 then 'flat_50_for_1_or_2_units' else '50_percent_of_subtotal_for_3_plus_units' end,'units',v_units,'automatic_shipping_amount',v_auto_shipping,'final_shipping_amount',v_shipping,'shipping_adjustment',v_adjustment,'shipping_discount',greatest(v_auto_shipping-v_shipping,0),'reason',v_note,'reserved_units',v_reserved));
  return jsonb_build_object('order_id',p_order_id,'status',v_new_status,'shipping_amount',v_shipping,'total_amount',round(v_order.subtotal+v_shipping+coalesce(v_order.tax_amount,0)-coalesce(v_order.discount_amount,0),2),'reserved_units',v_reserved);

 elsif p_action='reconfirm_stock' then
  if v_old_status<>'pending_payment' then raise exception 'Only orders awaiting payment can have stock reservations renewed.'; end if;
  if coalesce(v_order.shipping_quote_snapshot->>'status','')<>'confirmed'
    or round(v_order.shipping_amount,2)<>round(coalesce((v_order.shipping_quote_snapshot->>'amount')::numeric,-1),2)
    or round(v_order.total_amount,2)<>round(coalesce(v_order.subtotal,0)+v_order.shipping_amount+coalesce(v_order.tax_amount,0)-coalesce(v_order.discount_amount,0),2)
   then raise exception 'Order total does not match the confirmed shipping quote.'; end if;
  if exists(select 1 from public.stock_reservations where order_id=p_order_id and status='active') then
   raise exception 'Active stock reservations already exist. Refresh the order before retrying.';
  end if;
  for v_item in select oi.variant_id,sum(oi.quantity)::integer quantity from public.order_items oi where oi.order_id=p_order_id group by oi.variant_id order by oi.variant_id loop
   if v_item.variant_id is null then raise exception 'An order item has no inventory variant.'; end if;
   select i.* into v_inventory from public.inventory i where i.variant_id=v_item.variant_id and i.on_hand-i.reserved-i.damaged>=v_item.quantity order by i.warehouse_id limit 1 for update;
   if not found then raise exception 'Insufficient stock for one or more items. The order remains awaiting payment.'; end if;
   update public.inventory set reserved=reserved+v_item.quantity,updated_at=v_now where id=v_inventory.id and on_hand-reserved-damaged>=v_item.quantity;
   if not found then raise exception 'Inventory changed while renewing stock reservations. Please retry.'; end if;
   insert into public.stock_reservations(order_id,warehouse_id,variant_id,quantity,status,expires_at) values(p_order_id,v_inventory.warehouse_id,v_item.variant_id,v_item.quantity,'active',v_now+interval '48 hours');
   insert into public.inventory_movements(warehouse_id,variant_id,movement_type,quantity_change,reserved_change,reference_type,reference_id,notes,created_by) values(v_inventory.warehouse_id,v_item.variant_id,'reservation',0,v_item.quantity,'order',p_order_id,'Stock reservation renewed for pending payment.',auth.uid());
   v_reserved:=v_reserved+v_item.quantity;
  end loop;
  insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,old_values,new_values) values(auth.uid(),'order.stock_reservation_renewed','order',p_order_id,jsonb_build_object('status',v_old_status),jsonb_build_object('reserved_units',v_reserved));
  return jsonb_build_object('order_id',p_order_id,'status',v_old_status,'action',p_action,'reserved_units',v_reserved,'expires_in_hours',48);
 elsif p_action='confirm_payment' then
  if v_old_status<>'pending_payment' then raise exception 'Only orders awaiting payment can be manually confirmed.'; end if;
  if exists(select 1 from public.payments where order_id=p_order_id and status='paid') then raise exception 'A payment is already recorded for this order.'; end if;
  if coalesce(v_order.shipping_quote_snapshot->>'status','')<>'confirmed'
    or round(v_order.shipping_amount,2)<>round(coalesce((v_order.shipping_quote_snapshot->>'amount')::numeric,-1),2)
    or round(v_order.total_amount,2)<>round(coalesce(v_order.subtotal,0)+v_order.shipping_amount+coalesce(v_order.tax_amount,0)-coalesce(v_order.discount_amount,0),2)
   then raise exception 'Order total does not match the confirmed shipping quote.'; end if;
  if not exists(select 1 from public.stock_reservations r where r.order_id=p_order_id and r.status='active' and r.expires_at>v_now) or exists(select 1 from public.stock_reservations r left join public.inventory i on i.warehouse_id=r.warehouse_id and i.variant_id=r.variant_id where r.order_id=p_order_id and r.status='active' and (r.expires_at is null or r.expires_at<=v_now or i.id is null or i.on_hand<r.quantity or i.reserved<r.quantity)) then raise exception 'Valid stock reservations are required before confirming payment.'; end if;
  for v_reservation in select * from public.stock_reservations where order_id=p_order_id and status='active' order by id for update loop
   update public.inventory set on_hand=on_hand-v_reservation.quantity,reserved=reserved-v_reservation.quantity,updated_at=v_now where warehouse_id=v_reservation.warehouse_id and variant_id=v_reservation.variant_id and on_hand>=v_reservation.quantity and reserved>=v_reservation.quantity;
   if not found then raise exception 'Inventory changed while confirming payment.'; end if;
   update public.stock_reservations set status='committed',committed_at=v_now,updated_at=v_now where id=v_reservation.id;
   insert into public.inventory_movements(warehouse_id,variant_id,movement_type,quantity_change,reserved_change,reference_type,reference_id,notes,created_by) values(v_reservation.warehouse_id,v_reservation.variant_id,'sale',-v_reservation.quantity,-v_reservation.quantity,'order',p_order_id,'Stock deducted after staff verified an offline payment.',auth.uid());
  end loop;
  insert into public.payments(order_id,provider,provider_payment_id,status,amount,currency,payment_method_type,idempotency_key,paid_at,stock_review_required) values(p_order_id,'manual','manual:'||p_order_id::text,'paid',v_order.total_amount,v_order.currency,'manual','manual-order-payment:'||p_order_id::text,v_now,false);
  update public.orders set status='paid',paid_at=v_now,internal_note=case when v_note is null then internal_note else pg_catalog.left(concat_ws(E'\n',nullif(internal_note,''),v_note),2000) end,updated_at=v_now where id=p_order_id;
  v_new_status:='paid';
 elsif p_action='start_processing' then
  if v_old_status<>'paid' then raise exception 'Only paid orders can enter processing.'; end if;
  update public.orders set status='processing',updated_at=v_now where id=p_order_id; v_new_status:='processing';
 elsif p_action='ship' then
  if v_old_status<>'processing' then raise exception 'Only processing orders can be shipped.'; end if;
  if v_carrier is null or v_tracking is null then raise exception 'Carrier and tracking number are required.'; end if;
  insert into public.shipments(order_id,status,carrier_name,tracking_number,tracking_url,shipping_cost,currency,shipped_at,shipped_by,notes) values(p_order_id,'shipped',v_carrier,v_tracking,v_url,v_order.shipping_amount,v_order.currency,v_now,auth.uid(),v_note) returning id into v_shipment;
  insert into public.shipment_items(shipment_id,order_item_id,quantity) select v_shipment,oi.id,oi.quantity from public.order_items oi where oi.order_id=p_order_id;
  update public.orders set status='shipped',updated_at=v_now where id=p_order_id; v_new_status:='shipped';
 elsif p_action='delivered' then
  if v_old_status<>'shipped' then raise exception 'Only shipped orders can be marked delivered.'; end if;
  update public.shipments set status='delivered',delivered_at=v_now,updated_at=v_now where order_id=p_order_id and status in ('shipped','in_transit');
  if not found then raise exception 'No active shipment was found for this order.'; end if;
  update public.orders set status='delivered',delivered_at=v_now,updated_at=v_now where id=p_order_id; v_new_status:='delivered';
 elsif p_action='cancel' then
  if v_old_status not in ('on_hold','pending_payment') then raise exception 'Only unpaid orders can be cancelled.'; end if;
  for v_reservation in select * from public.stock_reservations where order_id=p_order_id and status='active' order by id for update loop
   update public.inventory set reserved=reserved-v_reservation.quantity,updated_at=v_now where warehouse_id=v_reservation.warehouse_id and variant_id=v_reservation.variant_id and reserved>=v_reservation.quantity;
   if not found then raise exception 'Could not safely release a stock reservation; reconcile inventory first.'; end if;
   update public.stock_reservations set status='released',released_at=v_now,updated_at=v_now where id=v_reservation.id;
   insert into public.inventory_movements(warehouse_id,variant_id,movement_type,quantity_change,reserved_change,reference_type,reference_id,notes,created_by) values(v_reservation.warehouse_id,v_reservation.variant_id,'reservation_release',0,-v_reservation.quantity,'order',p_order_id,'Stock reservation released when staff cancelled the order.',auth.uid());
  end loop;
  update public.orders set status='cancelled',cancelled_at=v_now,updated_at=v_now where id=p_order_id; v_new_status:='cancelled';
 end if;
 if v_new_status is not null then
  insert into public.order_status_history(order_id,old_status,new_status,note,changed_by) values(p_order_id,v_old_status,v_new_status,coalesce(v_note,case p_action when 'confirm_payment' then 'Offline payment verified by staff.' when 'start_processing' then 'Order processing started.' when 'ship' then 'Order shipped and tracking recorded.' when 'delivered' then 'Order marked delivered.' when 'cancel' then 'Unpaid order cancelled and stock reservations released.' end),auth.uid());
  insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,old_values,new_values) values(auth.uid(),'order.'||p_action,'order',p_order_id,jsonb_build_object('status',v_old_status),jsonb_build_object('status',v_new_status,'note',v_note));
 end if;
 return jsonb_build_object('order_id',p_order_id,'status',v_new_status,'action',p_action);
end;
$function$;

revoke all on function public.admin_process_order(uuid,text,numeric,text,text,text,text,text) from public, anon;
grant execute on function public.admin_process_order(uuid,text,numeric,text,text,text,text,text) to authenticated;
