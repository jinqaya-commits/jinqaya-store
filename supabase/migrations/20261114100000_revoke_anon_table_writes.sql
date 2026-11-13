-- Public storefront requests use server-side, validated handlers and service-role RPCs.
-- Anonymous browser clients only need SELECT access to explicitly public catalog rows.
-- Remove unused anonymous write privileges so RLS is not the only barrier.
revoke insert, update, delete, truncate, references, trigger on table
  public.categories,
  public.customers,
  public.goods_receipt_items,
  public.goods_receipts,
  public.homepage_media,
  public.order_status_history,
  public.product_categories,
  public.product_images,
  public.product_variants,
  public.products,
  public.profiles,
  public.purchase_order_items,
  public.purchase_order_payments,
  public.purchase_orders,
  public.suppliers
from anon;
