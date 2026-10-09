/** Delivery fee in US$ from cart subtotal (before delivery). Mirrors the server rule. */
export function deliveryFeeFor(subtotal: number): number {
  return subtotal < 50 ? 5 : 10;
}
