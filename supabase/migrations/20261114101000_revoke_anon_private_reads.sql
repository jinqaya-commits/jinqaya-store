-- These records are operational or customer-private and have no anonymous SELECT policy.
-- Remove the unused anon SELECT grant as defense in depth.
revoke select on table
  public.customers,
  public.goods_receipt_items,
  public.goods_receipts,
  public.order_status_history,
  public.profiles,
  public.purchase_order_items,
  public.purchase_order_payments,
  public.purchase_orders,
  public.suppliers
from anon;
