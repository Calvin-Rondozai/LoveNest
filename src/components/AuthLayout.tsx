import { ReactNode } from 'react';
import { View, Text, Image, Pressable, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { useTheme } from '../context/ThemeContext';
import { font, radii, spacing, primary } from '../theme';

type Props = {
  title: string;
  subtitle?: ReactNode;
  showBack?: boolean;
  /** Large logo header for the entry screens; compact icon badge for recovery steps. */
  headerIcon?: string;
  children: ReactNode;
};

export const AuthLayout = ({ title, subtitle, showBack, headerIcon, children }: Props) => {
  const navigation = useNavigation();
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {showBack ? (
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={12}
              style={[styles.back, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Icon name="arrow-back" color={colors.text} size={20} />
            </Pressable>
          ) : null}

          {headerIcon ? (
            <View style={[styles.iconBadge, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Icon name={headerIcon} color={primary} size={30} />
            </View>
          ) : (
            <View style={styles.brand}>
              <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
              <Text style={[styles.brandName, { color: colors.text }]}>
                Love<Text style={{ color: primary }}>Nest</Text>
              </Text>
              <Text style={styles.brandScript}>Gifts for Every Moment</Text>
            </View>
          )}

          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}

          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  back: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  brand: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.xl },
  logo: { width: 72, height: 72, borderRadius: radii.lg, marginBottom: spacing.sm },
  brandName: { fontSize: font.size.xl, fontFamily: font.sansBold },
  brandScript: { fontFamily: font.script, color: primary, fontSize: font.size.md, marginTop: -2 },
  iconBadge: {
    width: 68,
    height: 68,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  title: { fontSize: font.size.xl, fontFamily: font.sansBold, textAlign: 'center' },
  subtitle: {
    fontSize: font.size.sm,
    fontFamily: font.sans,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
    lineHeight: 21,
  },
});
