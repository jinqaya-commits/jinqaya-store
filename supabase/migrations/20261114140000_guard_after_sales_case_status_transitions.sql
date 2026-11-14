-- Enforce a one-way after-sales case lifecycle and audit status changes atomically.
CREATE OR REPLACE FUNCTION public.guard_after_sales_case_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'submitted' AND NEW.status IN ('under_review','approved','rejected'))
      OR (OLD.status = 'under_review' AND NEW.status IN ('approved','rejected'))
      OR (OLD.status = 'approved' AND NEW.status = 'resolved')
    ) THEN
      RAISE EXCEPTION 'Invalid after-sales status transition: % -> %.', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.audit_after_sales_case_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.after_sales_case_events(
      case_id,event_type,description,old_values,new_values,created_by
    )
    VALUES (
      NEW.id,
      'status_changed',
      'After-sales case status changed.',
      jsonb_build_object('status',OLD.status),
      jsonb_build_object('status',NEW.status),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_after_sales_case_status_transition ON public.after_sales_cases;
CREATE TRIGGER enforce_after_sales_case_status_transition
BEFORE UPDATE OF status ON public.after_sales_cases
FOR EACH ROW
EXECUTE FUNCTION public.guard_after_sales_case_status_transition();

DROP TRIGGER IF EXISTS audit_after_sales_case_status_transition ON public.after_sales_cases;
CREATE TRIGGER audit_after_sales_case_status_transition
AFTER UPDATE OF status ON public.after_sales_cases
FOR EACH ROW
EXECUTE FUNCTION public.audit_after_sales_case_status_transition();

REVOKE ALL ON FUNCTION public.guard_after_sales_case_status_transition() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_after_sales_case_status_transition() FROM PUBLIC, anon, authenticated;
