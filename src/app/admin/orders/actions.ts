"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { RpcArgsWithNullableFields } from "@/lib/supabase/rpc-types";
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
    p_shipping_amount: amount ?? undefined,
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
  const supplierId = String(formData.get("supplier_id") ?? "").trim() || null;
  const supplierName = String(formData.get("supplier_name") ?? "").trim();
  const supplierEmail = String(formData.get("supplier_email") ?? "").trim();
  const supplierPhone = String(formData.get("supplier_phone") ?? "").trim();
  const saveSupplier = formData.get("save_supplier") === "on";
  const currency = String(formData.get("currency") ?? "USD").toUpperCase();
  const supplierReference = String(formData.get("supplier_reference") ?? "").trim();
  const expectedDate = String(formData.get("expected_date") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  let items: Array<{variant_id:string;quantity:number;unit_cost:string}>;
  try { items = JSON.parse(String(formData.get("items") ?? "[]")); } catch { return { error: "Invalid purchase order items." }; }
  if ((!supplierId && (!supplierName || supplierName.length > 160)) || supplierEmail.length > 254 || supplierPhone.length > 60 ||
      !/^[A-Z]{3}$/.test(currency) || supplierReference.length > 160 || notes.length > 3000 ||
      (expectedDate && !/^\\d{4}-\\d{2}-\\d{2}$/.test(expectedDate)) ||
      !Array.isArray(items) || items.length < 1 || items.length > 100 ||
      items.some((item) => !item || !item.variant_id || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000000 ||
        item.unit_cost === "" || !Number.isFinite(Number(item.unit_cost)) || Number(item.unit_cost) < 0)) {
    return { error: "Check supplier details, currency, expected date, and each SKU, quantity and unit cost." };
  }
  const purchaseOrderArgs = {
    p_supplier_id: supplierId,
    p_supplier_name: supplierName,
    p_supplier_email: supplierEmail || null,
    p_supplier_phone: supplierPhone || null,
    p_save_supplier: saveSupplier,
    p_currency: currency,
    p_supplier_reference: supplierReference || null,
    p_notes: notes || null,
    p_expected_date: expectedDate || null,
    p_items: items,
  } satisfies RpcArgsWithNullableFields<
    "admin_create_purchase_order_v3",
    "p_supplier_id" | "p_supplier_email" | "p_supplier_phone" | "p_supplier_reference" | "p_notes" | "p_expected_date"
  >;
  const { data, error } = await supabase.rpc(
    "admin_create_purchase_order_v3",
    purchaseOrderArgs as Database["public"]["Functions"]["admin_create_purchase_order_v3"]["Args"]
  );
  if (error) return { error: error.message };
  const result = data as { id?: string };
  revalidatePath("/admin/purchase-orders"); revalidatePath("/admin/inventory"); revalidatePath("/admin/suppliers");
  return { success: true, id: result?.id };
}

export async function issuePurchaseOrderAction(formData: FormData) {
  const supabase = await requireOrderManager();
  const id = String(formData.get("purchase_order_id") ?? "");
  if (!id) return { error: "Purchase order is required." };
  const { error } = await supabase.rpc("admin_submit_purchase_order_v2", { p_purchase_order_id: id });
  if (error) return { error: error.message };
  revalidatePath("/admin/purchase-orders");
  revalidatePath("/admin/purchase-orders/" + id);
  return { success: true };
}

