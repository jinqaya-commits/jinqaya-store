"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireOrderManager() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");
  const { data: allowed, error } = await supabase.rpc("can_manage_catalog");
  if (error || allowed !== true) throw new Error("You do not have permission to manage orders.");
  return supabase;
}

export async function processOrderAction(
  orderId: string,
  action: string,
  formData: FormData
) {
  const supabase = await requireOrderManager();
  const amountRaw = String(formData.get("shipping_amount") ?? "").trim();
  const amount = amountRaw === "" ? null : Number(amountRaw);
  if (amountRaw !== "" && (!Number.isFinite(amount) || Number(amount) < 0)) {
    return { error: "Enter a valid shipping amount." };
  }
  const { data, error } = await supabase.rpc("admin_process_order", {
    p_order_id: orderId,
    p_action: action,
    p_shipping_amount: amount,
    p_shipping_method: String(formData.get("shipping_method") ?? ""),
    p_carrier_name: String(formData.get("carrier_name") ?? ""),
    p_tracking_number: String(formData.get("tracking_number") ?? ""),
    p_tracking_url: String(formData.get("tracking_url") ?? ""),
    p_note: String(formData.get("note") ?? ""),
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/inventory");
  return { success: true, data };
}

export async function adjustInventoryAction(formData: FormData) {
  const supabase = await requireOrderManager();
  const variantId = String(formData.get("variant_id") ?? "");
  const onHand = Number(formData.get("on_hand"));
  const reorderPoint = Number(formData.get("reorder_point") ?? 0);
  const notes = String(formData.get("notes") ?? "");
  if (!variantId || !Number.isInteger(onHand) || onHand < 0 || !Number.isInteger(reorderPoint) || reorderPoint < 0) {
    return { error: "Enter valid whole-number stock quantities." };
  }
  const { error } = await supabase.rpc("admin_adjust_inventory", {
    p_variant_id: variantId,
    p_on_hand: onHand,
    p_reorder_point: reorderPoint,
    p_notes: notes,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/orders");
  return { success: true };
}
