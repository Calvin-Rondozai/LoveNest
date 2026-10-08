import type { NavigatorScreenParams } from '@react-navigation/native';

import type { LegalDocId } from '../legal/content';

export type RootStackParamList = {
  Onboarding: undefined;
  Legal: { doc: LegalDocId };
  DeleteAccount: undefined;
  Notifications: undefined;
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: { email?: string } | undefined;
  VerifyOtp: { email: string };
  ResetPassword: { email: string };
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
