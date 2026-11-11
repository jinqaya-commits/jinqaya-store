import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InventoryAdjustForm } from "./inventory-adjust-form";
import { InventoryMovementForm } from "./inventory-movement-form";

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");

  const { data: allowed, error: permissionError } = await supabase.rpc("can_manage_catalog");
  if (permissionError || allowed !== true) redirect("/");

  const [
    { data: warehouse },
    { data: variants, error },
    { data: movements, error: movementsError },
    { data: incomingItems, error: incomingError },
  ] = await Promise.all([
    supabase.from("warehouses").select("id,code,name,country,city").eq("is_default", true).eq("is_active", true).maybeSingle(),
    supabase.from("product_variants").select("id,sku,variant_name,color,size,price,currency,is_active,products(name,status),inventory(id,warehouse_id,on_hand,reserved,damaged,reorder_point)").order("sku"),
    supabase.from("inventory_movements").select("id,variant_id,movement_type,quantity_change,reserved_change,notes,created_at,product_variants(sku)").order("created_at", { ascending: false }).limit(40),
    supabase.from("purchase_order_items").select("variant_id,quantity_ordered,quantity_received,purchase_orders!inner(status,warehouse_id,expected_date)").in("purchase_orders.status", ["submitted", "partially_received"]),
  ]);

  const incomingByVariant = new Map<string, number>();
  const nextArrivalByVariant = new Map<string, string>();
  (incomingItems || []).forEach((item) => {
    const purchaseOrder = Array.isArray(item.purchase_orders) ? item.purchase_orders[0] : item.purchase_orders;
    if (!warehouse || purchaseOrder?.warehouse_id !== warehouse.id) return;
    const remaining = Math.max(0, Number(item.quantity_ordered) - Number(item.quantity_received));
    if (remaining <= 0) return;
    incomingByVariant.set(item.variant_id, (incomingByVariant.get(item.variant_id) || 0) + remaining);
    const expectedDate = purchaseOrder.expected_date as string | null;
    if (expectedDate) {
      const current = nextArrivalByVariant.get(item.variant_id);
      if (!current || expectedDate < current) nextArrivalByVariant.set(item.variant_id, expectedDate);
    }
  });

  const rows = (variants || []).map((variant) => {
    const inventoryRows = Array.isArray(variant.inventory) ? variant.inventory : [];
    const stock = inventoryRows.find((item) => item.warehouse_id === warehouse?.id) || null;
    const onHand = Number(stock?.on_hand || 0);
    const reserved = Number(stock?.reserved || 0);
    const damaged = Number(stock?.damaged || 0);
    const available = onHand - reserved - damaged;
    const reorderPoint = Number(stock?.reorder_point || 0);
    const incoming = incomingByVariant.get(variant.id) || 0;
    return {
      variant,
      stock,
      onHand,
      reserved,
      damaged,
      available,
      reorderPoint,
      incoming,
      replenishmentGap: Math.max(0, reorderPoint - available - incoming),
      nextArrival: nextArrivalByVariant.get(variant.id) || null,
    };
  });

  const totalOnHand = rows.reduce((sum, row) => sum + row.onHand, 0);
  const totalReserved = rows.reduce((sum, row) => sum + row.reserved, 0);
  const totalIncoming = rows.reduce((sum, row) => sum + row.incoming, 0);
  const isActiveSellableVariant = (row: (typeof rows)[number]) => {
    const product = row.variant.products as { status?: string } | null;
    return row.variant.is_active && product?.status === "active";
  };
  // Missing inventory records represent zero available stock, not an exemption
  // from the low-stock count. Only active, published variants affect the KPI.
  const lowStockCount = rows.filter(
    (row) => isActiveSellableVariant(row) && row.available <= row.reorderPoint,
  ).length;
  const replenishmentCount = rows.filter(
    (row) => isActiveSellableVariant(row) && row.stock && row.replenishmentGap > 0,
  ).length;

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/" className="admin-brand">JINQAYA<span>ADMIN</span></Link>
        <nav>
          <Link href="/admin/products">Products</Link>
          <Link href="/admin/orders">Orders</Link>
          <Link href="/admin/purchase-orders">Purchase orders</Link>
          <Link className="active" href="/admin/inventory">Inventory</Link>
          <Link href="/shop">View storefront ↗</Link>
        </nav>
        <p className="admin-sidebar-note">COMMERCE MANAGEMENT</p>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="admin-kicker">JINQAYA / STOCK CONTROL</p>
            <h1>Inventory</h1>
            <p className="admin-help">{warehouse ? warehouse.name + " · " + warehouse.code : "No default warehouse configured"}</p>
          </div>
          <div className="admin-topbar-actions"><Link className="admin-back-link" href="/admin/inventory/replenishment-export">EXPORT REPLENISHMENT CSV ↓</Link><Link className="admin-back-link" href="/admin/orders">← ORDERS</Link></div>
        </header>

        <div className="admin-summary inventory-summary">
          <div><span>UNITS ON HAND</span><strong>{totalOnHand}</strong></div>
          <div><span>UNITS RESERVED</span><strong>{totalReserved}</strong></div>
          <div><span>INCOMING UNITS</span><strong>{totalIncoming}</strong></div>
          <div><span>LOW / OUT OF STOCK</span><strong>{lowStockCount}</strong></div>
        </div>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div><p className="admin-kicker">VARIANT STOCK LEVELS</p><h2>Stock & replenishment</h2></div>
            <span>{replenishmentCount} NEED REPLENISHMENT</span>
          </div>
          {!warehouse && <p className="admin-error">No active default warehouse is configured. Contact an administrator.</p>}
          {incomingError && <p className="admin-error">Unable to load incoming purchase quantities: {incomingError.message}</p>}
          {error ? <p className="admin-error">{error.message}</p> : !rows.length ? (
            <div className="admin-empty"><h3>No product variants yet.</h3><p>Add products and variants before setting inventory.</p></div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table inventory-table">
                <thead><tr>
                  <th>PRODUCT / SKU</th><th>ON HAND</th><th>RESERVED</th><th>DAMAGED</th><th>AVAILABLE</th>
                  <th>INCOMING</th><th>REPLENISHMENT GAP</th><th>STOCKTAKE / REORDER</th><th>STOCK MOVEMENT</th>
                </tr></thead>
                <tbody>
                  {rows.map(({ variant, onHand, reserved, damaged, available, reorderPoint, incoming, replenishmentGap, nextArrival }) => (
                    <tr key={variant.id}>
                      <td>
                        <strong>{(variant.products as { name?: string } | null)?.name || "Product"}</strong>
                        <small>{variant.sku} · {variant.variant_name || [variant.color, variant.size].filter(Boolean).join(" / ") || "Default variant"}</small>
                        <small>{(variant.products as { status?: string } | null)?.status || ""}</small>
                      </td>
                      <td>{onHand}</td><td>{reserved}</td><td>{damaged}</td>
                      <td><strong className={available <= reorderPoint ? "inventory-low" : ""}>{available}</strong></td>
                      <td>{incoming}{nextArrival ? <small>ETA {nextArrival}</small> : null}</td>
                      <td>{reorderPoint > 0 ? replenishmentGap : <span className="admin-help">Set reorder point</span>}</td>
                      <td>{warehouse ? <InventoryAdjustForm variantId={variant.id} sku={variant.sku} onHand={onHand} reorderPoint={reorderPoint} /> : "—"}</td>
                      <td>{warehouse ? <InventoryMovementForm variantId={variant.id} sku={variant.sku} /> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="admin-help" style={{ marginTop: 16 }}>
            Available stock = on hand − reserved − damaged. Incoming units are unreceived quantities on submitted or partially received purchase orders for this warehouse.
            Replenishment gap is the minimum quantity needed to reach the SKU reorder point after current incoming stock. It is a planning figure only; no purchase order is created automatically.
            Set each SKU&apos;s reorder point using your own sales pace and supplier lead time.
          </p>
        </section>

        <section className="admin-panel" style={{ marginTop: 22 }}>
          <div className="admin-panel-heading">
            <div><p className="admin-kicker">AUDIT TRAIL</p><h2>Recent stock movements</h2></div>
            <span>LAST 40</span>
          </div>
          {movementsError ? <p className="admin-error">{movementsError.message}</p> : !movements?.length ? (
            <p className="admin-help">No inventory movements recorded yet.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>DATE</th><th>SKU</th><th>TYPE</th><th>ON HAND CHANGE</th><th>RESERVED CHANGE</th><th>NOTE</th></tr></thead>
                <tbody>{movements.map((movement) => (
                  <tr key={movement.id}>
                    <td>{new Date(movement.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td>{(movement.product_variants as { sku?: string } | null)?.sku || "—"}</td>
                    <td>{movement.movement_type.replaceAll("_", " ")}</td>
                    <td>{movement.quantity_change > 0 ? "+" : ""}{movement.quantity_change}</td>
                    <td>{movement.reserved_change > 0 ? "+" : ""}{movement.reserved_change}</td>
                    <td>{movement.notes || "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
