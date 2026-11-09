import { CheckoutForm } from "./checkout-form";
import { StorefrontHeader } from "@/components/storefront/storefront-header";

export const metadata = {
  title: "Checkout | JINQAYA",
  description: "Enter your delivery details for your JINQAYA order request.",
};

export default function CheckoutPage() {
  return <CheckoutForm header={<StorefrontHeader />} />;
}
