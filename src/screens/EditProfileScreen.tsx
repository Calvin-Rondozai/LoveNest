import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { Button } from '../components/Button';
import { useAuth, AuthError } from '../store/auth';
import { useToast } from '../store/toast';
import { useTheme } from '../context/ThemeContext';
import { nameError, compactErrors, LIMITS } from '../utils/validation';
import { phoneError, isPhoneValid, toE164 } from '../utils/phone';
import { formatLocal } from '../utils/mobileMoney';
import { font, spacing, danger } from '../theme';
import { RootStackParamList } from '../navigation/types';

export const EditProfileScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const updateProfile = useAuth((s) => s.updateProfile);
  const showToast = useToast((s) => s.show);

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ? formatLocal(user.phone) : '');
  const [errors, setErrors] = useState<{ name?: string; phone?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const next = compactErrors({
      name: nameError(name, 'full name'),
      phone: !phone.trim()
        ? 'Enter your phone number'
        : (phoneError(phone) ?? (isPhoneValid(phone) ? null : 'Enter a complete phone number')),
    });
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      await updateProfile({ name, phone: toE164(phone) ?? phone });
      showToast('Your details were updated', 3000);
      navigation.goBack();
    } catch (e) {
      setErrors({ form: (e as AuthError).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthLayout showBack title="My Details" subtitle="Update the name and phone we use for delivery.">
      <FormField
        label="Full Name"
        icon="person-outline"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        maxLength={LIMITS.name}
        error={errors.name}
      />
      <FormField label="Email" icon="mail-outline" value={user?.email ?? ''} editable={false} />
      <Text style={[styles.hint, { color: colors.textMuted }]}>Email cannot be changed here. Contact support if you need a new email.</Text>
      <FormField
        label="Phone Number"
        icon="call-outline"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        maxLength={20}
        error={errors.phone}
      />
      {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}
      <Button label={saving ? 'Saving…' : 'Save Changes'} onPress={save} disabled={saving} />
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  hint: { fontSize: font.size.xs, fontFamily: font.sans, marginBottom: spacing.md, lineHeight: 16 },
  formError: { color: danger, fontSize: font.size.sm, fontFamily: font.sansMedium, textAlign: 'center', marginBottom: spacing.md },
});
