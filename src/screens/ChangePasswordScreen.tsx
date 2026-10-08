import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { Button } from '../components/Button';
import { PasswordChecklist } from '../components/PasswordChecklist';
import { useAuth, AuthError } from '../store/auth';
import { useToast } from '../store/toast';
import { useLockout, formatWait } from '../utils/rateLimit';
import { passwordError, confirmError, compactErrors, LIMITS } from '../utils/validation';
import { font, spacing, danger, primary } from '../theme';
import { RootStackParamList } from '../navigation/types';

type Errors = { current?: string; password?: string; confirm?: string; form?: string };

export const ChangePasswordScreen = () => {
  const navigation = useNavigation();
  // Forced: an admin created this account with a temporary password.
  const forced = Boolean(useRoute<RouteProp<RootStackParamList, 'ChangePassword'>>().params?.forced);
  const signOut = useAuth((s) => s.signOut);
  const user = useAuth((s) => s.user);
  const changePassword = useAuth((s) => s.changePassword);
  const showToast = useToast((s) => s.show);
  const { locked, remaining, lock } = useLockout(user ? `changepw:${user.email}` : undefined);

  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const next = compactErrors({
      current: current ? null : 'Enter your current password',
      password: passwordError(password, { email: user?.email }) ?? (password === current ? 'Choose a password you have not used here before' : null),
      confirm: confirmError(password, confirm),
    });
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await changePassword(current, password);
      showToast('Your password has been changed', 3000);
      // In forced mode the navigator switches to the app automatically once the flag clears.
      if (!forced) navigation.goBack();
    } catch (e) {
      const err = e as AuthError;
      if (err.code === 'rate_limited' && err.retryAfterMs) lock(err.retryAfterMs);
      else if (err.code === 'invalid_credentials') setErrors({ current: err.message });
      else setErrors({ form: err.message });
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      showBack={!forced}
      headerIcon="key-outline"
      title={forced ? 'Choose Your Password' : 'Change Password'}
      subtitle={
        forced
          ? 'Your account was created with a temporary password. Enter it, then choose your own to continue.'
          : 'Enter your current password, then choose a new one.'
      }
    >
      <FormField
        label={forced ? 'Temporary Password' : 'Current Password'}
        icon="lock-closed-outline"
        value={current}
        onChangeText={setCurrent}
        placeholder="Enter your current password"
        secure
        autoCapitalize="none"
        autoComplete="current-password"
        maxLength={LIMITS.passwordMax}
        error={errors.current}
      />
      <FormField
        label="New Password"
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        placeholder={`At least ${LIMITS.passwordMin} characters`}
        secure
        autoCapitalize="none"
        autoComplete="new-password"
        maxLength={LIMITS.passwordMax}
        error={errors.password}
      />
      <PasswordChecklist password={password} />
      <FormField
        label="Confirm New Password"
        icon="lock-closed-outline"
        value={confirm}
        onChangeText={setConfirm}
        placeholder="Re-enter your new password"
        secure
        autoCapitalize="none"
        autoComplete="new-password"
        maxLength={LIMITS.passwordMax}
        error={errors.confirm}
      />

      {locked ? (
        <Text style={styles.formError}>Too many incorrect attempts. Try again in {formatWait(remaining)}.</Text>
      ) : errors.form ? (
        <Text style={styles.formError}>{errors.form}</Text>
      ) : null}

      <Button label={loading ? 'Saving...' : 'Update Password'} onPress={submit} disabled={loading || locked} />
      {forced ? (
        <Text style={styles.signOut} onPress={() => signOut()} suppressHighlighting>
          Sign Out
        </Text>
      ) : null}
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  signOut: { color: primary, fontSize: font.size.md, fontFamily: font.sansBold, textAlign: 'center', marginTop: spacing.lg, paddingVertical: spacing.sm },
  formError: { color: danger, fontSize: font.size.sm, fontFamily: font.sansMedium, textAlign: 'center', marginBottom: spacing.md },
});
