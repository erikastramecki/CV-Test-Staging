export const PRODUCT = {
  id: "basic-tee",
  name: "Basic Tee",
  price: 4.0,
};

export const SHIPPING_FLAT = 1.0;
export const TAX_RATE = 0.05;

export function computeTotals(quantity) {
  const subtotal = PRODUCT.price * quantity;
  const taxes = subtotal * TAX_RATE;
  const total = subtotal + SHIPPING_FLAT + taxes;
  return { subtotal, shipping: SHIPPING_FLAT, taxes, total };
}
