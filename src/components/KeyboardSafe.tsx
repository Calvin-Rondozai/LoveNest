import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, ViewStyle } from 'react-native';

/**
 * Keeps text fields and the bottom button above the on-screen keyboard.
 * Android apps are edge-to-edge in this Expo SDK, so the window no longer resizes for the
 * keyboard by itself; padding the content works the same way on both platforms.
 */
export const KeyboardSafe = ({ children, style }: { children: ReactNode; style?: ViewStyle }) => (
  <KeyboardAvoidingView style={[styles.fill, style]} behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}>
    {children}
  </KeyboardAvoidingView>
);

const styles = StyleSheet.create({ fill: { flex: 1 } });
