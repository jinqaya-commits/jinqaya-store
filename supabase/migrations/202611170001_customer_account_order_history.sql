create or replace function public.get_my_customer_account_orders()
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_customer_id uuid;
  v_first_name text;
  v_last_name text;
  v_phone text;
  v_orders jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;
  select lower(trim(u.email)) into v_email from auth.users u
   where u.id=v_user_id and u.email_confirmed_at is not null;
  if v_email is null or v_email='' then raise exception 'A verified email address is required.'; end if;

  select c.id,c.first_name,c.last_name,c.phone
    into v_customer_id,v_first_name,v_last_name,v_phone
    from public.customers c
   where lower(trim(c.email))=v_email
     and (c.auth_user_id is null or c.auth_user_id=v_user_id)
   order by c.created_at asc limit 1 for update;

  if v_customer_id is null then
    return jsonb_build_object('email',v_email,'first_name','','last_name','','phone',null,'orders','[]'::jsonb);
  end if;

  update public.customers set auth_user_id=v_user_id,updated_at=now()
   where id=v_customer_id and auth_user_id is null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'order_number',o.order_number,'status',o.status::text,'created_at',o.created_at,'updated_at',o.updated_at,
    'currency',o.currency,'subtotal',o.subtotal,'shipping_amount',o.shipping_amount,
    'total_amount',o.total_amount,'shipping_method',o.shipping_method_name,
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'product_name',oi.product_name,'variant_name',oi.variant_name,'quantity',oi.quantity,
      'unit_price',oi.unit_price,'line_total',oi.line_total
    ) order by oi.created_at) from public.order_items oi where oi.order_id=o.id),'[]'::jsonb),
    'shipment',(select jsonb_build_object('status',sh.status::text,'carrier',sh.carrier_name,
      'tracking_number',sh.tracking_number,'tracking_url',sh.tracking_url,
      'shipped_at',sh.shipped_at,'delivered_at',sh.delivered_at)
      from public.shipments sh where sh.order_id=o.id order by sh.created_at desc limit 1)
  ) order by o.created_at desc),'[]'::jsonb) into v_orders
  from public.orders o where o.customer_id=v_customer_id;

  return jsonb_build_object('email',v_email,'first_name',coalesce(v_first_name,''),'last_name',coalesce(v_last_name,''),'phone',v_phone,'orders',v_orders);
end;
$function$;
revoke all on function public.get_my_customer_account_orders() from public,anon;
grant execute on function public.get_my_customer_account_orders() to authenticated;
