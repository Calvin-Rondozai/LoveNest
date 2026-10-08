import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthLayout } from '../../components/AuthLayout';
import { FormField } from '../../components/FormField';
import { Button } from '../../components/Button';
import { PasswordChecklist } from '../../components/PasswordChecklist';
import { useAuth, AuthError } from '../../store/auth';
import { useToast } from '../../store/toast';
import { passwordError, confirmError, compactErrors, LIMITS } from '../../utils/validation';
import { font, spacing, danger } from '../../theme';
import { RootStackParamList } from '../../navigation/types';

export const ResetPasswordScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { email } = useRoute<RouteProp<RootStackParamList, 'ResetPassword'>>().params;
  const resetPassword = useAuth((s) => s.resetPassword);
  const showToast = useToast((s) => s.show);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const next = compactErrors({ password: passwordError(password, { email }), confirm: confirmError(password, confirm) });
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await resetPassword(email, password);
      showToast('Password updated — please log in');
      navigation.popTo('Login');
    } catch (e) {
      setErrors({ form: (e as AuthError).message });
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      showBack
      headerIcon="lock-open-outline"
      title="Create New Password"
      subtitle="Your new password must be different from the one you used before."
    >
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
        label="Confirm Password"
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
      {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}
      <Button label={loading ? 'Saving…' : 'Reset Password'} onPress={submit} disabled={loading} />
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  formError: { color: danger, fontSize: font.size.sm, fontFamily: font.sansMedium, textAlign: 'center', marginBottom: spacing.md },
});
