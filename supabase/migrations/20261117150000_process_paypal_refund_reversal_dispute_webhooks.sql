-- PayPal refunds, reversals, and disputes are recorded from verified webhooks.
-- Payment review flags block fulfillment; refund state remains separate from order fulfillment status.

create or replace function public.guard_payment_review_before_fulfillment()
returns trigger language plpgsql set search_path = ''
as $function$
begin
  if new.status is distinct from old.status
     and new.status in ('processing'::public.order_status,'partially_shipped'::public.order_status,'shipped'::public.order_status)
     and exists(select 1 from public.payments p where p.order_id=new.id and (p.payment_review_required is true or p.status='refunded'::public.payment_status)) then
    raise exception 'Payment review is required before this order can enter fulfilment.';
  end if;
  return new;
end;
$function$;
drop trigger if exists orders_guard_payment_review_before_fulfillment on public.orders;
create trigger orders_guard_payment_review_before_fulfillment
before update of status on public.orders for each row
execute function public.guard_payment_review_before_fulfillment();

create or replace function public.guard_manual_refund_during_payment_review()
returns trigger language plpgsql set search_path = ''
as $function$
begin
  if new.source_type in ('after_sales_case','shipment_issue')
     and exists(select 1 from public.payments p where p.order_id=new.order_id and p.payment_review_required is true) then
    raise exception 'Payment review is required before recording another manual refund.';
  end if;
  return new;
end;
$function$;
drop trigger if exists order_refunds_guard_payment_review on public.order_refunds;
create trigger order_refunds_guard_payment_review
before insert on public.order_refunds for each row
execute function public.guard_manual_refund_during_payment_review();

