export type CheckoutEstimateLine = { price: number; quantity: number };

export function calculateCheckoutShippingEstimate(lines: readonly CheckoutEstimateLine[]) {
  const totalUnits = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotalCents = Math.round(
    lines.reduce((sum, line) => sum + line.price * line.quantity, 0) * 100
  );
  const shippingCents = totalUnits <= 2 ? 5000 : Math.round(subtotalCents * 0.5);
  return { totalUnits, subtotalCents, shippingCents };
}
