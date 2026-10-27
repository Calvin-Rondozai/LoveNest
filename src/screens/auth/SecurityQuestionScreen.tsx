import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthLayout } from '../../components/AuthLayout';
import { FormField } from '../../components/FormField';
import { Button } from '../../components/Button';
import { securityAnswerError, compactErrors, LIMITS } from '../../utils/validation';
import { useTheme } from '../../context/ThemeContext';
import { font, spacing } from '../../theme';
import { RootStackParamList } from '../../navigation/types';

export const SecurityQuestionScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const { email, question } = useRoute<RouteProp<RootStackParamList, 'SecurityQuestion'>>().params;

  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const next = compactErrors({ answer: securityAnswerError(answer) });
    setError(next.answer ?? null);
    if (next.answer) return;
    navigation.navigate('ResetPassword', { email, answer: answer.trim() });
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
      <Button label="Continue" onPress={submit} />
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
});
