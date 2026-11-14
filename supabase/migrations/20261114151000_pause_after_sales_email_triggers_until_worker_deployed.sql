-- Keep after-sales notification triggers paused until the matching worker code is deployed.
-- This prevents the currently deployed worker from interpreting unknown event types as order_received.
DROP TRIGGER IF EXISTS after_sales_customer_email_on_insert ON public.after_sales_cases;
DROP TRIGGER IF EXISTS after_sales_customer_email_on_update ON public.after_sales_cases;
