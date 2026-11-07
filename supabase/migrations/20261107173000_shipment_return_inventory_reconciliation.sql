create table if not exists public.shipment_return_receipts (
 id uuid primary key default gen_random_uuid(),
 issue_id uuid not null references public.shipment_issue_cases(id) on delete restrict,
 order_item_id uuid not null references public.order_items(id) on delete restrict,
 warehouse_id uuid not null references public.warehouses(id) on delete restrict,
 quantity_received integer not null check(quantity_received>0),
 condition text not null check(condition in ('pending_inspection','restockable','damaged','not_restocked')),
 notes text,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 inspected_by uuid references auth.users(id) on delete set null,
 inspected_at timestamptz,
 inventory_posted_at timestamptz,
 constraint shipment_return_inspection_state check (
  (condition='pending_inspection' and inspected_at is null and inventory_posted_at is null)
  or (condition in ('restockable','damaged','not_restocked') and inspected_at is not null)
 ),
 constraint shipment_return_inventory_posting_state check (
  (condition in ('restockable','damaged') and inventory_posted_at is not null)
  or (condition in ('pending_inspection','not_restocked') and inventory_posted_at is null)
 )
);
create index if not exists shipment_return_receipts_issue_idx on public.shipment_return_receipts(issue_id,created_at desc);
alter table public.shipment_return_receipts enable row level security;
revoke all on public.shipment_return_receipts from public,anon;
grant select on public.shipment_return_receipts to authenticated;
drop policy if exists "Staff can view shipment return receipts" on public.shipment_return_receipts;
create policy "Staff can view shipment return receipts" on public.shipment_return_receipts for select to authenticated using(public.can_manage_catalog());

create or replace function public.admin_record_shipment_return(
 p_issue_id uuid,p_order_item_id uuid,p_quantity integer,p_warehouse_id uuid,p_condition text,p_notes text default null
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_issue public.shipment_issue_cases%rowtype; v_shipment_item_qty integer; v_already_received integer; v_item public.order_items%rowtype; v_wh public.warehouses%rowtype; v_receipt_id uuid; v_inventory public.inventory%rowtype;
begin
 if not public.can_manage_catalog() then raise exception 'You do not have permission to record returned goods.'; end if;
 if p_issue_id is null or p_order_item_id is null or p_quantity is null or p_quantity<1 or p_quantity>100000 or p_warehouse_id is null or p_condition not in ('pending_inspection','restockable','damaged','not_restocked') or length(coalesce(p_notes,''))>1000 then raise exception 'Enter valid return receipt details.'; end if;
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
 if p_condition<>'pending_inspection' then
  if v_item.variant_id is null then raise exception 'This order item has no product variant; inventory cannot be restored.'; end if;
  insert into public.inventory(warehouse_id,variant_id,on_hand,reserved,damaged,reorder_point) values(v_wh.id,v_item.variant_id,0,0,0,0) on conflict(warehouse_id,variant_id) do nothing;
  select * into v_inventory from public.inventory where warehouse_id=v_wh.id and variant_id=v_item.variant_id for update;
  update public.inventory set on_hand=on_hand+p_quantity,damaged=damaged+case when p_condition='damaged' then p_quantity else 0 end,updated_at=now() where id=v_inventory.id;
 end if;
 insert into public.shipment_return_receipts(issue_id,order_item_id,warehouse_id,quantity_received,condition,notes,created_by,inspected_by,inspected_at,inventory_posted_at)
 values(p_issue_id,p_order_item_id,v_wh.id,p_quantity,p_condition,nullif(trim(p_notes),''),auth.uid(),
  case when p_condition='pending_inspection' then null else auth.uid() end,
  case when p_condition='pending_inspection' then null else now() end,
  case when p_condition in ('restockable','damaged') then now() else null end)
 returning id into v_receipt_id;
 if p_condition in ('restockable','damaged') then
  insert into public.inventory_movements(warehouse_id,variant_id,movement_type,quantity_change,damaged_change,reference_type,reference_id,notes,created_by)
  values(v_wh.id,v_item.variant_id,'customer_return',p_quantity,case when p_condition='damaged' then p_quantity else 0 end,'shipment_return',v_receipt_id,'Customer return from shipment issue '||p_issue_id::text||'; condition: '||p_condition,auth.uid());
 end if;
 insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,new_values)
 values(auth.uid(),'shipment_return.received','shipment_issue',p_issue_id,jsonb_build_object('receipt_id',v_receipt_id,'order_item_id',p_order_item_id,'quantity',p_quantity,'condition',p_condition,'warehouse_id',v_wh.id));
 return v_receipt_id;
end;
$function$;

create or replace function public.admin_inspect_shipment_return(p_receipt_id uuid,p_condition text,p_notes text default null)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_receipt public.shipment_return_receipts%rowtype; v_item public.order_items%rowtype; v_inventory public.inventory%rowtype;
begin
 if not public.can_manage_catalog() then raise exception 'You do not have permission to inspect returned goods.'; end if;
 if p_receipt_id is null or p_condition not in ('restockable','damaged','not_restocked') or length(coalesce(p_notes,''))>1000 then raise exception 'Choose a valid inspection result.'; end if;
 select * into v_receipt from public.shipment_return_receipts where id=p_receipt_id for update;
 if not found then raise exception 'Return receipt not found.'; end if;
 if v_receipt.condition<>'pending_inspection' or v_receipt.inventory_posted_at is not null then raise exception 'This return receipt has already been inspected.'; end if;
 select * into v_item from public.order_items where id=v_receipt.order_item_id;
 if not found or v_item.variant_id is null then raise exception 'Product variant is unavailable; inventory cannot be updated.'; end if;
 if p_condition in ('restockable','damaged') then
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
revoke all on function public.admin_record_shipment_return(uuid,uuid,integer,uuid,text,text) from public,anon;
revoke all on function public.admin_inspect_shipment_return(uuid,text,text) from public,anon;
grant execute on function public.admin_record_shipment_return(uuid,uuid,integer,uuid,text,text) to authenticated;
grant execute on function public.admin_inspect_shipment_return(uuid,text,text) to authenticated;
