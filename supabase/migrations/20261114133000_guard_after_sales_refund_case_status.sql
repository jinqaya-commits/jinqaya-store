-- Refunds may only be recorded against an approved or resolved after-sales case.
-- This records an already executed refund; it does not initiate a payment-provider refund.
CREATE OR REPLACE FUNCTION public.admin_confirm_after_sales_refund(
  p_case_id uuid,
  p_refund_amount numeric,
  p_refund_reference text DEFAULT NULL::text,
  p_refund_method text DEFAULT NULL::text,
  p_transaction_number text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_case public.after_sales_cases%rowtype;
  v_order public.orders%rowtype;
  v_order_id uuid;
  v_paid numeric(12,2);
  v_refunded numeric(12,2);
  v_remaining numeric(12,2);
BEGIN
  IF NOT public.can_manage_catalog() THEN
    RAISE EXCEPTION 'You do not have permission to confirm refunds.';
  END IF;
  IF p_refund_method IS NULL OR p_refund_method NOT IN ('bank_transfer','card','paypal','cash','other')
     OR length(trim(coalesce(p_transaction_number,''))) < 1
     OR length(p_transaction_number) > 200 THEN
    RAISE EXCEPTION 'Select the actual refund method and enter its transaction or receipt number.';
  END IF;
  IF p_case_id IS NULL OR p_refund_amount IS NULL OR p_refund_amount <= 0
     OR p_refund_amount <> round(p_refund_amount,2)
     OR length(coalesce(p_refund_reference,'')) > 200 THEN
    RAISE EXCEPTION 'Enter a positive refund amount with no more than two decimal places and a valid reference.';
  END IF;

  SELECT c.order_id INTO v_order_id
  FROM public.after_sales_cases c
  WHERE c.id = p_case_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'After-sales case not found.';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  SELECT * INTO v_case
  FROM public.after_sales_cases
  WHERE id = p_case_id AND order_id = v_order_id
  FOR UPDATE;

  IF v_case.status NOT IN ('approved','resolved') THEN
    RAISE EXCEPTION 'Refund can only be recorded for an approved or resolved after-sales case.';
  END IF;
  IF v_case.refund_status = 'confirmed' OR v_case.refund_confirmed_at IS NOT NULL THEN
    RAISE EXCEPTION 'This after-sales refund has already been recorded.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.order_id = v_order_id
      AND p.status IN ('paid','partially_refunded','refunded')
      AND p.currency <> v_order.currency
  ) THEN
    RAISE EXCEPTION 'Payment currency does not match the order currency. Refund confirmation is blocked for manual review.';
  END IF;

  SELECT coalesce(sum(p.amount),0)::numeric(12,2) INTO v_paid
  FROM public.payments p
  WHERE p.order_id = v_order_id
    AND p.status IN ('paid','partially_refunded','refunded')
    AND p.currency = v_order.currency;
  IF v_paid <= 0 THEN
    RAISE EXCEPTION 'No successfully recorded payment exists for this order. Refund cannot be confirmed.';
  END IF;

  SELECT coalesce(sum(r.amount),0)::numeric(12,2) INTO v_refunded
  FROM public.order_refunds r WHERE r.order_id = v_order_id;
  v_remaining := v_paid - v_refunded;
  IF p_refund_amount > v_remaining THEN
    RAISE EXCEPTION 'Refund exceeds remaining refundable balance. Paid: %, refunded: %, remaining: %, requested: % %.',
      v_paid, v_refunded, greatest(v_remaining,0), p_refund_amount, v_order.currency;
  END IF;

  INSERT INTO public.order_refunds(
    order_id,source_type,source_id,amount,currency,reference,refund_method,transaction_number,recorded_by
  )
  VALUES (
    v_order_id,'after_sales_case',p_case_id,p_refund_amount,v_order.currency,
    nullif(trim(coalesce(p_refund_reference,'')),''),p_refund_method,p_transaction_number,auth.uid()
  );

  UPDATE public.after_sales_cases
  SET refund_status='confirmed',refund_amount=p_refund_amount,
      refund_reference=nullif(trim(coalesce(p_refund_reference,'')),''),
      refund_confirmed_at=now(),updated_at=now()
  WHERE id=p_case_id;

  INSERT INTO public.after_sales_case_events(case_id,event_type,description,old_values,new_values,created_by)
  VALUES (
    p_case_id,'refund_status_changed',
    'Actual refund recorded and checked against the order refund balance.',
    jsonb_build_object('refund_status',v_case.refund_status,'refund_amount',v_case.refund_amount),
    jsonb_build_object('refund_status','confirmed','refund_amount',p_refund_amount,'currency',v_order.currency),
    auth.uid()
  );

  INSERT INTO public.activity_logs(actor_user_id,action,entity_type,entity_id,old_values,new_values)
  VALUES (
    auth.uid(),'order_refund.confirmed','order',v_order_id,
    jsonb_build_object('refunded_total',v_refunded,'remaining_before',v_remaining),
    jsonb_build_object('source_type','after_sales_case','source_id',p_case_id,
      'amount',p_refund_amount,'currency',v_order.currency,'refunded_total',v_refunded+p_refund_amount)
  );

  RETURN jsonb_build_object(
    'case_id',p_case_id,'order_id',v_order_id,'amount',p_refund_amount,
    'currency',v_order.currency,'paid_total',v_paid,'refunded_total',v_refunded+p_refund_amount,
    'remaining_refundable',v_paid-v_refunded-p_refund_amount,'order_status',v_order.status
  );
END;
$function$;
