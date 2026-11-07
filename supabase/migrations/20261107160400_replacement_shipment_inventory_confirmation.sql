alter table public.shipment_issue_cases
 add column if not exists replacement_stock_source text check (replacement_stock_source in ('returned_item','new_inventory')),
 add column if not exists replacement_stock_quantity integer,
 add column if not exists replacement_stock_warehouse_id uuid references public.warehouses(id) on delete set null;
do $$
begin
 if not exists(select 1 from pg_constraint where conname='shipment_issue_replacement_stock_quantity_positive') then
  alter table public.shipment_issue_cases add constraint shipment_issue_replacement_stock_quantity_positive check (replacement_stock_quantity is null or replacement_stock_quantity > 0);
 end if;
end $$;
drop function if exists public.admin_create_replacement_shipment(uuid,text,text,text);
create function public.admin_create_replacement_shipment(
 p_issue_id uuid,p_carrier_name text,p_tracking_number text,p_tracking_url text,p_stock_source text
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_issue public.shipment_issue_cases%rowtype; v_old public.shipments%rowtype; v_new_id uuid; v_warehouse uuid; v_item record; v_inventory public.inventory%rowtype; v_count integer;
begin
 if not public.can_manage_catalog() then raise exception 'You do not have permission to create replacement shipments.'; end if;
 if p_stock_source is null or p_stock_source not in ('returned_item','new_inventory') then raise exception 'Choose how replacement stock will be supplied.'; end if;
 select * into v_issue from public.shipment_issue_cases where id=p_issue_id for update;
 if not found then raise exception 'Shipment issue not found.'; end if;
 if v_issue.resolution_action <> 'reship' then raise exception 'Set the resolution to Reship before creating a replacement shipment.'; end if;
 if v_issue.replacement_shipment_id is not null then raise exception 'A replacement shipment has already been created.'; end if;
 select * into v_old from public.shipments where id=v_issue.shipment_id for update;
 if not found then raise exception 'Original shipment not found.'; end if;
 if length(trim(coalesce(p_carrier_name,'')))<2 or length(trim(coalesce(p_tracking_number,'')))<3 or length(p_carrier_name)>100 or length(p_tracking_number)>150 then raise exception 'Enter a valid carrier and tracking number.'; end if;
 if p_tracking_url is not null and p_tracking_url<>'' and p_tracking_url !~ '^https?://' then raise exception 'Tracking URL must start with https:// or http://.'; end if;
 select id into v_warehouse from public.warehouses where is_default=true and is_active=true order by created_at limit 1;
 if v_warehouse is null then raise exception 'No active default warehouse is configured.'; end if;
 select coalesce(sum(si.quantity),0)::integer into v_count from public.shipment_items si where si.shipment_id=v_old.id;
 if v_count < 1 then raise exception 'Original shipment has no shipment items; replacement was not created.'; end if;
 if exists(select 1 from public.shipment_items si join public.order_items oi on oi.id=si.order_item_id where si.shipment_id=v_old.id and oi.variant_id is null) then raise exception 'An original shipment item has no product variant; inventory cannot be checked.'; end if;
 if p_stock_source='new_inventory' then
  for v_item in
   select oi.variant_id,sum(si.quantity)::integer quantity
   from public.shipment_items si join public.order_items oi on oi.id=si.order_item_id
   where si.shipment_id=v_old.id group by oi.variant_id order by oi.variant_id
  loop
   select * into v_inventory from public.inventory where warehouse_id=v_warehouse and variant_id=v_item.variant_id for update;
   if not found then raise exception 'Inventory is not initialized for SKU %. Create its inventory record first.',(select sku from public.product_variants where id=v_item.variant_id); end if;
   if v_inventory.on_hand-v_inventory.reserved-v_inventory.damaged < v_item.quantity then
    raise exception 'Insufficient available stock for SKU %. Available: %, required: %.',(select sku from public.product_variants where id=v_item.variant_id),v_inventory.on_hand-v_inventory.reserved-v_inventory.damaged,v_item.quantity;
   end if;
   update public.inventory set on_hand=on_hand-v_item.quantity,updated_at=now() where id=v_inventory.id;
   insert into public.inventory_movements(warehouse_id,variant_id,movement_type,quantity_change,reserved_change,reference_type,reference_id,notes,created_by)
   values(v_warehouse,v_item.variant_id,'sale',-v_item.quantity,0,'shipment_issue',v_issue.id,'Replacement shipment stock deduction for shipment issue '||v_issue.id::text,auth.uid());
  end loop;
 end if;
 insert into public.shipments(order_id,status,carrier_name,tracking_number,tracking_url,shipping_cost,currency,shipped_at,shipped_by,notes)
 values(v_old.order_id,'shipped',left(trim(p_carrier_name),100),left(trim(p_tracking_number),150),nullif(trim(p_tracking_url),''),0,v_old.currency,now(),auth.uid(),'Replacement for shipment '||v_old.id::text||'; stock source: '||p_stock_source)
 returning id into v_new_id;
 insert into public.shipment_items(shipment_id,order_item_id,quantity) select v_new_id,order_item_id,quantity from public.shipment_items where shipment_id=v_old.id;
 get diagnostics v_count = row_count;
 if v_count < 1 then raise exception 'Original shipment has no shipment items; replacement was not created.'; end if;
 update public.shipment_issue_cases set replacement_shipment_id=v_new_id,replacement_stock_source=p_stock_source,
  replacement_stock_quantity=(select coalesce(sum(quantity),0)::integer from public.shipment_items where shipment_id=v_old.id),
  replacement_stock_warehouse_id=case when p_stock_source='new_inventory' then v_warehouse else null end,
  status='in_progress',updated_by=auth.uid(),updated_at=now() where id=p_issue_id;
 return v_new_id;
end;
$function$;
revoke all on function public.admin_create_replacement_shipment(uuid,text,text,text,text) from public,anon;
grant execute on function public.admin_create_replacement_shipment(uuid,text,text,text,text) to authenticated;