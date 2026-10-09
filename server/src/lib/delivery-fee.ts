/** Delivery area for now. The app no longer asks for a city. */
export const DELIVERY_CITY = 'Mutare';

/** Delivery fee in cents from cart subtotal (before delivery). */
export function deliveryFeeCentsFor(subtotalCents: number): number {
  // Under US$50 → US$5; US$50 and above → US$10.
  return subtotalCents < 5_000 ? 500 : 1_000;
}

export const DELIVERY_FEE_RULES = {
  thresholdCents: 5_000,
  belowCents: 500,
  atOrAboveCents: 1_000,
} as const;
