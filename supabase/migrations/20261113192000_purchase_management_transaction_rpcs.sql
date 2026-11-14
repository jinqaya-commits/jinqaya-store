create unique index if not exists purchase_order_payment_reference_unique
  on public.purchase_order_payments (purchase_order_id, lower(reference_number))
  where nullif(btrim(reference_number), '') is not null;

create or replace function public.admin_create_purchase_order_v3(
  p_supplier_id uuid, p_supplier_name text, p_supplier_email text, p_supplier_phone text,
  p_save_supplier boolean, p_currency text, p_supplier_reference text, p_notes text,
  p_expected_date date, p_items jsonb
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_supplier_id uuid; v_supplier_name text; v_supplier_email text; v_supplier_phone text;
  v_warehouse_id uuid; v_po_id uuid; v_po_number text; v_subtotal numeric(14,2) := 0;
  v_item jsonb; v_variant_id uuid; v_quantity integer; v_unit_cost numeric(14,2);
  v_item_count integer := 0;
begin
  if auth.uid() is null or not public.can_manage_catalog() then raise exception 'Not authorized to create purchase orders'; end if;
  if p_currency is null or p_currency !~ '^[A-Z]{3}$' or p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100
     or length(coalesce(p_supplier_reference,'')) > 160 or length(coalesce(p_notes,'')) > 3000
     or length(coalesce(p_supplier_email,'')) > 254 or length(coalesce(p_supplier_phone,'')) > 60 then
    raise exception 'Invalid purchase order details';
  end if;
  select id into v_warehouse_id from public.warehouses where is_default=true and is_active=true order by id limit 1;
  if v_warehouse_id is null then raise exception 'No active default warehouse is configured'; end if;
  if p_supplier_id is not null then
    select id,company_name,email,phone into v_supplier_id,v_supplier_name,v_supplier_email,v_supplier_phone
    from public.suppliers where id=p_supplier_id and is_active=true for share;
    if v_supplier_id is null then raise exception 'Supplier not found or inactive'; end if;
  else
    v_supplier_name := nullif(btrim(coalesce(p_supplier_name,'')),'');
    v_supplier_email := nullif(btrim(coalesce(p_supplier_email,'')),'');
    v_supplier_phone := nullif(btrim(coalesce(p_supplier_phone,'')),'');
    if v_supplier_name is null or char_length(v_supplier_name)>160 then raise exception 'A valid supplier name is required'; end if;
    insert into public.suppliers(supplier_code,company_name,email,phone,currency,is_active)
    values('SUP-'||lpad(nextval('public.supplier_code_seq')::text,6,'0'),v_supplier_name,v_supplier_email,v_supplier_phone,p_currency,coalesce(p_save_supplier,false))
    returning id into v_supplier_id;
  end if;
  if p_supplier_id is not null and (p_supplier_email is not null or p_supplier_phone is not null) then
    v_supplier_email := coalesce(v_supplier_email,nullif(btrim(p_supplier_email),''));
    v_supplier_phone := coalesce(v_supplier_phone,nullif(btrim(p_supplier_phone),''));
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item)<>'object'
       or coalesce(v_item->>'variant_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or coalesce(v_item->>'quantity','') !~ '^[0-9]{1,7}$'
       or coalesce(v_item->>'unit_cost','') !~ '^[0-9]+([.][0-9]{1,2})?$' then raise exception 'Invalid purchase order line'; end if;
    v_variant_id := (v_item->>'variant_id')::uuid; v_quantity := (v_item->>'quantity')::integer;
    v_unit_cost := (v_item->>'unit_cost')::numeric(14,2);
    if v_quantity<1 or v_quantity>1000000 or v_unit_cost<0 or v_unit_cost>999999999999.99 then raise exception 'Invalid purchase order quantity or unit cost'; end if;
    if not exists(select 1 from public.product_variants where id=v_variant_id and is_active=true) then raise exception 'A selected SKU is missing or inactive'; end if;
    if exists(select 1 from jsonb_array_elements(p_items) x where x->>'variant_id'=v_variant_id::text group by x->>'variant_id' having count(*)>1) then raise exception 'Duplicate SKU lines are not allowed'; end if;
    v_subtotal := v_subtotal + round(v_quantity*v_unit_cost,2); v_item_count := v_item_count+1;
  end loop;
  v_po_number := 'PO-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.purchase_order_number_seq')::text,6,'0');
  insert into public.purchase_orders(po_number,supplier_id,warehouse_id,supplier_name_snapshot,supplier_email_snapshot,supplier_phone_snapshot,supplier_reference,status,currency,order_date,expected_date,subtotal,total_amount,notes,created_by)
  values(v_po_number,v_supplier_id,v_warehouse_id,v_supplier_name,v_supplier_email,v_supplier_phone,nullif(btrim(coalesce(p_supplier_reference,'')),''),'draft',p_currency,current_date,p_expected_date,v_subtotal,v_subtotal,nullif(btrim(coalesce(p_notes,'')),''),auth.uid())
  returning id into v_po_id;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_variant_id := (v_item->>'variant_id')::uuid; v_quantity := (v_item->>'quantity')::integer; v_unit_cost := (v_item->>'unit_cost')::numeric(14,2);
    insert into public.purchase_order_items(purchase_order_id,variant_id,quantity_ordered,unit_cost,line_total)
    values(v_po_id,v_variant_id,v_quantity,v_unit_cost,round(v_quantity*v_unit_cost,2));
  end loop;
  return jsonb_build_object('id',v_po_id,'po_number',v_po_number,'supplier_id',v_supplier_id,'item_count',v_item_count,'subtotal',v_subtotal,'total_amount',v_subtotal);
