-- Queue customer notifications for after-sales lifecycle events.
-- This migration prepares the event contract and trigger function only.
-- Triggers are intentionally NOT created here: the matching application code must
-- be deployed and explicitly activated in a separate release step.
ALTER TABLE public.order_email_outbox
  DROP CONSTRAINT IF EXISTS order_email_outbox_event_type_check;

ALTER TABLE public.order_email_outbox
  ADD CONSTRAINT order_email_outbox_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'order_received','quote_confirmed','payment_received','shipped','delivered',
    'cancelled','reservation_expired','after_sales_submitted','after_sales_under_review',
    'after_sales_approved','after_sales_rejected','after_sales_resolved','after_sales_refund_recorded'
  ]::text[]));

CREATE OR REPLACE FUNCTION public.enqueue_after_sales_customer_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_event text;
  v_payload jsonb;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = NEW.order_id;

  IF NOT FOUND OR v_order.customer_email IS NULL
     OR length(pg_catalog.btrim(v_order.customer_email)) < 5
     OR length(pg_catalog.btrim(v_order.customer_email)) > 254 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_event := 'after_sales_submitted';
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    v_event := CASE NEW.status
      WHEN 'under_review' THEN 'after_sales_under_review'
      WHEN 'approved' THEN 'after_sales_approved'
      WHEN 'rejected' THEN 'after_sales_rejected'
      WHEN 'resolved' THEN 'after_sales_resolved'
      ELSE NULL
    END;
  END IF;

  IF v_event IS NOT NULL THEN
    v_payload := pg_catalog.jsonb_build_object(
      'eventType', v_event,
      'orderNumber', v_order.order_number,
      'customerName', '',
      'customerEmail', v_order.customer_email,
      'subtotal', v_order.subtotal,
      'currency', pg_catalog.btrim(v_order.currency),
      'shippingAmount', v_order.shipping_amount,
      'shippingMethod', v_order.shipping_method_name,
      'caseNumber', NEW.case_number,
      'caseStatus', NEW.status,
      'resolution', NEW.resolution
    );

    INSERT INTO public.order_email_outbox
      (order_id, recipient_type, recipient_email, payload, event_type)
    VALUES
      (NEW.order_id, 'customer', v_order.customer_email, v_payload, v_event);
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.refund_status IS DISTINCT FROM NEW.refund_status
     AND NEW.refund_status = 'confirmed' THEN
    v_payload := pg_catalog.jsonb_build_object(
      'eventType', 'after_sales_refund_recorded',
      'orderNumber', v_order.order_number,
      'customerName', '',
      'customerEmail', v_order.customer_email,
      'subtotal', v_order.subtotal,
      'currency', pg_catalog.btrim(v_order.currency),
      'shippingAmount', v_order.shipping_amount,
      'shippingMethod', v_order.shipping_method_name,
      'caseNumber', NEW.case_number,
      'caseStatus', NEW.status,
      'resolution', NEW.resolution,
      'refundAmount', NEW.refund_amount,
      'refundReference', NEW.refund_reference
    );

    INSERT INTO public.order_email_outbox
      (order_id, recipient_type, recipient_email, payload, event_type)
    VALUES
      (NEW.order_id, 'customer', v_order.customer_email, v_payload, 'after_sales_refund_recorded');
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_after_sales_customer_email() FROM PUBLIC, anon, authenticated;
