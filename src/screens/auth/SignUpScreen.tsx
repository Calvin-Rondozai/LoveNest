import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthLayout } from '../../components/AuthLayout';
import { FormField } from '../../components/FormField';
import { SelectField } from '../../components/SelectField';
import { Button } from '../../components/Button';
import { ConsentCheckbox, InlineLink } from '../../components/ConsentCheckbox';
import { PasswordChecklist } from '../../components/PasswordChecklist';
import { useAuth, AuthError } from '../../store/auth';
import { useLockout, formatWait } from '../../utils/rateLimit';
import { nameError, emailError, passwordError, confirmError, securityAnswerError, compactErrors, LIMITS } from '../../utils/validation';
import { phoneError, isPhoneValid } from '../../utils/phone';
import { LEGAL_VERSION } from '../../legal/content';
import { SECURITY_QUESTIONS, type SecurityQuestionId } from '../../data/securityQuestions';
import { useTheme } from '../../context/ThemeContext';
import { font, spacing, primary, danger } from '../../theme';
import { RootStackParamList } from '../../navigation/types';

type Errors = {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirm?: string;
  question?: string;
  answer?: string;
  terms?: string;
  form?: string;
};

export const SignUpScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const signUp = useAuth((s) => s.signUp);
  const { locked, remaining, lock } = useLockout('signup:device');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [questionId, setQuestionId] = useState<SecurityQuestionId | null>(null);
  const [answer, setAnswer] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

  const handleError = (e: unknown) => {
    const err = e as AuthError;
    if (err.code === 'rate_limited' && err.retryAfterMs) lock(err.retryAfterMs);
    if (err.code === 'email_taken') setErrors({ email: err.message });
    else setErrors({ form: err.code === 'rate_limited' ? undefined : err.message });
    setLoading(false);
  };

  const submit = async () => {
    const next = compactErrors({
      name: nameError(name, 'full name'),
      email: emailError(email),
      phone: !phone.trim()
        ? 'Enter your phone number'
        : (phoneError(phone) ?? (isPhoneValid(phone) ? null : 'Enter a complete phone number')),
      password: passwordError(password, { email }),
      confirm: confirmError(password, confirm),
      question: questionId ? null : 'Choose a security question',
      answer: securityAnswerError(answer),
      terms: agreed ? null : 'You must accept the Terms of Use and Privacy Policy',
    });
    setErrors(next);
    if (Object.keys(next).length || !questionId) return;

    setLoading(true);
    try {
      await signUp(name, email, phone, password, LEGAL_VERSION, questionId, answer);
    } catch (e) {
      handleError(e);
    }
  };

  const busy = loading || locked;

  return (
    <AuthLayout showBack title="Create Account" subtitle="Join LoveNest and make every moment special.">
      <FormField
        label="Full Name"
        icon="person-outline"
        value={name}
        onChangeText={setName}
        placeholder="Jane Doe"
        autoComplete="name"
        autoCapitalize="words"
        maxLength={LIMITS.name}
        error={errors.name}
      />
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
        label="Phone Number"
        icon="call-outline"
        value={phone}
        onChangeText={setPhone}
        placeholder="0771 234 567"
        keyboardType="phone-pad"
        autoComplete="tel"
        maxLength={20}
        error={errors.phone}
      />
      <FormField
        label="Password"
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
        placeholder="Re-enter your password"
        secure
        autoCapitalize="none"
        autoComplete="new-password"
        maxLength={LIMITS.passwordMax}
        error={errors.confirm}
      />

      <SelectField
        label="Security question"
        value={questionId}
        options={SECURITY_QUESTIONS}
        placeholder="Choose a question"
        error={errors.question}
        onChange={(id) => setQuestionId(id as SecurityQuestionId)}
      />
      <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
        You will need this answer if you forget your password. Choose something only you would know.
      </Text>
      <FormField
        label="Type your answer"
        value={answer}
        onChangeText={setAnswer}
        placeholder="Type your answer here"
        autoCapitalize="none"
        autoComplete="off"
        maxLength={LIMITS.securityAnswer}
        error={errors.answer}
      />

      <ConsentCheckbox checked={agreed} onToggle={() => setAgreed((a) => !a)} error={errors.terms}>
        I am 18 or older and agree to the{' '}
        <InlineLink label="Terms of Use" onPress={() => navigation.navigate('Legal', { doc: 'terms' })} /> and{' '}
        <InlineLink label="Privacy Policy" onPress={() => navigation.navigate('Legal', { doc: 'privacy' })} />.
      </ConsentCheckbox>

      {locked ? (
        <Text style={styles.formError}>Too many sign-up attempts. Try again in {formatWait(remaining)}.</Text>
      ) : errors.form ? (
        <Text style={styles.formError}>{errors.form}</Text>
      ) : null}

      <Button
        label={loading ? 'Creating account…' : 'Create Account'}
        onPress={submit}
        disabled={busy}
        style={styles.submit}
      />

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textMuted }]}>Already have an account? </Text>
        <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}>
          <Text style={styles.link}>Log in</Text>
        </Pressable>
      </View>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  submit: { marginTop: spacing.xs },
  link: { color: primary, fontSize: font.size.sm, fontFamily: font.sansSemi },
  formError: { color: danger, fontSize: font.size.sm, fontFamily: font.sansMedium, textAlign: 'center', marginBottom: spacing.md },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: spacing.xl },
  footerText: { fontSize: font.size.sm, fontFamily: font.sans },
  sectionHint: { fontSize: font.size.xs, fontFamily: font.sans, marginTop: -spacing.sm, marginBottom: spacing.md },
});
