import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthLayout } from '../../components/AuthLayout';
import { FormField } from '../../components/FormField';
import { Button } from '../../components/Button';
import { useAuth, AuthError } from '../../store/auth';
import { useToast } from '../../store/toast';
import { useLockout, formatWait } from '../../utils/rateLimit';
import { emailError, LIMITS } from '../../utils/validation';
import { font, spacing, danger } from '../../theme';
import { RootStackParamList } from '../../navigation/types';

export const ForgotPasswordScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ForgotPassword'>>();
  const requestPasswordReset = useAuth((s) => s.requestPasswordReset);
  const showToast = useToast((s) => s.show);
  const { locked, remaining, lock } = useLockout();

  const [email, setEmail] = useState(route.params?.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const invalid = emailError(email);
    setError(invalid);
    setFormError(null);
    if (invalid) return;

    setLoading(true);
    try {
      const code = await requestPasswordReset(email);
      // No email service yet, so surface the code in development so the flow is testable.
      if (__DEV__) showToast(`Demo code: ${code}`, 6000);
      navigation.navigate('VerifyOtp', { email: email.trim() });
    } catch (e) {
      const err = e as AuthError;
      if (err.code === 'rate_limited' && err.retryAfterMs) lock(err.retryAfterMs);
      else setFormError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      showBack
      headerIcon="key-outline"
      title="Forgot Password?"
      subtitle="Enter the email linked to your account and we'll send you a 6-digit code to reset your password."
    >
      <FormField
        label="Email"
        icon="mail-outline"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        maxLength={LIMITS.email}
        error={error}
      />
      {locked ? (
        <Text style={styles.formError}>Too many code requests. Try again in {formatWait(remaining)}.</Text>
      ) : formError ? (
        <Text style={styles.formError}>{formError}</Text>
      ) : null}
      <Button label={loading ? 'Sending code…' : 'Send Code'} onPress={submit} disabled={loading || locked} />
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  formError: { color: danger, fontSize: font.size.sm, fontFamily: font.sansMedium, textAlign: 'center', marginBottom: spacing.md },
});