end; $$;

create or replace function public.admin_submit_purchase_order_v2(p_purchase_order_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_order public.purchase_orders%rowtype;
begin
  if auth.uid() is null or not public.can_manage_catalog() then raise exception 'Not authorized to submit purchase orders'; end if;
  select * into v_order from public.purchase_orders where id=p_purchase_order_id for update;
  if not found then raise exception 'Purchase order not found'; end if;
  if v_order.status<>'draft' then raise exception 'Only draft purchase orders can be submitted'; end if;
  if not exists(select 1 from public.purchase_order_items where purchase_order_id=p_purchase_order_id) then raise exception 'Purchase order has no line items'; end if;
  update public.purchase_orders set status='submitted',submitted_at=now(),updated_at=now() where id=p_purchase_order_id;
end; $$;

create or replace function public.admin_receive_purchase_order_line_v2(
 p_purchase_order_item_id uuid,p_quantity integer,p_damaged integer default 0,p_notes text default null,p_supplier_delivery_reference text default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
 v_item public.purchase_order_items%rowtype; v_order public.purchase_orders%rowtype;
 v_receipt_id uuid; v_receipt_number text; v_inventory public.inventory%rowtype;
 v_remaining integer; v_total_ordered integer; v_total_received integer;
begin
 if auth.uid() is null or not public.can_manage_catalog() then raise exception 'Not authorized to receive purchase orders'; end if;
 if p_purchase_order_item_id is null or p_quantity is null or p_quantity<1 or p_quantity>1000000
    or p_damaged is null or p_damaged<0 or p_damaged>p_quantity
    or length(coalesce(p_notes,''))>500 or length(coalesce(p_supplier_delivery_reference,''))>160 then raise exception 'Invalid goods receipt quantities or details'; end if;
 select po.* into v_order from public.purchase_orders po join public.purchase_order_items poi on poi.purchase_order_id=po.id where poi.id=p_purchase_order_item_id for update of po;
 if not found then raise exception 'Purchase order line not found'; end if;
 if v_order.status not in ('submitted','partially_received') then raise exception 'Only submitted purchase orders can receive stock'; end if;
 select * into v_item from public.purchase_order_items where id=p_purchase_order_item_id and purchase_order_id=v_order.id for update;
 v_remaining := v_item.quantity_ordered-v_item.quantity_received;
 if p_quantity>v_remaining then raise exception 'Received quantity exceeds the remaining ordered quantity (% remaining)',v_remaining; end if;
 v_receipt_number := 'GR-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.goods_receipt_number_seq')::text,6,'0');
 insert into public.goods_receipts(receipt_number,purchase_order_id,warehouse_id,status,supplier_delivery_reference,notes,received_at,received_by,posted_at)
 values(v_receipt_number,v_order.id,v_order.warehouse_id,'posted',nullif(btrim(coalesce(p_supplier_delivery_reference,'')),''),nullif(btrim(coalesce(p_notes,'')),''),now(),auth.uid(),now()) returning id into v_receipt_id;
 insert into public.goods_receipt_items(goods_receipt_id,purchase_order_item_id,quantity_received,quantity_damaged,notes)
 values(v_receipt_id,v_item.id,p_quantity,p_damaged,nullif(btrim(coalesce(p_notes,'')),''));
 update public.purchase_order_items set quantity_received=quantity_received+p_quantity,updated_at=now() where id=v_item.id;
 insert into public.inventory(warehouse_id,variant_id,on_hand,reserved,damaged,reorder_point)
 values(v_order.warehouse_id,v_item.variant_id,0,0,0,0) on conflict(warehouse_id,variant_id) do nothing;
 select * into v_inventory from public.inventory where warehouse_id=v_order.warehouse_id and variant_id=v_item.variant_id for update;
 update public.inventory set on_hand=on_hand+p_quantity,damaged=damaged+p_damaged,updated_at=now() where id=v_inventory.id;
 insert into public.inventory_movements(warehouse_id,variant_id,movement_type,quantity_change,reserved_change,damaged_change,reference_type,reference_id,notes,created_by)
 values(v_order.warehouse_id,v_item.variant_id,'purchase_receipt'::public.inventory_movement_type,p_quantity,0,p_damaged,'goods_receipt',v_receipt_id,coalesce(nullif(btrim(coalesce(p_notes,'')),''),'Purchase order '||v_order.po_number),auth.uid());
 select coalesce(sum(quantity_ordered),0),coalesce(sum(quantity_received),0) into v_total_ordered,v_total_received from public.purchase_order_items where purchase_order_id=v_order.id;
 update public.purchase_orders set status=case when v_total_received=v_total_ordered then 'received'::public.purchase_order_status else 'partially_received'::public.purchase_order_status end,updated_at=now() where id=v_order.id;
 return jsonb_build_object('receipt_id',v_receipt_id,'receipt_number',v_receipt_number,'quantity_received',p_quantity,'quantity_damaged',p_damaged,'order_status',case when v_total_received=v_total_ordered then 'received' else 'partially_received' end);
