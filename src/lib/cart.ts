export type CartItem = {
  key: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantId: string;
  variantName: string;
  sku: string;
  price: number;
  currency: string;
  imageUrl: string | null;
  quantity: number;
};

const CART_KEY = "jinqaya-cart-v1";
export const CART_EVENT = "jinqaya-cart-updated";

export function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(CART_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is CartItem =>
      !!item && typeof item === "object" &&
      typeof item.key === "string" &&
      typeof item.productId === "string" &&
      typeof item.productSlug === "string" &&
      typeof item.productName === "string" &&
      typeof item.variantId === "string" &&
      typeof item.price === "number" && Number.isFinite(item.price) &&
      typeof item.quantity === "number" && Number.isInteger(item.quantity) && item.quantity > 0
    );
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(CART_EVENT));
}

export function addCartItem(item: Omit<CartItem, "key" | "quantity">, quantity = 1) {
  const items = readCart();
  const key = item.variantId;
  const existing = items.find((entry) => entry.key === key);
  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({ ...item, key, quantity });
  }
  writeCart(items);
}

export function formatCartMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}
