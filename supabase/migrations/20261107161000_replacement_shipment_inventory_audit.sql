create or replace function public.log_shipment_issue_event()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_type text; v_description text;
begin
 if tg_op='INSERT' then
  insert into public.shipment_issue_events(issue_id,event_type,description,new_values,created_by)
  values(new.id,'issue_created','Shipment issue recorded: '||new.issue_type,jsonb_build_object('reason',new.reason,'status',new.status),auth.uid());
  return new;
 end if;
 if row(new.status,new.resolution_action,new.resolution_notes,new.refund_amount,new.refund_reference,new.refund_confirmed_at,new.replacement_shipment_id,new.replacement_stock_source,new.replacement_stock_quantity,new.replacement_stock_warehouse_id)
    is distinct from row(old.status,old.resolution_action,old.resolution_notes,old.refund_amount,old.refund_reference,old.refund_confirmed_at,old.replacement_shipment_id,old.replacement_stock_source,old.replacement_stock_quantity,old.replacement_stock_warehouse_id) then
  v_type:=case when new.refund_confirmed_at is distinct from old.refund_confirmed_at and new.refund_confirmed_at is not null then 'refund_recorded'
               when new.replacement_shipment_id is distinct from old.replacement_shipment_id then 'replacement_created'
               when new.status is distinct from old.status then 'status_updated' else 'resolution_updated' end;
  v_description:=case v_type when 'refund_recorded' then 'Actual refund recorded' when 'replacement_created' then 'Replacement shipment created' when 'status_updated' then 'Issue status updated' else 'Issue resolution details updated' end;
  insert into public.shipment_issue_events(issue_id,event_type,description,old_values,new_values,created_by)
  values(new.id,v_type,v_description,
    jsonb_build_object('status',old.status,'resolution_action',old.resolution_action,'resolution_notes',old.resolution_notes,'refund_amount',old.refund_amount,'refund_reference',old.refund_reference,'replacement_shipment_id',old.replacement_shipment_id,'replacement_stock_source',old.replacement_stock_source,'replacement_stock_quantity',old.replacement_stock_quantity,'replacement_stock_warehouse_id',old.replacement_stock_warehouse_id),
    jsonb_build_object('status',new.status,'resolution_action',new.resolution_action,'resolution_notes',new.resolution_notes,'refund_amount',new.refund_amount,'refund_reference',new.refund_reference,'replacement_shipment_id',new.replacement_shipment_id,'replacement_stock_source',new.replacement_stock_source,'replacement_stock_quantity',new.replacement_stock_quantity,'replacement_stock_warehouse_id',new.replacement_stock_warehouse_id),auth.uid());
 end if;
 return new;
end;
$function$;
revoke all on function public.log_shipment_issue_event() from public,anon,authenticated;