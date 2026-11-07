do $$
declare v_def text; v_old text;
begin
 select pg_get_functiondef('public.admin_confirm_after_sales_refund(uuid,numeric,text)'::regprocedure) into v_def;
 v_def:=replace(v_def,'; v_new_status public.order_status;',';');
 v_old:=$as$v_new_status:=case when v_refunded+p_refund_amount>=v_paid then 'refunded'::public.order_status else 'partially_refunded'::public.order_status end;
 if v_order.status<>v_new_status then
  update public.orders set status=v_new_status,updated_at=now() where id=v_order_id;
  insert into public.order_status_history(order_id,old_status,new_status,note,changed_by) values(v_order_id,v_order.status,v_new_status,'Refund confirmed',auth.uid());
 end if;
$as$;
 if position(v_old in v_def)=0 then raise exception 'After-sales order status block was not found.'; end if;
 v_def:=replace(v_def,v_old,'');
 execute v_def;

 select pg_get_functiondef('public.admin_update_shipment_issue(uuid,text,text,text,numeric,text,boolean)'::regprocedure) into v_def;
 v_def:=replace(v_def,'; v_new_status public.order_status;',';');
 v_old:=$as$v_new_status:=case when v_refunded+p_refund_amount>=v_paid then 'refunded'::public.order_status else 'partially_refunded'::public.order_status end;
  if v_order.status<>v_new_status then
   update public.orders set status=v_new_status,updated_at=now() where id=v_order_id;
   insert into public.order_status_history(order_id,old_status,new_status,note,changed_by) values(v_order_id,v_order.status,v_new_status,'Refund confirmed',auth.uid());
  end if;
$as$;
 if position(v_old in v_def)=0 then raise exception 'Shipment issue order status block was not found.'; end if;
 v_def:=replace(v_def,v_old,'');
 execute v_def;
end $$;