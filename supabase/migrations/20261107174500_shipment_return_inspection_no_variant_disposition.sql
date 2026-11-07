create or replace function public.admin_inspect_shipment_return(p_receipt_id uuid,p_condition text,p_notes text default null)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_receipt public.shipment_return_receipts%rowtype; v_item public.order_items%rowtype; v_inventory public.inventory%rowtype;
begin
 if not public.can_manage_catalog() then raise exception 'You do not have permission to inspect returned goods.'; end if;
 if p_receipt_id is null or p_condition is null or p_condition not in ('restockable','damaged','not_restocked') or length(coalesce(p_notes,''))>1000 then raise exception 'Choose a valid inspection result.'; end if;
 select * into v_receipt from public.shipment_return_receipts where id=p_receipt_id for update;
 if not found then raise exception 'Return receipt not found.'; end if;
 if v_receipt.condition<>'pending_inspection' or v_receipt.inventory_posted_at is not null then raise exception 'This return receipt has already been inspected.'; end if;
 select * into v_item from public.order_items where id=v_receipt.order_item_id;
 if not found then raise exception 'Order item no longer exists.'; end if;
 if p_condition in ('restockable','damaged') then
  if v_item.variant_id is null then raise exception 'Product variant is unavailable; inventory cannot be updated.'; end if;
  select * into v_inventory from public.inventory where warehouse_id=v_receipt.warehouse_id and variant_id=v_item.variant_id for update;
  if not found then raise exception 'Inventory record is missing for this warehouse and SKU.'; end if;
  update public.inventory set on_hand=on_hand+v_receipt.quantity_received,damaged=damaged+case when p_condition='damaged' then v_receipt.quantity_received else 0 end,updated_at=now() where id=v_inventory.id;
  insert into public.inventory_movements(warehouse_id,variant_id,movement_type,quantity_change,damaged_change,reference_type,reference_id,notes,created_by)
  values(v_receipt.warehouse_id,v_item.variant_id,'customer_return',v_receipt.quantity_received,case when p_condition='damaged' then v_receipt.quantity_received else 0 end,'shipment_return',v_receipt.id,'Inspected customer return; condition: '||p_condition,auth.uid());
 end if;
 update public.shipment_return_receipts set condition=p_condition,notes=case when p_notes is null or trim(p_notes)='' then notes else left(trim(p_notes),1000) end,inspected_by=auth.uid(),inspected_at=now(),inventory_posted_at=case when p_condition in ('restockable','damaged') then now() else null end where id=p_receipt_id;
 insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,new_values)
 values(auth.uid(),'shipment_return.inspected','shipment_issue',v_receipt.issue_id,jsonb_build_object('receipt_id',p_receipt_id,'quantity',v_receipt.quantity_received,'condition',p_condition,'warehouse_id',v_receipt.warehouse_id));
 return jsonb_build_object('receipt_id',p_receipt_id,'condition',p_condition,'inventory_posted',p_condition in ('restockable','damaged'));
end;
$function$;
revoke all on function public.admin_inspect_shipment_return(uuid,text,text) from public,anon;
grant execute on function public.admin_inspect_shipment_return(uuid,text,text) to authenticated;