import { createClient } from "@/lib/supabase/server";

export type StoreCategory = {
  id: string;
  slug: string;
  number: string;
  name: string;
  description: string;
};

export async function getRootCategories(): Promise<StoreCategory[]> {
  let supabase;
  try {
    supabase = await createClient();
  } catch (error) {
    if (error instanceof Error &&
      error.message === "Missing Supabase public environment variables.") {
      return [];
    }
    throw error;
  }

  const { data, error } = await supabase.from("categories")
    .select("id,slug,name,description,sort_order")
    .is("parent_id", null)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((category, index) => ({
    id: category.id,
    slug: category.slug,
    number: String(index + 1).padStart(2, "0"),
    name: category.name,
    description: category.description ?? "",
  }));
}
