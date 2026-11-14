-- Prevent the same bank / transaction reference being recorded twice for one PO.
-- The transactional RPC checks outstanding balance while locking the purchase order;
-- this unique index is a final database-level duplicate-reference guard.
create unique index if not exists purchase_order_payment_reference_unique
  on public.purchase_order_payments (purchase_order_id, lower(btrim(reference_number)))
  where reference_number is not null and btrim(reference_number) <> '';
