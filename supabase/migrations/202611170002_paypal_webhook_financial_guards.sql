CREATE OR REPLACE FUNCTION public.guard_paypal_refund_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_paid numeric(12,2);
  v_refunded numeric(12,2);
BEGIN
  IF NEW.payment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.id=NEW.payment_id AND p.order_id=NEW.order_id
  ) THEN
    RAISE EXCEPTION 'Refund payment does not belong to the selected order.';
  END IF;

  SELECT coalesce(sum(p.amount),0)::numeric(12,2) INTO v_paid
  FROM public.payments p
  WHERE p.order_id=NEW.order_id
    AND p.status IN ('paid','partially_refunded','refunded');

  SELECT coalesce(sum(r.amount),0)::numeric(12,2) INTO v_refunded
  FROM public.order_refunds r
  WHERE r.order_id=NEW.order_id
    AND r.id IS DISTINCT FROM NEW.id;

  IF v_paid<=0 OR NEW.amount > v_paid-v_refunded THEN
    RAISE EXCEPTION 'Refund exceeds the remaining successfully captured payment balance.';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_paypal_refund_balance ON public.order_refunds;
CREATE TRIGGER guard_paypal_refund_balance
BEFORE INSERT OR UPDATE OF order_id,payment_id,amount
ON public.order_refunds
FOR EACH ROW EXECUTE FUNCTION public.guard_paypal_refund_balance();

CREATE OR REPLACE FUNCTION public.guard_paypal_payment_review_fulfilment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status::text IN ('processing','shipped','partially_shipped')
     AND NEW.status IS DISTINCT FROM OLD.status
     AND EXISTS (
       SELECT 1 FROM public.payments p
       WHERE p.order_id=NEW.id AND p.payment_review_required IS TRUE
     ) THEN
    RAISE EXCEPTION 'PayPal payment review is required before this order can continue fulfilment.';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_paypal_payment_review_fulfilment ON public.orders;
CREATE TRIGGER guard_paypal_payment_review_fulfilment
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_paypal_payment_review_fulfilment();

REVOKE ALL ON FUNCTION public.guard_paypal_refund_balance() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_paypal_payment_review_fulfilment() FROM PUBLIC, anon, authenticated;
