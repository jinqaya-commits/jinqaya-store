-- Prevent the same bank / transaction reference being recorded twice for one PO.
-- The RPC locks the purchase order while checking the outstanding balance; this
-- unique index provides a final database-level guard against duplicate references.
create unique index if not exists purchase_order_payment_reference_unique
  on public.purchase_order_payments (purchase_order_id, lower(btrim(reference_number)))
  where reference_number is not null and btrim(reference_number) <> '';
