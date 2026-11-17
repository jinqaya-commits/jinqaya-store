ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_review_required boolean NOT NULL DEFAULT false;

ALTER TABLE public.order_refunds
  ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.payments(id) ON DELETE RESTRICT;

ALTER TABLE public.order_refunds
  DROP CONSTRAINT IF EXISTS order_refunds_source_type_check;

ALTER TABLE public.order_refunds
  ADD CONSTRAINT order_refunds_source_type_check
  CHECK (source_type = ANY (ARRAY['after_sales_case'::text, 'shipment_issue'::text, 'paypal_webhook'::text]));

CREATE INDEX IF NOT EXISTS order_refunds_payment_idx
  ON public.order_refunds(payment_id, confirmed_at);

CREATE TABLE IF NOT EXISTS public.paypal_webhook_events (
  paypal_event_id text PRIMARY KEY,
  event_type text NOT NULL,
  resource_id text,
  order_id uuid REFERENCES public.orders(id) ON DELETE RESTRICT,
  payment_id uuid REFERENCES public.payments(id) ON DELETE RESTRICT,
  processing_status text NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received','processed','ignored','failed')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS paypal_webhook_events_status_idx
  ON public.paypal_webhook_events(processing_status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.paypal_disputes (
  dispute_id text PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  capture_id text NOT NULL,
  status text NOT NULL,
  reason text,
  amount numeric(12,2),
  currency character(3),
  resource jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS paypal_disputes_order_idx
  ON public.paypal_disputes(order_id, updated_at DESC);

ALTER TABLE public.paypal_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paypal_disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view PayPal disputes" ON public.paypal_disputes;
CREATE POLICY "Staff can view PayPal disputes"
  ON public.paypal_disputes FOR SELECT TO authenticated
  USING (public.can_manage_catalog());

REVOKE ALL ON public.paypal_webhook_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.paypal_disputes FROM PUBLIC, anon;
GRANT SELECT ON public.paypal_disputes TO authenticated;
GRANT ALL ON public.paypal_webhook_events, public.paypal_disputes TO service_role;

CREATE OR REPLACE FUNCTION public.process_paypal_webhook_event(
  p_event_id text,
  p_event_type text,
  p_resource_id text,
  p_capture_id text,
  p_amount numeric,
  p_currency text,
  p_dispute_status text,
  p_reason text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_event public.paypal_webhook_events%rowtype;
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_refunded numeric(12,2);
  v_paid numeric(12,2);
  v_now timestamptz := pg_catalog.now();
  v_new_status public.payment_status;
  v_order_status public.order_status;
BEGIN
  IF coalesce(length(trim(p_event_id)),0) < 5
     OR p_event_type NOT IN (
       'PAYMENT.CAPTURE.REFUNDED',
       'PAYMENT.CAPTURE.REVERSED',
       'CUSTOMER.DISPUTE.CREATED',
       'CUSTOMER.DISPUTE.UPDATED',
       'CUSTOMER.DISPUTE.RESOLVED'
     )
     OR coalesce(length(trim(p_resource_id)),0) < 1
     OR coalesce(length(trim(p_capture_id)),0) < 5 THEN
    RAISE EXCEPTION 'Invalid PayPal event details.';
  END IF;

  INSERT INTO public.paypal_webhook_events(paypal_event_id,event_type,resource_id,payload)
  VALUES (trim(p_event_id),p_event_type,trim(p_resource_id),coalesce(p_payload,'{}'::jsonb))
  ON CONFLICT (paypal_event_id) DO NOTHING;

  SELECT * INTO v_event
  FROM public.paypal_webhook_events
  WHERE paypal_event_id=trim(p_event_id)
  FOR UPDATE;

  IF v_event.processing_status='processed' OR v_event.processing_status='ignored' THEN
    RETURN jsonb_build_object('ok',true,'duplicate',true,'status',v_event.processing_status);
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE provider='paypal' AND provider_payment_id=trim(p_capture_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    UPDATE public.paypal_webhook_events
    SET processing_status='failed',error_message='No matching PayPal capture payment exists.'
    WHERE paypal_event_id=trim(p_event_id);
    RETURN jsonb_build_object('ok',false,'retry',true,'error','Matching payment not found.');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id=v_payment.order_id FOR UPDATE;
  IF NOT FOUND THEN
    UPDATE public.paypal_webhook_events
    SET processing_status='failed',payment_id=v_payment.id,error_message='Related order not found.'
    WHERE paypal_event_id=trim(p_event_id);
    RETURN jsonb_build_object('ok',false,'retry',true,'error','Related order not found.');
  END IF;

  IF p_event_type='PAYMENT.CAPTURE.REFUNDED' THEN
    IF p_amount IS NULL OR p_amount<=0 OR p_amount<>round(p_amount,2)
       OR upper(trim(coalesce(p_currency,'')))<>upper(trim(v_payment.currency)) THEN
      UPDATE public.paypal_webhook_events
      SET processing_status='failed',order_id=v_order.id,payment_id=v_payment.id,
          error_message='Refund amount or currency failed validation.'
      WHERE paypal_event_id=trim(p_event_id);
      RETURN jsonb_build_object('ok',false,'retry',false,'error','Refund amount or currency mismatch.');
    END IF;

    SELECT coalesce(sum(r.amount),0)::numeric(12,2) INTO v_refunded
    FROM public.order_refunds r WHERE r.payment_id=v_payment.id;

    IF p_amount > v_payment.amount-v_refunded THEN
      UPDATE public.paypal_webhook_events
      SET processing_status='failed',order_id=v_order.id,payment_id=v_payment.id,
          error_message='Refund exceeds remaining captured payment balance.'
      WHERE paypal_event_id=trim(p_event_id);
      RETURN jsonb_build_object('ok',false,'retry',false,'error','Refund exceeds remaining payment balance.');
    END IF;

    INSERT INTO public.order_refunds(
      order_id,payment_id,source_type,source_id,amount,currency,reference,
      refund_method,transaction_number,recorded_by
    ) VALUES (
      v_order.id,v_payment.id,'paypal_webhook',v_event.id,p_amount,
      upper(trim(p_currency)),trim(p_resource_id),'paypal',trim(p_resource_id),null
    );

    v_refunded := v_refunded+p_amount;
    v_new_status := CASE WHEN v_refunded>=v_payment.amount
      THEN 'refunded'::public.payment_status
      ELSE 'partially_refunded'::public.payment_status END;

    UPDATE public.payments SET status=v_new_status,updated_at=v_now
    WHERE id=v_payment.id;

    SELECT coalesce(sum(p.amount),0)::numeric(12,2) INTO v_paid
    FROM public.payments p
    WHERE p.order_id=v_order.id AND p.status IN ('paid','partially_refunded','refunded');

    SELECT coalesce(sum(r.amount),0)::numeric(12,2) INTO v_refunded
    FROM public.order_refunds r WHERE r.order_id=v_order.id;

    v_order_status := CASE WHEN v_paid>0 AND v_refunded>=v_paid
      THEN 'refunded'::public.order_status
      ELSE 'partially_refunded'::public.order_status END;

    IF v_order.status IS DISTINCT FROM v_order_status THEN
      UPDATE public.orders SET status=v_order_status,
        internal_note=pg_catalog.left(pg_catalog.concat_ws(' | ',nullif(internal_note,''),
          'PayPal refund received: '||p_amount::text||' '||upper(trim(p_currency))||'. Inventory was not automatically restocked.'),2000)
      WHERE id=v_order.id;

      INSERT INTO public.order_status_history(order_id,old_status,new_status,note,changed_by)
      VALUES (v_order.id,v_order.status,v_order_status,
        'PayPal refund verified by signed webhook. Inventory was not automatically restocked.',null);
    ELSE
      UPDATE public.orders SET internal_note=pg_catalog.left(pg_catalog.concat_ws(' | ',nullif(internal_note,''),
        'Additional PayPal refund received: '||p_amount::text||' '||upper(trim(p_currency))||'. Inventory was not automatically restocked.'),2000)
      WHERE id=v_order.id;
    END IF;

    INSERT INTO public.activity_logs(actor_user_id,action,entity_type,entity_id,old_values,new_values)
    VALUES (null,'order.paypal_refund_received','order',v_order.id,
      jsonb_build_object('payment_status',v_payment.status),
      jsonb_build_object('payment_status',v_new_status,'refund_id',p_resource_id,
        'amount',p_amount,'currency',upper(trim(p_currency))));

  ELSIF p_event_type='PAYMENT.CAPTURE.REVERSED' THEN
    UPDATE public.payments SET payment_review_required=true,updated_at=v_now
    WHERE id=v_payment.id;

    UPDATE public.orders SET internal_note=pg_catalog.left(pg_catalog.concat_ws(' | ',nullif(internal_note,''),
      'PayPal capture reversed. Payment review is required; fulfilment must remain on hold.'),2000)
    WHERE id=v_order.id;

    INSERT INTO public.activity_logs(actor_user_id,action,entity_type,entity_id,new_values)
    VALUES (null,'order.paypal_capture_reversed','order',v_order.id,
      jsonb_build_object('capture_id',p_capture_id,'payment_review_required',true));

  ELSE
    INSERT INTO public.paypal_disputes(
      dispute_id,order_id,payment_id,capture_id,status,reason,amount,currency,resource
    ) VALUES (
      trim(p_resource_id),v_order.id,v_payment.id,trim(p_capture_id),
      coalesce(nullif(trim(p_dispute_status),''),'UNKNOWN'),
      nullif(trim(coalesce(p_reason,'')),''),
      CASE WHEN p_amount>0 THEN round(p_amount,2) ELSE NULL END,
      nullif(upper(trim(coalesce(p_currency,''))),''),
      coalesce(p_payload,'{}'::jsonb)
    )
    ON CONFLICT (dispute_id) DO UPDATE SET
      status=excluded.status,reason=coalesce(excluded.reason,public.paypal_disputes.reason),
      amount=coalesce(excluded.amount,public.paypal_disputes.amount),
      currency=coalesce(excluded.currency,public.paypal_disputes.currency),
      resource=excluded.resource,updated_at=v_now;

    -- A dispute remains a manual payment-risk hold, even if a later event says WON.
    -- Clearing a hold requires an explicit staff reconciliation, not a webhook.
    UPDATE public.payments SET payment_review_required=true,updated_at=v_now
    WHERE id=v_payment.id;

    UPDATE public.orders SET internal_note=pg_catalog.left(pg_catalog.concat_ws(' | ',nullif(internal_note,''),
      'PayPal buyer dispute event received ('||coalesce(nullif(trim(p_dispute_status),''),'status unknown')||
      '). Payment review is required before further fulfilment.'),2000)
    WHERE id=v_order.id;

    INSERT INTO public.activity_logs(actor_user_id,action,entity_type,entity_id,new_values)
    VALUES (null,'order.paypal_dispute_updated','order',v_order.id,
      jsonb_build_object('dispute_id',p_resource_id,'status',p_dispute_status,
        'reason',p_reason,'payment_review_required',true));
  END IF;

  UPDATE public.paypal_webhook_events
  SET processing_status='processed',order_id=v_order.id,payment_id=v_payment.id,
      error_message=NULL,processed_at=v_now
  WHERE paypal_event_id=trim(p_event_id);

  RETURN jsonb_build_object('ok',true,'duplicate',false,'order_id',v_order.id,
    'payment_id',v_payment.id,'event_type',p_event_type);
END;
$function$;

REVOKE ALL ON FUNCTION public.process_paypal_webhook_event(text,text,text,text,numeric,text,text,text,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_paypal_webhook_event(text,text,text,text,numeric,text,text,text,jsonb)
  TO service_role;
