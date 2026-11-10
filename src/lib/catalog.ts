import { createClient } from "@/lib/supabase/server";

export type StoreCategory = {
  id: string;
  slug: string;
  number: string;
  name: string;
  description: string;
};

function isNextDynamicServerUsageError(error: unknown): error is Error & { digest: string } {
  return typeof error === "object" && error !== null &&
    "digest" in error && error.digest === "DYNAMIC_SERVER_USAGE";
}

export async function getRootCategories(): Promise<StoreCategory[]> {
  let supabase;
  try {
    supabase = await createClient();
  } catch (error) {
    if (isNextDynamicServerUsageError(error)) throw error;
    console.error("Supabase is not configured for the storefront catalog:", error);
    return [];
  }

  const { data, error } = await supabase.from("categories")
    .select("id,slug,name,description,sort_order")
    .is("parent_id", null)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("Unable to load main categories:", error.message);
    return [];
  }
  return (data ?? []).map((category, index) => ({
    id: category.id,
    slug: category.slug,
    number: String(index + 1).padStart(2, "0"),
    name: category.name,
    description: category.description ?? "",
  }));
}
