import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TabNavigator } from './TabNavigator';
import { ProductDetailScreen } from '../screens/ProductDetailScreen';
import { CartScreen } from '../screens/CartScreen';
import { DeliveryScreen } from '../screens/DeliveryScreen';
import { PaymentMethodScreen } from '../screens/PaymentMethodScreen';
import { ConfirmOrderScreen } from '../screens/ConfirmOrderScreen';
import { OrderSuccessScreen } from '../screens/OrderSuccessScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ChangePasswordScreen } from '../screens/ChangePasswordScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { VerifyOtpScreen } from '../screens/auth/VerifyOtpScreen';
import { ResetPasswordScreen } from '../screens/auth/ResetPasswordScreen';
import { LegalScreen } from '../screens/legal/LegalScreen';
import { DeleteAccountScreen } from '../screens/legal/DeleteAccountScreen';
import { useAuth } from '../store/auth';
import { useOnboarding } from '../store/onboarding';
import { ToastHost } from '../components/ToastHost';
import { useTheme } from '../context/ThemeContext';
import { primary } from '../theme';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = () => {
  const { mode, colors } = useTheme();
  const signedIn = useAuth((s) => s.user !== null);
  const seenOnboarding = useOnboarding((s) => s.seen);
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: colors.bg, card: colors.surface, text: colors.text, border: colors.border, primary },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        {!seenOnboarding ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: 'fade' }} />
        ) : signedIn ? (
          <Stack.Group>
            <Stack.Screen name="Tabs" component={TabNavigator} />
            <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
            <Stack.Screen name="Cart" component={CartScreen} />
            <Stack.Screen name="Delivery" component={DeliveryScreen} />
            <Stack.Screen name="ConfirmOrder" component={ConfirmOrderScreen} />
            <Stack.Screen name="PaymentMethod" component={PaymentMethodScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="OrderSuccess" component={OrderSuccessScreen} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} options={{ animation: 'slide_from_right' }} />
          </Stack.Group>
        ) : (
          <Stack.Group screenOptions={{ animation: 'slide_from_right' }}>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="VerifyOtp" component={VerifyOtpScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </Stack.Group>
        )}
        {/* Legal docs must be reachable whether or not the user is signed in. */}
        <Stack.Screen name="Legal" component={LegalScreen} options={{ animation: 'slide_from_bottom' }} />
      </Stack.Navigator>
      <ToastHost />
    </NavigationContainer>
  );
};
