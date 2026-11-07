alter table public.shipment_return_receipts alter column issue_id drop not null;
alter table public.shipment_return_receipts add column if not exists after_sales_case_id uuid references public.after_sales_cases(id) on delete restrict;
do $$
begin
 if not exists(select 1 from pg_constraint where conname='shipment_return_receipt_single_parent') then
  alter table public.shipment_return_receipts add constraint shipment_return_receipt_single_parent
   check ((issue_id is not null and after_sales_case_id is null) or (issue_id is null and after_sales_case_id is not null));
 end if;
end $$;
create index if not exists shipment_return_receipts_after_sales_case_idx on public.shipment_return_receipts(after_sales_case_id,created_at desc);

create or replace function public.admin_record_after_sales_return(
 p_case_id uuid,p_order_item_id uuid,p_quantity integer,p_warehouse_id uuid,p_notes text default null
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_case public.after_sales_cases%rowtype; v_item public.order_items%rowtype; v_already integer; v_wh public.warehouses%rowtype; v_receipt_id uuid;
begin
 if not public.can_manage_catalog() then raise exception 'You do not have permission to record returned goods.'; end if;
 if p_case_id is null or p_order_item_id is null or p_quantity is null or p_quantity<1 or p_quantity>100000 or p_warehouse_id is null or length(coalesce(p_notes,''))>1000 then raise exception 'Enter valid return receipt details.'; end if;
 select * into v_case from public.after_sales_cases where id=p_case_id for update;
 if not found then raise exception 'After-sales case not found.'; end if;
 if v_case.status not in ('approved','under_review') then raise exception 'Only approved or under-review after-sales cases can receive returned goods.'; end if;
 select * into v_item from public.order_items where id=p_order_item_id and order_id=v_case.order_id;
 if not found then raise exception 'Order item does not belong to this case order.'; end if;
 select coalesce(sum(quantity_received),0)::integer into v_already from public.shipment_return_receipts where order_item_id=p_order_item_id;
 if v_already+p_quantity>v_item.quantity then raise exception 'Returned quantity exceeds the ordered quantity. Ordered: %, already recorded: %, new: %.',v_item.quantity,v_already,p_quantity; end if;
 select * into v_wh from public.warehouses where id=p_warehouse_id and is_active=true;
 if not found then raise exception 'Select an active warehouse.'; end if;
 insert into public.shipment_return_receipts(issue_id,after_sales_case_id,order_item_id,warehouse_id,quantity_received,condition,notes,created_by)
 values(null,p_case_id,p_order_item_id,v_wh.id,p_quantity,'pending_inspection',nullif(trim(p_notes),''),auth.uid()) returning id into v_receipt_id;
 insert into public.activity_logs(actor_user_id,action,entity_type,entity_id,new_values)
 values(auth.uid(),'after_sales_return.received','after_sales_case',p_case_id,jsonb_build_object('receipt_id',v_receipt_id,'order_item_id',p_order_item_id,'quantity',p_quantity,'condition','pending_inspection','warehouse_id',v_wh.id));
 return v_receipt_id;
end;
$function$;
revoke all on function public.admin_record_after_sales_return(uuid,uuid,integer,uuid,text) from public,anon;
grant execute on function public.admin_record_after_sales_return(uuid,uuid,integer,uuid,text) to authenticated;