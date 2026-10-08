import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthLayout } from '../../components/AuthLayout';
import { OtpInput, OtpStatus } from '../../components/OtpInput';
import { Button } from '../../components/Button';
import { useAuth, AuthError } from '../../store/auth';
import { useToast } from '../../store/toast';
import { useTheme } from '../../context/ThemeContext';
import { font, spacing, primary } from '../../theme';
import { RootStackParamList } from '../../navigation/types';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

export const VerifyOtpScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { email } = useRoute<RouteProp<RootStackParamList, 'VerifyOtp'>>().params;
  const { colors } = useTheme();
  const verifyResetCode = useAuth((s) => s.verifyResetCode);
  const requestPasswordReset = useAuth((s) => s.requestPasswordReset);
  const showToast = useToast((s) => s.show);

  const [code, setCode] = useState('');
  const [status, setStatus] = useState<OtpStatus>('idle');
  const [checking, setChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  // Expired / locked / rate-limited codes can't be retried; only a new code helps.
  const [dead, setDead] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const verify = async (value: string) => {
    setChecking(true);
    try {
      await verifyResetCode(email, value);
      setStatus('success');
      timers.current.push(setTimeout(() => navigation.replace('ResetPassword', { email, otp: value }), 900));
    } catch (e) {
      const err = e as AuthError;
      setStatus('error');
      setErrorMessage(err.message);
      if (err.code === 'code_invalid' || err.code === 'network') {
        timers.current.push(
          setTimeout(() => {
            setCode('');
            setStatus('idle');
          }, 1200),
        );
      } else {
        setDead(true);
        if (err.code !== 'rate_limited') setSecondsLeft(0);
      }
    } finally {
      setChecking(false);
    }
  };

  const onChange = (value: string) => {
    if (status !== 'idle') return;
    setCode(value);
    if (value.length === CODE_LENGTH) verify(value);
  };

  const resend = async () => {
    try {
      await requestPasswordReset(email);
      showToast('A new code is on its way');
      setCode('');
      setStatus('idle');
      setDead(false);
      setSecondsLeft(RESEND_SECONDS);
    } catch (e) {
      showToast((e as AuthError).message, 4000);
    }
  };

  return (
    <AuthLayout
      showBack
      headerIcon="shield-checkmark-outline"
      title="Enter Verification Code"
      subtitle={
        <>
          We sent a 6-digit code to{'\n'}
          <Text style={{ color: colors.text, fontFamily: font.sansSemi }}>{email}</Text>
        </>
      }
    >
      <OtpInput value={code} onChangeText={onChange} status={status} length={CODE_LENGTH} errorMessage={errorMessage} disabled={checking || dead || status === 'success'} />

      <Button
        label={checking ? 'Verifying…' : status === 'success' ? 'Verified' : 'Verify Code'}
        icon={status === 'success' ? 'checkmark' : 'arrow-forward'}
        onPress={() => verify(code)}
        disabled={code.length < CODE_LENGTH || checking || status !== 'idle'}
        style={styles.button}
      />

      <View style={styles.resendRow}>
        <Text style={[styles.resendText, { color: colors.textMuted }]}>Didn't get the code? </Text>
        {secondsLeft > 0 ? (
          <Text style={[styles.resendText, { color: colors.textMuted }]}>Resend in 0:{String(secondsLeft).padStart(2, '0')}</Text>
        ) : (
          <Pressable onPress={resend} hitSlop={8}>
            <Text style={styles.link}>Resend code</Text>
          </Pressable>
        )}
      </View>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  button: { marginTop: spacing.xl },
  resendRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg },
  resendText: { fontSize: font.size.sm, fontFamily: font.sans },
  link: { color: primary, fontSize: font.size.sm, fontFamily: font.sansSemi },
});
