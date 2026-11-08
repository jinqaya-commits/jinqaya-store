import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (typeof value === "string" && (/^[=+@-]/.test(text) || /^[\t\r]/.test(text))) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export async function GET() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: allowed, error: permissionError } = await supabase.rpc("can_manage_catalog");
  if (permissionError || allowed !== true) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [{ data: warehouse, error: warehouseError }, { data: variants, error: variantsError }, { data: incomingItems, error: incomingError }] = await Promise.all([
    supabase.from("warehouses").select("id,code,name").eq("is_default", true).eq("is_active", true).maybeSingle(),
    supabase.from("product_variants").select("id,sku,variant_name,color,size,is_active,products(name),inventory(warehouse_id,on_hand,reserved,damaged,reorder_point)").eq("is_active", true).order("sku"),
    supabase.from("purchase_order_items").select("variant_id,quantity_ordered,quantity_received,purchase_orders!inner(status,warehouse_id,expected_date)").in("purchase_orders.status", ["submitted", "partially_received"]),
  ]);
  if (warehouseError || variantsError || incomingError) {
    return NextResponse.json({ error: "Unable to prepare the replenishment export." }, { status: 500 });
  }
  if (!warehouse) return NextResponse.json({ error: "No active default warehouse is configured." }, { status: 409 });

  const incomingByVariant = new Map<string, number>();
  const etaByVariant = new Map<string, string>();
  (incomingItems || []).forEach((item) => {
    const po = Array.isArray(item.purchase_orders) ? item.purchase_orders[0] : item.purchase_orders;
    if (po?.warehouse_id !== warehouse.id) return;
    const remaining = Math.max(0, Number(item.quantity_ordered) - Number(item.quantity_received));
    if (!remaining) return;
    incomingByVariant.set(item.variant_id, (incomingByVariant.get(item.variant_id) || 0) + remaining);
    if (po.expected_date && (!etaByVariant.has(item.variant_id) || po.expected_date < etaByVariant.get(item.variant_id)!)) {
      etaByVariant.set(item.variant_id, po.expected_date);
    }
  });

  const output = (variants || []).flatMap((variant) => {
    const stocks = Array.isArray(variant.inventory) ? variant.inventory : [];
    const stock = stocks.find((row) => row.warehouse_id === warehouse.id);
    if (!stock) return [];
    const onHand = Number(stock.on_hand || 0);
    const reserved = Number(stock.reserved || 0);
    const damaged = Number(stock.damaged || 0);
    const available = onHand - reserved - damaged;
    const reorderPoint = Number(stock.reorder_point || 0);
    if (reorderPoint <= 0 || available > reorderPoint) return [];
    const incoming = incomingByVariant.get(variant.id) || 0;
    const gap = Math.max(0, reorderPoint - available - incoming);
    if (gap <= 0) return [];
    const product = Array.isArray(variant.products) ? variant.products[0] : variant.products;
    return [{
      product: product?.name || "",
      sku: variant.sku,
      variant: variant.variant_name || [variant.color, variant.size].filter(Boolean).join(" / "),
      onHand,
      reserved,
      damaged,
      available,
      reorderPoint,
      incoming,
      replenishmentGap: gap,
      expectedArrival: etaByVariant.get(variant.id) || "",
    }];
  });

  const headers = ["Product", "SKU", "Variant", "On hand", "Reserved", "Damaged", "Available", "Reorder point", "Incoming", "Suggested replenishment", "Earliest expected arrival"];
  const lines = [headers, ...output.map((row) => [row.product, row.sku, row.variant, row.onHand, row.reserved, row.damaged, row.available, row.reorderPoint, row.incoming, row.replenishmentGap, row.expectedArrival])]
    .map((row) => row.map(csvCell).join(","));
  const body = "\uFEFF" + lines.join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="jinqaya-replenishment-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
