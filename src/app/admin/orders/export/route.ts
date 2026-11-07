import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

const validStatuses = new Set(["on_hold", "pending_payment", "paid", "processing", "partially_shipped", "shipped", "delivered", "cancelled", "partially_refunded", "refunded"]);
function safeSearch(value: string) {
  return value.replace(/[^\w@+.\-\s]/g, "").trim().slice(0, 100);
}
function dateBoundary(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(value + "T00:00:00.000Z");
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed.toISOString();
}
function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: allowed, error: permissionError } = await supabase.rpc("can_manage_catalog");
  if (permissionError || allowed !== true) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const params = request.nextUrl.searchParams;
  const status = params.get("status") || "all";
  if (status !== "all" && !validStatuses.has(status)) return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
  const search = safeSearch(params.get("q") || "");
  const from = dateBoundary(params.get("from"));
  const to = dateBoundary(params.get("to"));
  if ((params.has("from") && !from) || (params.has("to") && !to)) return NextResponse.json({ error: "Invalid date filter" }, { status: 400 });
  if (from && to && from > to) return NextResponse.json({ error: "Start date must be before end date" }, { status: 400 });

  let query = supabase.from("orders")
    .select("id,order_number,status,currency,customer_email,customer_phone,subtotal,shipping_amount,total_amount,shipping_method_name,shipping_address_snapshot,created_at,order_items(quantity,product_name,sku)")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (status !== "all") query = query.eq("status", status as Database["public"]["Enums"]["order_status"]);
  if (search) query = query.or("order_number.ilike.%" + search + "%,customer_email.ilike.%" + search + "%,customer_phone.ilike.%" + search + "%");
  if (from) query = query.gte("created_at", from);
  if (to) {
    const end = new Date(to);
    end.setUTCDate(end.getUTCDate() + 1);
    query = query.lt("created_at", end.toISOString());
  }
  const { data: orders, error } = await query;
  if (error) return NextResponse.json({ error: "Unable to export orders" }, { status: 500 });

  const headers = ["Order number", "Status", "Customer email", "Phone", "Created at", "Currency", "Items", "Item subtotal", "Shipping", "Shipping method", "Order total", "City", "Country"];
  const rows = (orders || []).map(order => {
    const address = order.shipping_address_snapshot as { city?: string; country?: string; country_code?: string } | null;
    const items = Array.isArray(order.order_items) ? order.order_items.map(item => item.product_name + " x " + item.quantity).join("; ") : "";
    return [
      order.order_number, order.status, order.customer_email, order.customer_phone,
      new Date(order.created_at).toISOString(), order.currency, items,
      order.subtotal, order.shipping_amount, order.shipping_method_name, order.total_amount,
      address?.city, address?.country || address?.country_code,
    ];
  });
  const csv = [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
  return new NextResponse("\uFEFF" + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="jinqaya-orders.csv"',
      "Cache-Control": "private, no-store",
      "X-Export-Limit": "1000",
    },
  });
}
