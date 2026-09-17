import { supabase } from "@/integrations/supabase/client";
import type { MediaKind } from "@/lib/media";

export type Establishment = {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  theme: Record<string, unknown> | null;
  address: string | null;
  phone: string | null;
  business_category: string | null;
  social_links: Record<string, unknown> | null;
  opening_hours: unknown;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  establishment_id: string;
  name: string;
  sort_order: number;
  visible: boolean;
};

export type Product = {
  id: string;
  establishment_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number | string;
  available: boolean;
  tags: string[] | null;
  real_width_cm: number | string | null;
  real_height_cm: number | string | null;
  real_depth_cm: number | string | null;
};

export type ProductMedia = {
  id: string;
  establishment_id: string;
  product_id: string;
  media_type: MediaKind;
  storage_path: string;
  public_url: string | null;
  sort_order: number;
};

export type OrderStatus = "new" | "preparing" | "ready" | "completed" | "cancelled";
export type OrderItem = { id: string; order_id: string; product_id: string | null; product_name: string; quantity: number; unit_price: number | string; notes: string | null };
export type KitchenOrder = { id: string; establishment_id: string; order_number: number; customer_name: string; table_number: string | null; notes: string | null; status: OrderStatus; total: number | string; created_at: string; updated_at: string; order_items: OrderItem[] };

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/* ---------------- estabelecimento ---------------- */

export async function fetchMyEstablishment(userId: string): Promise<Establishment | null> {
  const memberships = unwrap(
    await supabase.from("establishment_members").select("establishment_id").eq("user_id", userId),
  ) as { establishment_id: string }[];

  const ids = memberships.map((m) => m.establishment_id);
  const query = supabase.from("establishments").select("*");
  const res = ids.length
    ? await query.or(`owner_user_id.eq.${userId},id.in.(${ids.join(",")})`).limit(1)
    : await query.eq("owner_user_id", userId).limit(1);

  const rows = unwrap(res) as Establishment[];
  return rows[0] ?? null;
}

export async function createEstablishment(input: {
  name: string;
  slug: string;
  address?: string | null;
  phone?: string | null;
  business_category?: string | null;
}): Promise<Establishment> {
  const { data, error } = await supabase.rpc("create_establishment_with_owner", {
    _name: input.name,
    _slug: input.slug,
    _address: input.address ?? null,
    _phone: input.phone ?? null,
    _business_category: input.business_category ?? null,
  });
  if (error) throw new Error(error.message);
  return data as unknown as Establishment;
}

export async function updateEstablishment(
  id: string,
  patch: Partial<Establishment>,
): Promise<void> {
  const { error } = await supabase
    .from("establishments")
    .update(patch as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchEstablishmentBySlug(slug: string): Promise<Establishment | null> {
  const rows = unwrap(
    await supabase.from("establishments").select("*").eq("slug", slug).limit(1),
  ) as Establishment[];
  return rows[0] ?? null;
}

/* ---------------- categorias ---------------- */

export async function fetchCategories(
  establishmentId: string,
  onlyVisible = false,
): Promise<Category[]> {
  let q = supabase
    .from("categories")
    .select("*")
    .eq("establishment_id", establishmentId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (onlyVisible) q = q.eq("visible", true);
  return (unwrap(await q) as Category[]) ?? [];
}

export async function createCategory(input: {
  establishment_id: string;
  name: string;
  sort_order: number;
}) {
  const { error } = await supabase.from("categories").insert(input as never);
  if (error) throw new Error(error.message);
}

export async function updateCategory(id: string, patch: Partial<Category>) {
  const { error } = await supabase
    .from("categories")
    .update(patch as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function countProductsInCategory(categoryId: string): Promise<number> {
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/* ---------------- produtos ---------------- */

export async function fetchProducts(
  establishmentId: string,
  onlyAvailable = false,
): Promise<Product[]> {
  let q = supabase
    .from("products")
    .select("*")
    .eq("establishment_id", establishmentId)
    .order("name", { ascending: true });
  if (onlyAvailable) q = q.eq("available", true);
  return (unwrap(await q) as Product[]) ?? [];
}

export async function createProduct(input: Partial<Product> & { establishment_id: string }) {
  const { data, error } = await supabase
    .from("products")
    .insert(input as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data as { id: string };
}

export async function updateProduct(id: string, patch: Partial<Product>) {
  const { error } = await supabase
    .from("products")
    .update(patch as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ---------------- mídias ---------------- */

export async function fetchMediaByEstablishment(establishmentId: string): Promise<ProductMedia[]> {
  return (
    (unwrap(
      await supabase
        .from("product_media")
        .select("*")
        .eq("establishment_id", establishmentId)
        .order("sort_order", { ascending: true }),
    ) as ProductMedia[]) ?? []
  );
}

export async function fetchMediaByProduct(productId: string): Promise<ProductMedia[]> {
  return (
    (unwrap(
      await supabase
        .from("product_media")
        .select("*")
        .eq("product_id", productId)
        .order("sort_order", { ascending: true }),
    ) as ProductMedia[]) ?? []
  );
}

export async function insertMedia(input: {
  establishment_id: string;
  product_id: string;
  media_type: MediaKind;
  storage_path: string;
  sort_order: number;
}) {
  const { error } = await supabase.from("product_media").insert(input as never);
  if (error) throw new Error(error.message);
}

export async function updateMedia(id: string, patch: Partial<ProductMedia>) {
  const { error } = await supabase
    .from("product_media")
    .update(patch as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteMedia(id: string) {
  const { error } = await supabase.from("product_media").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ---------------- pedidos e cozinha ---------------- */

export async function placeOrder(input: { establishmentId: string; customerName: string; tableNumber?: string; notes?: string; items: { product_id: string; quantity: number }[] }): Promise<string> {
  const { data, error } = await (supabase.rpc as any)("place_order", {
    _establishment_id: input.establishmentId,
    _customer_name: input.customerName,
    _table_number: input.tableNumber ?? "",
    _notes: input.notes ?? "",
    _items: input.items,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function fetchKitchenOrders(establishmentId: string): Promise<KitchenOrder[]> {
  const { data, error } = await (supabase.from("orders" as any) as any)
    .select("*, order_items(*)")
    .eq("establishment_id", establishmentId)
    .in("status", ["new", "preparing", "ready"])
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as KitchenOrder[];
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  const { error } = await (supabase.from("orders" as any) as any).update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}
