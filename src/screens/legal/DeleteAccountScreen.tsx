import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AuthLayout } from '../../components/AuthLayout';
import { FormField } from '../../components/FormField';
import { Button } from '../../components/Button';
import { ConsentCheckbox } from '../../components/ConsentCheckbox';
import { Icon } from '../../components/Icon';
import { useAuth, AuthError } from '../../store/auth';
import { useCart } from '../../store/cart';
import { useCheckout } from '../../store/checkout';
import { useToast } from '../../store/toast';
import { useTheme } from '../../context/ThemeContext';
import { font, radii, spacing, danger } from '../../theme';

const WILL_DELETE = [
  'Your profile, name and email address',
  'Your sign-in details',
  'Saved delivery details and cart',
];

export const DeleteAccountScreen = () => {
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const deleteAccount = useAuth((s) => s.deleteAccount);
  const clearCart = useCart((s) => s.clear);
  const resetCheckout = useCheckout((s) => s.reset);
  const showToast = useToast((s) => s.show);

  const needsPassword = user?.provider === 'password';
  const [password, setPassword] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; understood?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const next: typeof errors = {};
    if (needsPassword && !password) next.password = 'Enter your password to confirm';
    if (!understood) next.understood = 'Please confirm you understand';
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await deleteAccount(needsPassword ? password : undefined);
      clearCart();
      resetCheckout();
      showToast('Your account has been deleted', 3000);
    } catch (e) {
      const err = e as AuthError;
      setErrors(err.code === 'invalid_credentials' ? { password: 'Incorrect password' } : { form: err.message });
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      showBack
      headerIcon="trash-outline"
      title="Delete Account"
      subtitle="This permanently deletes your LoveNest account. It cannot be undone."
    >
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>What will be deleted</Text>
        {WILL_DELETE.map((item) => (
          <View key={item} style={styles.row}>
            <Icon name="close-circle-outline" size={16} color={danger} />
            <Text style={[styles.rowText, { color: colors.textMuted }]}>{item}</Text>
          </View>
        ))}
        <Text style={[styles.note, { color: colors.textMuted }]}>
          Order and payment records we must keep by law are retained only as long as required, then deleted. See our Privacy Policy for details.
        </Text>
      </View>

      {needsPassword ? (
        <FormField
          label="Password"
          icon="lock-closed-outline"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          secure
          autoCapitalize="none"
          autoComplete="current-password"
          error={errors.password}
        />
      ) : null}

      <ConsentCheckbox checked={understood} onToggle={() => setUnderstood((u) => !u)} error={errors.understood}>
        I understand my account will be permanently deleted.
      </ConsentCheckbox>

      {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}

      <Button
        label={loading ? 'Deleting…' : 'Delete My Account'}
        icon="trash-outline"
        onPress={submit}
        disabled={loading}
        style={styles.button}
      />
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.lg, gap: spacing.xs },
  cardTitle: { fontSize: font.size.sm, fontFamily: font.sansBold, marginBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { fontSize: font.size.sm, fontFamily: font.sans },
  note: { fontSize: font.size.xs, fontFamily: font.sans, marginTop: spacing.sm, lineHeight: 18 },
  formError: { color: danger, fontSize: font.size.sm, fontFamily: font.sansMedium, textAlign: 'center', marginBottom: spacing.md },
  button: { backgroundColor: danger },
});
