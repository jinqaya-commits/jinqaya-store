"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireSupplierManager() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");
  const { data: allowed, error } = await supabase.rpc("can_manage_catalog");
  if (error || allowed !== true) throw new Error("You do not have permission to manage suppliers.");
  return supabase;
}

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function saveSupplierAction(formData: FormData) {
  const supabase = await requireSupplierManager();
  const id = value(formData, "id");
  const company_name = value(formData, "company_name");
  const contact_name = value(formData, "contact_name");
  const email = value(formData, "email");
  const phone = value(formData, "phone");
  const website = value(formData, "website");
  const country = value(formData, "country");
  const city = value(formData, "city");
  const address = value(formData, "address");
  const postal_code = value(formData, "postal_code");
  const payment_terms = value(formData, "payment_terms");
  const currency = value(formData, "currency").toUpperCase();
  const notes = value(formData, "notes");
  if (company_name.length < 2 || company_name.length > 160 ||
      contact_name.length > 160 || email.length > 254 || phone.length > 60 ||
      website.length > 300 || country.length > 100 || city.length > 100 ||
      address.length > 500 || postal_code.length > 30 ||
      payment_terms.length > 160 || !/^[A-Z]{3}$/.test(currency) || notes.length > 3000) {
    return { error: "Please check the supplier name and field lengths. Currency must be a 3-letter code." };
  }
  if (website && !/^https?:\/\//i.test(website)) {
    return { error: "Website must start with https:// or http://." };
  }
  const record = {
    company_name, contact_name: contact_name || null, email: email || null,
    phone: phone || null, website: website || null, country: country || null,
    city: city || null, address: address || null, postal_code: postal_code || null,
    payment_terms: payment_terms || null, currency, notes: notes || null,
    updated_at: new Date().toISOString(),
  };
  const result = id
    ? await supabase.from("suppliers").update(record).eq("id", id).select("id").maybeSingle()
    : await supabase.from("suppliers").insert({ ...record, is_active: true }).select("id").single();
  if (result.error) return { error: result.error.message };
  if (!result.data) return { error: "Supplier was not found or could not be updated." };
  revalidatePath("/admin/suppliers");
  revalidatePath("/admin/purchase-orders");
  return { success: true, id: result.data.id };
}

export async function setSupplierActiveAction(formData: FormData) {
  const supabase = await requireSupplierManager();
  const id = value(formData, "id");
  const active = value(formData, "active") === "true";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Invalid supplier." };
  const { data, error } = await supabase.from("suppliers")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq("id", id).select("id").maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Supplier was not found or could not be updated." };
  revalidatePath("/admin/suppliers");
  revalidatePath("/admin/purchase-orders");
  return { success: true };
}
