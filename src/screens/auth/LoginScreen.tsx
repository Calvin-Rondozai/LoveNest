import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthLayout } from '../../components/AuthLayout';
import { FormField } from '../../components/FormField';
import { Button } from '../../components/Button';
import { GoogleButton, OrDivider } from '../../components/GoogleButton';
import { InlineLink } from '../../components/ConsentCheckbox';
import { useAuth, AuthError } from '../../store/auth';
import { useLockout, formatWait } from '../../utils/rateLimit';
import { emailError, LIMITS, compactErrors } from '../../utils/validation';
import { LEGAL_VERSION } from '../../legal/content';
import { useTheme } from '../../context/ThemeContext';
import { font, spacing, primary, danger } from '../../theme';
import { RootStackParamList } from '../../navigation/types';

type Errors = { email?: string; password?: string; form?: string };

export const LoginScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const signIn = useAuth((s) => s.signIn);
  const signInWithGoogle = useAuth((s) => s.signInWithGoogle);
  const { locked, remaining, lock } = useLockout('login:device');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState<'email' | 'google' | null>(null);

  const handleError = (e: unknown) => {
    const err = e as AuthError;
    if (err.code === 'rate_limited' && err.retryAfterMs) lock(err.retryAfterMs);
    setErrors({ form: err.code === 'rate_limited' ? undefined : err.message });
    setLoading(null);
  };

  const submit = async () => {
    const next = compactErrors({ email: emailError(email), password: password ? null : 'Enter your password' });
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading('email');
    try {
      await signIn(email, password);
    } catch (e) {
      handleError(e);
    }
  };

  const google = async () => {
    setLoading('google');
    try {
      await signInWithGoogle(LEGAL_VERSION);
    } catch (e) {
      handleError(e);
    }
  };

  const busy = loading !== null || locked;

  return (
    <AuthLayout title="Welcome Back" subtitle="Sign in to continue sending love.">
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
        error={errors.email}
      />
      <FormField
        label="Password"
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        placeholder="Enter your password"
        secure
        autoCapitalize="none"
        autoComplete="current-password"
        maxLength={LIMITS.passwordMax}
        error={errors.password}
      />

      <Pressable onPress={() => navigation.navigate('ForgotPassword', { email })} hitSlop={8} style={styles.forgot}>
        <Text style={styles.link}>Forgot password?</Text>
      </Pressable>

      {locked ? (
        <Text style={styles.formError}>Too many sign-in attempts. Try again in {formatWait(remaining)}.</Text>
      ) : errors.form ? (
        <Text style={styles.formError}>{errors.form}</Text>
      ) : null}

      <Button label={loading === 'email' ? 'Signing in…' : 'Log In'} onPress={submit} disabled={busy} />

      <OrDivider />

      <GoogleButton label="Continue with Google" onPress={google} loading={loading === 'google'} disabled={busy} />

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textMuted }]}>Don't have an account? </Text>
        <Pressable onPress={() => navigation.navigate('SignUp')} hitSlop={8}>
          <Text style={styles.link}>Create one</Text>
        </Pressable>
      </View>

      <Text style={[styles.legal, { color: colors.textMuted }]}>
        By continuing you agree to our{' '}
        <InlineLink label="Terms of Use" onPress={() => navigation.navigate('Legal', { doc: 'terms' })} /> and{' '}
        <InlineLink label="Privacy Policy" onPress={() => navigation.navigate('Legal', { doc: 'privacy' })} />.
      </Text>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  forgot: { alignSelf: 'flex-end', marginTop: -spacing.xs, marginBottom: spacing.lg },
  link: { color: primary, fontSize: font.size.sm, fontFamily: font.sansSemi },
  formError: { color: danger, fontSize: font.size.sm, fontFamily: font.sansMedium, textAlign: 'center', marginBottom: spacing.md },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: spacing.xl },
  footerText: { fontSize: font.size.sm, fontFamily: font.sans },
  legal: { fontSize: font.size.xs, fontFamily: font.sans, textAlign: 'center', marginTop: spacing.lg, lineHeight: 18 },
});
