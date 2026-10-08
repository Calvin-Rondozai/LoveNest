import { create } from 'zustand';

export type PaymentMethod = 'ecocash' | 'cod';

type CheckoutDraft = {
  recipientName: string;
  recipientPhone: string;
  address: string;
  apartment: string;
  city: string;
  instructions: string;
  giftMessage: string;
  paymentMethod: PaymentMethod;
  promoCode: string;
};

type CheckoutState = CheckoutDraft & {
  update: (fields: Partial<CheckoutDraft>) => void;
  reset: () => void;
};

const initialDraft: CheckoutDraft = {
  recipientName: '',
  recipientPhone: '',
  address: '',
  apartment: '',
  city: '',
  instructions: '',
  giftMessage: '',
  paymentMethod: 'ecocash',
  promoCode: '',
};

export const useCheckout = create<CheckoutState>((set) => ({
  ...initialDraft,
  update: (fields) => set(fields),
  reset: () => set(initialDraft),
}));
