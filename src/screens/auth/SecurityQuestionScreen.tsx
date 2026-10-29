import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthLayout } from '../../components/AuthLayout';
import { FormField } from '../../components/FormField';
import { Button } from '../../components/Button';
import { useAuth, AuthError } from '../../store/auth';
import { securityAnswerError, compactErrors, LIMITS } from '../../utils/validation';
import { useTheme } from '../../context/ThemeContext';
import { font, spacing, danger } from '../../theme';
import { RootStackParamList } from '../../navigation/types';

export const SecurityQuestionScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const { email, question } = useRoute<RouteProp<RootStackParamList, 'SecurityQuestion'>>().params;
  const verifyRecoveryAnswer = useAuth((s) => s.verifyRecoveryAnswer);

  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const next = compactErrors({ answer: securityAnswerError(answer) });
    setError(next.answer ?? null);
    setFormError(null);
    if (next.answer) return;

    setLoading(true);
    try {
      const trimmed = answer.trim();
      await verifyRecoveryAnswer(email, trimmed);
      navigation.navigate('ResetPassword', { email, answer: trimmed });
    } catch (e) {
      const err = e as AuthError;
      setFormError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      showBack
      headerIcon="help-circle-outline"
      title="Security Question"
      subtitle={question}
    >
      <FormField
        label="Type your answer"
        value={answer}
        onChangeText={setAnswer}
        placeholder="Type your answer here"
        autoCapitalize="none"
        autoComplete="off"
        maxLength={LIMITS.securityAnswer}
        error={error}
      />
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        Answers are not case-sensitive. Spelling should match what you entered at sign-up.
      </Text>
      {formError ? <Text style={styles.formError}>{formError}</Text> : null}
      <Button label={loading ? 'Checking…' : 'Continue'} onPress={submit} disabled={loading} />
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  hint: {
    fontSize: font.size.xs,
    fontFamily: font.sans,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  formError: { color: danger, fontSize: font.size.sm, fontFamily: font.sansMedium, textAlign: 'center', marginBottom: spacing.md },
});
