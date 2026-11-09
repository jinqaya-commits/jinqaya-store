import { StorefrontHeader } from "@/components/storefront/storefront-header";
import CartPage from "@/app/cart/page";

export default function Page() {
  return <CartPage header={<StorefrontHeader />} />;
}
