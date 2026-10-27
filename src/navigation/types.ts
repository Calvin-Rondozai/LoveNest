import type { NavigatorScreenParams } from '@react-navigation/native';

import type { LegalDocId } from '../legal/content';

export type RootStackParamList = {
  Onboarding: undefined;
  Legal: { doc: LegalDocId };
  DeleteAccount: undefined;
  Notifications: undefined;
  ChangePassword: { forced?: boolean } | undefined;
  EditProfile: undefined;
  OrderDetail: { orderNumber: string };
  PaymentPending: { orderId: string; method: 'ecocash'; phone: string };
  Login: { email?: string } | undefined;
  SignUp: undefined;
  ForgotPassword: { email?: string } | undefined;
  SecurityQuestion: { email: string; question: string };
  ResetPassword: { email: string; answer: string };
  Tabs: NavigatorScreenParams<TabParamList>;
  ProductDetail: { productId: string };
  Cart: undefined;
  Delivery: undefined;
  PaymentMethod: undefined;
  ConfirmOrder: undefined;
  OrderSuccess: { orderNumber: string };
};

export type TabParamList = {
  Home: undefined;
  Categories: { categoryId?: string; query?: string; ts?: number } | undefined;
  CartTab: undefined;
  Orders: undefined;
  Profile: undefined;
};
