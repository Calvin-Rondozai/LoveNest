import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { LEGAL_DOCUMENTS, EFFECTIVE_DATE } from '../../legal/content';
import { useTheme } from '../../context/ThemeContext';
import { font, radii, spacing, primary } from '../../theme';
import { RootStackParamList } from '../../navigation/types';

export const LegalScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { doc } = useRoute<RouteProp<RootStackParamList, 'Legal'>>().params;
  const document = LEGAL_DOCUMENTS[doc];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Icon name="arrow-back" color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {document.title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.intro, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <Icon name="document-text-outline" color={primary} size={20} />
          <View style={styles.introText}>
            <Text style={[styles.summary, { color: colors.text }]}>{document.summary}</Text>
            <Text style={[styles.effective, { color: colors.textMuted }]}>Effective {EFFECTIVE_DATE}</Text>
          </View>
        </View>

        {document.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={[styles.heading, { color: colors.text }]}>{section.heading}</Text>
            {section.paragraphs?.map((p) => (
              <Text key={p} style={[styles.paragraph, { color: colors.textMuted }]}>
                {p}
              </Text>
            ))}
            {section.bullets?.map((b) => (
              <View key={b} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={[styles.paragraph, styles.bulletText, { color: colors.textMuted }]}>{b}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: font.size.lg, fontFamily: font.sansBold },
  headerSpacer: { width: 22 },
  body: { padding: spacing.md, paddingBottom: spacing.xxl },
  intro: { flexDirection: 'row', gap: spacing.sm, borderWidth: 1, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.lg },
  introText: { flex: 1 },
  summary: { fontSize: font.size.sm, fontFamily: font.sansMedium },
  effective: { fontSize: font.size.xs, fontFamily: font.sans, marginTop: 2 },
  section: { marginBottom: spacing.lg },
  heading: { fontSize: font.size.md, fontFamily: font.sansBold, marginBottom: spacing.xs },
  paragraph: { fontSize: font.size.sm, fontFamily: font.sans, lineHeight: 21, marginBottom: spacing.xs },
  bulletRow: { flexDirection: 'row', gap: spacing.sm },
  bulletDot: { width: 5, height: 5, borderRadius: radii.pill, backgroundColor: primary, marginTop: 8 },
  bulletText: { flex: 1 },
});
