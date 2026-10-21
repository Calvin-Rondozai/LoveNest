import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthLayout } from '../../components/AuthLayout';
import { FormField } from '../../components/FormField';
import { Button } from '../../components/Button';
import { useAuth, AuthError } from '../../store/auth';
import { useLockout, formatWait } from '../../utils/rateLimit';
import { emailError, LIMITS } from '../../utils/validation';
import { openWhatsApp } from '../../utils/whatsapp';
import { font, spacing, danger } from '../../theme';
import { RootStackParamList } from '../../navigation/types';

export const ForgotPasswordScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ForgotPassword'>>();
  const lookupRecoveryQuestion = useAuth((s) => s.lookupRecoveryQuestion);
  const { locked, remaining, lock } = useLockout();

  const [email, setEmail] = useState(route.params?.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [needsSupport, setNeedsSupport] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const invalid = emailError(email);
    setError(invalid);
    setFormError(null);
    setNeedsSupport(false);
    if (invalid) return;

    setLoading(true);
    try {
      const { question } = await lookupRecoveryQuestion(email);
      navigation.navigate('SecurityQuestion', { email: email.trim().toLowerCase(), question });
    } catch (e) {
      const err = e as AuthError;
      if (err.code === 'rate_limited' && err.retryAfterMs) lock(err.retryAfterMs);
      else {
        setFormError(err.message);
        setNeedsSupport(err.code === 'recovery_unavailable');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      showBack
      headerIcon="key-outline"
      title="Forgot Password?"
      subtitle="Enter the email linked to your account. We will show the security question you chose when you created the account."
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
        <Text style={styles.formError}>Too many attempts. Try again in {formatWait(remaining)}.</Text>
      ) : formError ? (
        <Text style={styles.formError}>{formError}</Text>
      ) : null}
      <Button label={loading ? 'Looking up…' : 'Continue'} onPress={submit} disabled={loading || locked} />
      {needsSupport ? (
        <Button
          label="Message LoveNest on WhatsApp"
          icon="logo-whatsapp"
          variant="outline"
          onPress={() => openWhatsApp('Hi LoveNest, I need help resetting my password.')}
          style={styles.support}
        />
      ) : null}
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  formError: { color: danger, fontSize: font.size.sm, fontFamily: font.sansMedium, textAlign: 'center', marginBottom: spacing.md },
  support: { marginTop: spacing.md },
});
