create or replace function public.admin_record_shipment_return(
 p_issue_id uuid,p_order_item_id uuid,p_quantity integer,p_warehouse_id uuid,p_condition text,p_notes text default null
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_issue public.shipment_issue_cases%rowtype; v_shipment_item_qty integer; v_already_received integer; v_item public.order_items%rowtype; v_wh public.warehouses%rowtype; v_receipt_id uuid;
begin
 if not public.can_manage_catalog() then raise exception 'You do not have permission to record returned goods.'; end if;
 if p_issue_id is null or p_order_item_id is null or p_quantity is null or p_quantity<1 or p_quantity>100000 or p_warehouse_id is null or p_condition<>'pending_inspection' or length(coalesce(p_notes,''))>1000 then
  raise exception 'New return receipts must be recorded as pending inspection.';
 end if;
 select * into v_issue from public.shipment_issue_cases where id=p_issue_id for update;
 if not found then raise exception 'Shipment issue not found.'; end if;
 select * into v_item from public.order_items where id=p_order_item_id and order_id=v_issue.order_id;
 if not found then raise exception 'Order item does not belong to this order.'; end if;
 select coalesce(sum(quantity),0)::integer into v_shipment_item_qty from public.shipment_items where shipment_id=v_issue.shipment_id and order_item_id=p_order_item_id;
 if v_shipment_item_qty<1 then raise exception 'This item was not included in the original shipment.'; end if;
 select coalesce(sum(quantity_received),0)::integer into v_already_received from public.shipment_return_receipts where issue_id=p_issue_id and order_item_id=p_order_item_id;
 if v_already_received+p_quantity>v_shipment_item_qty then raise exception 'Returned quantity exceeds the quantity in the original shipment. Shipped: %, already recorded: %, new: %.',v_shipment_item_qty,v_already_received,p_quantity; end if;
 select * into v_wh from public.warehouses where id=p_warehouse_id and is_active=true;
 if not found then raise exception 'Select an active warehouse.'; end if;
 insert into public.shipment_return_receipts(issue_id,order_item_id,warehouse_id,quantity_received,condition,notes,created_by)
 values(p_issue_id,p_order_item_id,v_wh.id,p_quantity,'pending_inspection',nullif(trim(p_notes),''),auth.uid())
 returning id into v_receipt_id;
 insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,new_values)
 values(auth.uid(),'shipment_return.received','shipment_issue',p_issue_id,jsonb_build_object('receipt_id',v_receipt_id,'order_item_id',p_order_item_id,'quantity',p_quantity,'condition','pending_inspection','warehouse_id',v_wh.id));
 return v_receipt_id;
end;
$function$;
revoke all on function public.admin_record_shipment_return(uuid,uuid,integer,uuid,text,text) from public,anon;
grant execute on function public.admin_record_shipment_return(uuid,uuid,integer,uuid,text,text) to authenticated;