import { create } from 'zustand';
import { newIdempotencyKey } from '../lib/api';

export type PaymentMethod = 'ecocash';

/** Delivery is Mutare-only for now; the city field is fixed, not chosen by the customer. */
export const DELIVERY_CITY = 'Mutare';

type CheckoutDraft = {
  recipientName: string;
  recipientPhone: string;
  address: string;
  apartment: string;
  city: string;
  instructions: string;
  giftMessage: string;
  paymentMethod: PaymentMethod;
  /** Mobile money number that approves the payment. */
  paymentPhone: string;
  /** One key per checkout attempt, so pressing Pay twice never creates two orders. */
  idempotencyKey: string;
};

type CheckoutState = CheckoutDraft & {
  update: (fields: Partial<CheckoutDraft>) => void;
  reset: () => void;
};

const initialDraft = (): CheckoutDraft => ({
  recipientName: '',
  recipientPhone: '',
  address: '',
  apartment: '',
  city: DELIVERY_CITY,
  instructions: '',
  giftMessage: '',
  paymentMethod: 'ecocash',
  paymentPhone: '',
  idempotencyKey: newIdempotencyKey(),
});

export const useCheckout = create<CheckoutState>((set) => ({
  ...initialDraft(),
  update: (fields) => set(fields),
  reset: () => set(initialDraft()),
}));
