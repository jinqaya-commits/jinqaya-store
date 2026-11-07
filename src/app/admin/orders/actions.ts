"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendOrderStatusEmail, type OrderEmailData } from "@/lib/order-email";

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

  // Notify the customer only after the database confirms the corresponding state transition.
  const result = data && typeof data === "object" ? data as { status?: string } : {};
  const notificationEvents: Record<string, { event: "quote_confirmed" | "payment_received" | "shipped" | "delivered" | "cancelled"; expectedStatus: string }> = {
    confirm_quote: { event: "quote_confirmed", expectedStatus: "pending_payment" },
    confirm_payment: { event: "payment_received", expectedStatus: "paid" },
    ship: { event: "shipped", expectedStatus: "shipped" },
    delivered: { event: "delivered", expectedStatus: "delivered" },
    cancel: { event: "cancelled", expectedStatus: "cancelled" },
  };
  const notification = notificationEvents[action];

  if (notification && result.status === notification.expectedStatus) {
    try {
      const { data: order } = await supabase
        .from("orders")
        .select("order_number,customer_id,customer_email,currency,subtotal,shipping_amount,shipping_method_name")
        .eq("id", orderId)
        .maybeSingle();

      if (order?.customer_email) {
        const { data: customer } = await supabase
          .from("customers")
          .select("first_name,last_name")
          .eq("id", order.customer_id)
          .maybeSingle();

        const emailData: OrderEmailData = {
          orderNumber: order.order_number,
          customerName: [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "there",
          customerEmail: order.customer_email,
          currency: order.currency.trim() || "USD",
          subtotal: order.subtotal,
          shippingAmount: order.shipping_amount,
          shippingMethod: order.shipping_method_name,
        };

        if (action === "ship") {
          const { data: shipment } = await supabase
            .from("shipments")
            .select("carrier_name,tracking_number,tracking_url")
            .eq("order_id", orderId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          emailData.shippingMethod = shipment?.carrier_name || emailData.shippingMethod;
          emailData.trackingNumber = shipment?.tracking_number || null;
          emailData.trackingUrl = shipment?.tracking_url || null;
        }

        const sent = await sendOrderStatusEmail(emailData, notification.event);
        if (!sent) console.error("Customer order status email was not sent:", notification.event, order.order_number);
      }
    } catch (emailError) {
      // Email failure must never roll back or misreport a successfully saved order transition.
      console.error("Customer order status notification failed:", emailError);
    }
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/inventory");
  return { success: true, data };
}

export async function recordInventoryMovementAction(formData: FormData) {
  const supabase = await requireOrderManager();
  const variantId = String(formData.get("variant_id") ?? "");
  const movementType = String(formData.get("movement_type") ?? "");
  const quantity = Number(formData.get("quantity"));
  const notes = String(formData.get("notes") ?? "").trim();
  if (!variantId || !["purchase_receipt", "supplier_return", "customer_return", "damage"].includes(movementType) ||
      !Number.isInteger(quantity) || quantity < 1 || quantity > 1000000 || notes.length < 3 || notes.length > 500) {
    return { error: "Enter a valid quantity and a reason of at least 3 characters." };
  }
  const { error } = await supabase.rpc("admin_record_inventory_movement", {
    p_variant_id: variantId,
    p_movement_type: movementType,
    p_quantity: quantity,
    p_notes: notes,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
  return { success: true };
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

export async function createPurchaseOrderAction(formData: FormData) {
  const supabase = await requireOrderManager();
  const supplierName = String(formData.get("supplier_name") ?? "").trim();
  const supplierEmail = String(formData.get("supplier_email") ?? "").trim();
  const supplierPhone = String(formData.get("supplier_phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  let items: Array<{variant_id:string;quantity:number;unit_cost:string;currency:string}>;
  try { items = JSON.parse(String(formData.get("items") ?? "[]")); } catch { return { error: "Invalid purchase order items." }; }
  if (!supplierName || supplierName.length > 160 || supplierEmail.length > 254 || supplierPhone.length > 60 || notes.length > 3000 ||
      !Array.isArray(items) || items.length < 1 || items.length > 100 ||
      items.some((item) => !item.variant_id || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000000 ||
        (item.unit_cost !== "" && (!Number.isFinite(Number(item.unit_cost)) || Number(item.unit_cost) < 0)) ||
        !/^[A-Z]{3}$/.test(item.currency))) {
    return { error: "Check the supplier details and each SKU, quantity, cost and currency." };
  }
  const { data, error } = await supabase.rpc("admin_create_purchase_order", {
    p_supplier_name: supplierName,
    p_supplier_email: supplierEmail || null,
    p_supplier_phone: supplierPhone || null,
    p_notes: notes || null,
    p_items: items,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/purchase-orders");
  revalidatePath("/admin/inventory");
  return { success: true, id: data as string };
}

export async function issuePurchaseOrderAction(formData: FormData) {
  const supabase = await requireOrderManager();
  const id = String(formData.get("purchase_order_id") ?? "");
  const { error } = await supabase.rpc("admin_issue_purchase_order", { p_purchase_order_id: id });
  if (error) return { error: error.message };
  revalidatePath("/admin/purchase-orders");
  return { success: true };
}

export async function receivePurchaseOrderItemAction(formData: FormData) {
  const supabase = await requireOrderManager();
  const id = String(formData.get("purchase_order_item_id") ?? "");
  const quantity = Number(formData.get("quantity"));
  const notes = String(formData.get("notes") ?? "").trim();
  if (!id || !Number.isInteger(quantity) || quantity < 1 || notes.length > 500) return { error: "Enter a valid received quantity." };
  const { error } = await supabase.rpc("admin_receive_purchase_order_item", {
    p_purchase_order_item_id: id, p_quantity: quantity, p_notes: notes || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/purchase-orders");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
  return { success: true };
}
