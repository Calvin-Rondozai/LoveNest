import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../store/auth';
import { openWhatsApp } from '../utils/whatsapp';
import { LegalDocId } from '../legal/content';
import { font, radii, spacing, primary, onPrimary } from '../theme';
import { RootStackParamList } from '../navigation/types';


const LEGAL_LINKS: { doc: LegalDocId; label: string; icon: string }[] = [
  { doc: 'privacy', label: 'Privacy Policy', icon: 'shield-checkmark-outline' },
  { doc: 'terms', label: 'Terms of Use', icon: 'document-text-outline' },
  { doc: 'refunds', label: 'Returns & Refunds', icon: 'refresh-outline' },
];

export const ProfileScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, mode, setMode } = useTheme();
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.text }]}>Profile</Text>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.surfaceAlt }]}>
            <Icon name="person" color={primary} size={28} />
          </View>
          <Text style={[styles.guest, { color: colors.text }]}>{user?.name ?? 'Guest'}</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>{user?.email}</Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Appearance</Text>
        <View style={[styles.toggleRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {(['light', 'dark'] as const).map((option) => {
            const selected = mode === option;
            return (
              <Pressable key={option} onPress={() => setMode(option)} style={[styles.toggleOption, selected && { backgroundColor: primary }]}>
                <Icon name={option === 'light' ? 'sunny-outline' : 'moon-outline'} size={16} color={selected ? onPrimary : colors.textMuted} />
                <Text style={[styles.toggleLabel, { color: selected ? onPrimary : colors.textMuted }]}>
                  {option === 'light' ? 'Light' : 'Dark'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Legal & Account</Text>
        <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {user?.provider === 'password' ? (
            <Row icon="key-outline" label="Change Password" onPress={() => navigation.navigate('ChangePassword')} />
          ) : null}
          {LEGAL_LINKS.map((link) => (
            <Row
              key={link.doc}
              icon={link.icon}
              label={link.label}
              onPress={() => navigation.navigate('Legal', { doc: link.doc })}
            />
          ))}
          <Row icon="trash-outline" label="Delete Account" destructive last onPress={() => navigation.navigate('DeleteAccount')} />
        </View>

        <Button
          label="Contact Support"
          icon="logo-whatsapp"
          variant="outline"
          onPress={() => openWhatsApp('Hi LoveNest, I need some help with my account.')}
        />

        <Pressable onPress={signOut} hitSlop={8} style={styles.logout}>
          <Icon name="log-out-outline" size={18} color={primary} />
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

type RowProps = { icon: string; label: string; onPress: () => void; destructive?: boolean; last?: boolean };

const Row = ({ icon, label, onPress, destructive, last }: RowProps) => {
  const { colors } = useTheme();
  const tint = destructive ? primary : colors.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }, pressed && { opacity: 0.6 }]}
    >
      <Icon name={icon} size={18} color={primary} />
      <Text style={[styles.rowLabel, { color: tint }]}>{label}</Text>
      <Icon name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  title: { fontSize: font.size.xl, fontFamily: font.sansBold, marginTop: spacing.sm, marginBottom: spacing.lg },
  card: { borderRadius: radii.md, borderWidth: 1, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.xl },
  avatar: { width: 60, height: 60, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  guest: { fontSize: font.size.lg, fontFamily: font.sansBold },
  hint: { fontSize: font.size.xs, fontFamily: font.sans, textAlign: 'center', marginTop: spacing.xs },
  sectionTitle: { fontSize: font.size.xs, fontFamily: font.sansSemi, marginBottom: spacing.sm },
  toggleRow: { flexDirection: 'row', borderRadius: radii.pill, borderWidth: 1, padding: 4, marginBottom: spacing.xl },
  toggleOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: 10, borderRadius: radii.pill },
  toggleLabel: { fontSize: font.size.sm, fontFamily: font.sansSemi },
  list: { borderRadius: radii.md, borderWidth: 1, marginBottom: spacing.xl, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 14 },
  rowLabel: { flex: 1, fontSize: font.size.sm, fontFamily: font.sansMedium },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, alignSelf: 'center', marginTop: spacing.lg, paddingVertical: spacing.sm },
  logoutText: { color: primary, fontSize: font.size.md, fontFamily: font.sansBold },
});