create or replace function public.process_paypal_non_capture_webhook(
  p_event_id text,p_event_type text,p_resource_id text,p_resource jsonb,
  p_capture_id text default null,p_amount numeric default null,p_currency text default null,p_dispute_id text default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_refund_total numeric(12,2);
  v_refund_id text;
  v_dispute_status text;
  v_dispute_reason text;
begin
  if coalesce(length(trim(p_event_id)),0)<5 or coalesce(length(trim(p_event_type)),0)<5
     or p_resource is null or jsonb_typeof(p_resource)<>'object' then
    raise exception 'Invalid PayPal webhook event.';
  end if;

  insert into public.paypal_webhook_events(paypal_event_id,event_type,resource_id,processing_status,payload)
  values(trim(p_event_id),trim(p_event_type),nullif(trim(coalesce(p_resource_id,'')),''),'received',p_resource)
  on conflict(paypal_event_id) do nothing;
  if not found then return jsonb_build_object('received',true,'duplicate',true); end if;

  if p_event_type not in ('PAYMENT.CAPTURE.REFUNDED','PAYMENT.CAPTURE.REVERSED',
    'CUSTOMER.DISPUTE.CREATED','CUSTOMER.DISPUTE.UPDATED','CUSTOMER.DISPUTE.RESOLVED') then
    update public.paypal_webhook_events set processing_status='ignored',processed_at=pg_catalog.now()
     where paypal_event_id=trim(p_event_id);
    return jsonb_build_object('received',true,'ignored',true);
  end if;

  if p_event_type like 'CUSTOMER.DISPUTE.%' then
    if coalesce(length(trim(p_dispute_id)),0)<3 or coalesce(length(trim(p_capture_id)),0)<5 then
      raise exception 'Dispute event is missing its dispute or capture reference.';
    end if;
    select * into v_payment from public.payments
     where provider='paypal' and provider_payment_id=trim(p_capture_id) for update;
    if not found then raise exception 'No matching PayPal capture was found for this dispute.'; end if;
    select * into v_order from public.orders where id=v_payment.order_id for update;
    v_dispute_status:=coalesce(nullif(p_resource->>'status',''),nullif(p_resource->>'dispute_state',''),'UNKNOWN');
    v_dispute_reason:=nullif(p_resource->>'reason','');

    insert into public.paypal_disputes(dispute_id,order_id,payment_id,capture_id,status,reason,amount,currency,resource)
    values(trim(p_dispute_id),v_payment.order_id,v_payment.id,trim(p_capture_id),v_dispute_status,v_dispute_reason,
      case when p_amount is not null and p_amount>0 then round(p_amount,2) else null end,
      upper(nullif(trim(coalesce(p_currency,'')),'')),p_resource)
    on conflict(dispute_id) do update set status=excluded.status,
      reason=coalesce(excluded.reason,public.paypal_disputes.reason),
      amount=coalesce(excluded.amount,public.paypal_disputes.amount),
      currency=coalesce(excluded.currency,public.paypal_disputes.currency),
      resource=excluded.resource,updated_at=pg_catalog.now();

    update public.payments set payment_review_required=true,updated_at=pg_catalog.now() where id=v_payment.id;
    update public.orders set internal_note=pg_catalog.left(
      pg_catalog.concat_ws(E'\\n',nullif(internal_note,''),
        'PayPal dispute '||trim(p_dispute_id)||' ('||v_dispute_status||') requires manual review.'),2000),
      updated_at=pg_catalog.now() where id=v_order.id;
    update public.paypal_webhook_events set order_id=v_payment.order_id,payment_id=v_payment.id,
      processing_status='processed',processed_at=pg_catalog.now(),error_message=null
     where paypal_event_id=trim(p_event_id);
    return jsonb_build_object('received',true,'processed',true,'dispute_id',trim(p_dispute_id),
      'order_id',v_payment.order_id,'payment_review_required',true);
  end if;

  if coalesce(length(trim(p_capture_id)),0)<5 or p_amount is null or p_amount<=0
     or upper(trim(coalesce(p_currency,''))) !~ '^[A-Z]{3}$' then
    raise exception 'Refund or reversal event is missing verified payment details.';
  end if;
  select * into v_payment from public.payments
   where provider='paypal' and provider_payment_id=trim(p_capture_id) for update;
  if not found then raise exception 'No matching PayPal capture was found for this refund or reversal.'; end if;
  select * into v_order from public.orders where id=v_payment.order_id for update;

  if upper(trim(v_payment.currency))<>upper(trim(p_currency)) then
    update public.payments set payment_review_required=true,updated_at=pg_catalog.now() where id=v_payment.id;
    raise exception 'PayPal refund currency does not match the original capture.';
  end if;

  if p_event_type='PAYMENT.CAPTURE.REFUNDED' then
    v_refund_id:=coalesce(nullif(p_resource->>'id',''),nullif(p_resource->>'refund_id',''),trim(p_event_id));
    if exists(select 1 from public.order_refunds where source_type='paypal_webhook' and transaction_number=v_refund_id) then
      update public.paypal_webhook_events set order_id=v_payment.order_id,payment_id=v_payment.id,
        processing_status='processed',processed_at=pg_catalog.now(),error_message=null
       where paypal_event_id=trim(p_event_id);
      return jsonb_build_object('received',true,'duplicate_refund',true,'order_id',v_payment.order_id);
    end if;
    select coalesce(sum(amount),0)::numeric(12,2) into v_refund_total
      from public.order_refunds where payment_id=v_payment.id;
    if round(v_refund_total+p_amount,2)>round(v_payment.amount,2) then
      update public.payments set payment_review_required=true,updated_at=pg_catalog.now() where id=v_payment.id;
      raise exception 'Cumulative PayPal refunds exceed the original capture amount.';
    end if;
    insert into public.order_refunds(order_id,payment_id,source_type,source_id,amount,currency,reference,
      refund_method,transaction_number,confirmed_at)
    values(v_payment.order_id,v_payment.id,'paypal_webhook',gen_random_uuid(),round(p_amount,2),
      upper(trim(p_currency)),'PayPal refund webhook '||trim(p_event_id),'paypal',v_refund_id,pg_catalog.now());

    v_refund_total:=v_refund_total+round(p_amount,2);
    update public.payments set status=case when v_refund_total>=round(amount,2)
      then 'refunded'::public.payment_status else 'partially_refunded'::public.payment_status end,
      updated_at=pg_catalog.now() where id=v_payment.id;
    -- Refund status is independent of order fulfilment status.
    update public.orders set internal_note=pg_catalog.left(
      pg_catalog.concat_ws(E'\\n',nullif(internal_note,''),
        'PayPal refund recorded: '||round(p_amount,2)::text||' '||upper(trim(p_currency))||
        ' (cumulative '||v_refund_total::text||').'),2000),
      updated_at=pg_catalog.now() where id=v_order.id;
    update public.paypal_webhook_events set order_id=v_payment.order_id,payment_id=v_payment.id,
      processing_status='processed',processed_at=pg_catalog.now(),error_message=null
     where paypal_event_id=trim(p_event_id);
    return jsonb_build_object('received',true,'processed',true,'refund_amount',round(p_amount,2),
      'cumulative_refund_amount',v_refund_total,'order_id',v_payment.order_id);
  end if;

  -- Reversals are not automatically treated as customer refunds or stock restocks.
  update public.payments set payment_review_required=true,updated_at=pg_catalog.now() where id=v_payment.id;
  update public.orders set internal_note=pg_catalog.left(
    pg_catalog.concat_ws(E'\\n',nullif(internal_note,''),
      'PayPal capture reversal '||trim(p_event_id)||' requires manual reconciliation.'),2000),
    updated_at=pg_catalog.now() where id=v_order.id;
  update public.paypal_webhook_events set order_id=v_payment.order_id,payment_id=v_payment.id,
    processing_status='processed',processed_at=pg_catalog.now(),error_message=null
   where paypal_event_id=trim(p_event_id);
  return jsonb_build_object('received',true,'processed',true,'reversal_review_required',true,'order_id',v_payment.order_id);
end;
$function$;

revoke all on function public.process_paypal_non_capture_webhook(text,text,text,jsonb,text,numeric,text,text)
  from public,anon,authenticated;
grant execute on function public.process_paypal_non_capture_webhook(text,text,text,jsonb,text,numeric,text,text)
  to service_role;
revoke all on function public.guard_payment_review_before_fulfillment() from public,anon,authenticated;
revoke all on function public.guard_manual_refund_during_payment_review() from public,anon,authenticated;