export async function receivePurchaseOrderItemAction(formData: FormData) {
  const supabase = await requireOrderManager();
  const id = String(formData.get("purchase_order_item_id") ?? "");
  const quantity = Number(formData.get("quantity"));
  const damaged = Number(formData.get("damaged") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim();
  const deliveryReference = String(formData.get("supplier_delivery_reference") ?? "").trim();
  if (!id || !Number.isInteger(quantity) || quantity < 1 || !Number.isInteger(damaged) || damaged < 0 || damaged > quantity ||
      notes.length > 500 || deliveryReference.length > 160) return { error: "Enter valid received and damaged quantities." };
  const { error } = await supabase.rpc("admin_receive_purchase_order_line_v2", {
    p_purchase_order_item_id: id, p_quantity: quantity, p_damaged: damaged,
    p_notes: notes || undefined, p_supplier_delivery_reference: deliveryReference || undefined,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/purchase-orders");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
  return { success: true };
}


export async function recordPurchaseOrderPaymentAction(purchaseOrderId: string, formData: FormData) {
  const supabase = await requireOrderManager();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amount = Number(amountRaw);
  const paymentDate = String(formData.get("payment_date") ?? "").trim();
  const paymentMethod = String(formData.get("payment_method") ?? "");
  const reference = String(formData.get("reference_number") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!/^\\d+(?:\\.\\d{1,2})?$/.test(amountRaw) || !Number.isFinite(amount) || amount <= 0 ||
      !/^\\d{4}-\\d{2}-\\d{2}$/.test(paymentDate) ||
      !["bank_transfer", "cash", "card", "other"].includes(paymentMethod) ||
      reference.length > 160 || notes.length > 2000) {
    return { error: "Check the payment amount, date, method and reference." };
  }

  const { error } = await supabase.rpc("admin_record_purchase_order_payment", {
    p_purchase_order_id: purchaseOrderId,
    p_amount: amount,
    p_payment_date: paymentDate,
    p_payment_method: paymentMethod,
    p_reference_number: reference,
    p_notes: notes,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/purchase-orders");
  revalidatePath("/admin/purchase-orders/" + purchaseOrderId);
  revalidatePath("/admin");
  return { success: true };
}

export async function updateShipmentStatusAction(shipmentId: string, orderId: string, newStatus: string, note: string) {
  const supabase = await requireOrderManager();
  if (!/^[0-9a-f-]{36}$/i.test(shipmentId) || !/^[0-9a-f-]{36}$/i.test(orderId) ||
      !["label_created", "shipped", "in_transit", "exception", "returned", "cancelled"].includes(newStatus) ||
      typeof note !== "string" || note.length > 500) {
    return { error: "Check the shipment status and note." };
  }
  const { error } = await supabase.rpc("admin_update_shipment_status", {
    p_shipment_id: shipmentId,
    p_new_status: newStatus as Database["public"]["Enums"]["shipment_status"],
    p_note: note.trim() || undefined,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/orders");
  revalidatePath("/admin/orders/" + orderId);
  return { success: true };
}

export async function createShipmentIssueAction(orderId: string, shipmentId: string, issueType: string, reason: string) {
  const supabase = await requireOrderManager();
  if (!/^[0-9a-f-]{36}$/i.test(orderId) || !/^[0-9a-f-]{36}$/i.test(shipmentId) ||
      !["exception", "returned"].includes(issueType) || typeof reason !== "string" || reason.trim().length < 3 || reason.length > 3000) {
    return { error: "Enter a valid issue type and reason." };
  }
  const { error } = await supabase.rpc("admin_create_shipment_issue", {
    p_shipment_id: shipmentId, p_issue_type: issueType, p_reason: reason.trim(),
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/orders/" + orderId);
  return { success: true };
}

export async function updateShipmentIssueAction(orderId: string, issueId: string, status: string, action: string | null, notes: string, amount: string, reference: string, confirmRefund: boolean, method: string, transactionNumber: string) {
  const supabase = await requireOrderManager();
  if (!/^[0-9a-f-]{36}$/i.test(orderId) || !/^[0-9a-f-]{36}$/i.test(issueId) ||
      !["open", "in_progress", "resolved"].includes(status) ||
      (action !== null && !["awaiting_carrier", "reship", "refund", "other"].includes(action)) ||
      typeof notes !== "string" || notes.length > 3000 || typeof reference !== "string" || reference.length > 200) {
    return { error: "Check the issue status, resolution and notes." };
  }
  const parsedAmount = confirmRefund ? Number(amount) : null;
  if (confirmRefund && (!Number.isFinite(parsedAmount) || parsedAmount! <= 0)) return { error: "Enter the actual refunded amount." };
  if (confirmRefund && (!["bank_transfer","card","paypal","cash","other"].includes(method) || !transactionNumber.trim() || transactionNumber.length > 200)) return { error: "Select the actual refund method and enter the transaction number." };
  const shipmentIssueArgs = {
    p_issue_id: issueId,
    p_status: status,
    p_resolution_action: action,
    p_resolution_notes: notes.trim(),
    p_refund_amount: parsedAmount ?? undefined,
    p_refund_reference: reference.trim() || undefined,
    p_confirm_refund: confirmRefund,
    p_refund_method: confirmRefund ? method : undefined,
    p_transaction_number: confirmRefund ? transactionNumber.trim() : undefined,
  } satisfies RpcArgsWithNullableFields<"admin_update_shipment_issue", "p_resolution_action">;
  const { data, error } = await supabase.rpc(
    "admin_update_shipment_issue",
    shipmentIssueArgs as Database["public"]["Functions"]["admin_update_shipment_issue"]["Args"]
  );
  if (error) return { error: error.message };
  revalidatePath("/admin/orders/" + orderId);
  return { success: true, data };
}

export async function createReplacementShipmentAction(orderId: string, issueId: string, carrier: string, tracking: string, url: string, stockSource: string) {
  const supabase = await requireOrderManager();
  if (!/^[0-9a-f-]{36}$/i.test(orderId) || !/^[0-9a-f-]{36}$/i.test(issueId) ||
      typeof carrier !== "string" || carrier.trim().length < 2 || carrier.length > 100 ||
      typeof tracking !== "string" || tracking.trim().length < 3 || tracking.length > 150 ||
      typeof url !== "string" || url.length > 2000 || (url && !/^https?:\/\//i.test(url)) ||
      !["returned_item", "new_inventory"].includes(stockSource)) {
    return { error: "Enter a valid carrier, tracking number and tracking URL." };
  }
  const { error } = await supabase.rpc("admin_create_replacement_shipment", {
    p_issue_id: issueId, p_carrier_name: carrier.trim(), p_tracking_number: tracking.trim(), p_tracking_url: url.trim(), p_stock_source: stockSource,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/orders/" + orderId);
  return { success: true };
}

export async function recordShipmentReturnAction(orderId: string, issueId: string, orderItemId: string, quantity: number, warehouseId: string, notes: string) {
  const supabase = await requireOrderManager();
  if (!/^[0-9a-f-]{36}$/i.test(orderId) || !/^[0-9a-f-]{36}$/i.test(issueId) ||
      !/^[0-9a-f-]{36}$/i.test(orderItemId) || !/^[0-9a-f-]{36}$/i.test(warehouseId) ||
      !Number.isInteger(quantity) || quantity < 1 || quantity > 100000 || typeof notes !== "string" || notes.length > 1000) {
    return { error: "Enter a valid returned item, quantity and warehouse." };
  }
  const { error } = await supabase.rpc("admin_record_shipment_return", {
    p_issue_id: issueId, p_order_item_id: orderItemId, p_quantity: quantity,
    p_warehouse_id: warehouseId, p_condition: "pending_inspection", p_notes: notes.trim() || undefined,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/orders/" + orderId);
  revalidatePath("/admin/inventory");
  return { success: true };
}

export async function inspectShipmentReturnAction(orderId: string, receiptId: string, condition: string, notes: string) {
  const supabase = await requireOrderManager();
  if (!/^[0-9a-f-]{36}$/i.test(orderId) || !/^[0-9a-f-]{36}$/i.test(receiptId) ||
      !["restockable", "damaged", "not_restocked"].includes(condition) ||
      typeof notes !== "string" || notes.length > 1000) {
    return { error: "Choose a valid inspection result and note." };
  }
  const { error } = await supabase.rpc("admin_inspect_shipment_return", {
    p_receipt_id: receiptId, p_condition: condition, p_notes: notes.trim() || undefined,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/orders/" + orderId);
  revalidatePath("/admin/inventory");
  return { success: true };
}

export async function recordAfterSalesReturnAction(orderId: string, caseId: string, orderItemId: string, quantity: number, warehouseId: string, notes: string) {
  const supabase = await requireOrderManager();
  if (!/^[0-9a-f-]{36}$/i.test(orderId) || !/^[0-9a-f-]{36}$/i.test(caseId) ||
      !/^[0-9a-f-]{36}$/i.test(orderItemId) || !/^[0-9a-f-]{36}$/i.test(warehouseId) ||
      !Number.isInteger(quantity) || quantity < 1 || quantity > 100000 ||
      typeof notes !== "string" || notes.length > 1000) return { error: "Enter a valid returned item, quantity and warehouse." };
  const { error } = await supabase.rpc("admin_record_after_sales_return", {
    p_case_id: caseId, p_order_item_id: orderItemId, p_quantity: quantity,
    p_warehouse_id: warehouseId, p_notes: notes.trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/orders/" + orderId);
  revalidatePath("/admin/inventory");
  return { success: true };
}

export async function confirmAfterSalesRefundAction(orderId: string, caseId: string, amount: string, reference: string, method: string, transactionNumber: string) {
  const supabase = await requireOrderManager();
  if (!/^[0-9a-f-]{36}$/i.test(orderId) || !/^[0-9a-f-]{36}$/i.test(caseId) ||
      typeof amount !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(amount) ||
      !Number.isFinite(Number(amount)) || Number(amount) <= 0 ||
      typeof reference !== "string" || reference.length > 200 ||
      !["bank_transfer","card","paypal","cash","other"].includes(method) ||
      typeof transactionNumber !== "string" || transactionNumber.trim().length < 1 || transactionNumber.length > 200) {
    return { error: "Enter the refund amount, method and transaction number." };
  }
  const { data, error } = await supabase.rpc("admin_confirm_after_sales_refund", {
    p_case_id: caseId, p_refund_amount: Number(amount), p_refund_reference: reference.trim() || undefined,
    p_refund_method: method, p_transaction_number: transactionNumber.trim(),
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/orders");
  revalidatePath("/admin/orders/" + orderId);
  return { success: true, data };
}