end; $$;

create or replace function public.admin_record_purchase_order_payment(
 p_purchase_order_id uuid,p_amount numeric,p_payment_date date,p_payment_method text,p_reference_number text default null,p_notes text default null
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_order public.purchase_orders%rowtype; v_paid numeric(14,2); v_payment_id uuid; v_amount numeric(14,2);
begin
 if auth.uid() is null or not public.can_manage_catalog() then raise exception 'Not authorized to record supplier payments'; end if;
 if p_purchase_order_id is null or p_amount is null or p_amount<=0 or p_amount>999999999999.99 or p_amount<>round(p_amount,2)
    or p_payment_date is null or p_payment_date>current_date
    or p_payment_method not in ('bank_transfer','cash','card','other')
    or length(coalesce(p_reference_number,''))>160 or length(coalesce(p_notes,''))>2000 then raise exception 'Invalid supplier payment details'; end if;
 select * into v_order from public.purchase_orders where id=p_purchase_order_id for update;
 if not found then raise exception 'Purchase order not found'; end if;
 if v_order.status in ('draft','cancelled') then raise exception 'Payments cannot be recorded for draft or cancelled purchase orders'; end if;
 v_amount:=round(p_amount,2);
 select coalesce(sum(amount),0) into v_paid from public.purchase_order_payments where purchase_order_id=p_purchase_order_id;
 if v_paid+v_amount>v_order.total_amount then raise exception 'Payment exceeds outstanding balance (% remaining)',greatest(v_order.total_amount-v_paid,0); end if;
 insert into public.purchase_order_payments(purchase_order_id,amount,currency,payment_date,payment_method,reference_number,notes,created_by)
 values(p_purchase_order_id,v_amount,v_order.currency,p_payment_date,p_payment_method,nullif(btrim(coalesce(p_reference_number,'')),''),nullif(btrim(coalesce(p_notes,'')),''),auth.uid())
 returning id into v_payment_id;
 return v_payment_id;
end; $$;

revoke all on function public.admin_create_purchase_order_v3(uuid,text,text,text,boolean,text,text,text,date,jsonb) from public,anon;
revoke all on function public.admin_submit_purchase_order_v2(uuid) from public,anon;
revoke all on function public.admin_receive_purchase_order_line_v2(uuid,integer,integer,text,text) from public,anon;
revoke all on function public.admin_record_purchase_order_payment(uuid,numeric,date,text,text,text) from public,anon;
grant execute on function public.admin_create_purchase_order_v3(uuid,text,text,text,boolean,text,text,text,date,jsonb) to authenticated;
grant execute on function public.admin_submit_purchase_order_v2(uuid) to authenticated;
grant execute on function public.admin_receive_purchase_order_line_v2(uuid,integer,integer,text,text) to authenticated;
grant execute on function public.admin_record_purchase_order_payment(uuid,numeric,date,text,text,text) to authenticated;
