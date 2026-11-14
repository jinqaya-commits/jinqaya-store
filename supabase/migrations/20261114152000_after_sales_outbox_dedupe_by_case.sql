-- Distinguish after-sales notifications by case number while preserving order-event deduplication.
DROP INDEX IF EXISTS public.order_email_outbox_order_event_recipient_uidx;
CREATE UNIQUE INDEX order_email_outbox_order_event_recipient_case_uidx
ON public.order_email_outbox (
  order_id,
  event_type,
  recipient_type,
  (COALESCE(payload->>'caseNumber', ''))
);
