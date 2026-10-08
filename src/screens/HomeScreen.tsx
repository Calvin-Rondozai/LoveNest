import { useState } from 'react';
import { View, Text, Image, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { SearchBar } from '../components/SearchBar';
import { CategoryTile } from '../components/CategoryTile';
import { useCatalog } from '../store/catalog';
import { useUnreadCount } from '../store/notifications';
import { useToast } from '../store/toast';
import { openWhatsApp, WHATSAPP_DISPLAY } from '../utils/whatsapp';
import { useTheme } from '../context/ThemeContext';
import { font, spacing, radii, primary, onPrimary, whatsappGreen } from '../theme';
import { RootStackParamList } from '../navigation/types';

const badges = [
  { icon: 'car-outline', label: 'Fast & Reliable\nDelivery' },
  { icon: 'shield-checkmark-outline', label: 'Secure\nPayments' },
  { icon: 'heart-outline', label: 'Quality\nProducts' },
  { icon: 'headset-outline', label: 'Friendly\nSupport' },
];

export const HomeScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const unread = useUnreadCount();
  const categories = useCatalog((s) => s.categories);
  const showToast = useToast((s) => s.show);

  const contactOnWhatsApp = async () => {
    if (!(await openWhatsApp())) showToast(`Couldn't open WhatsApp. Message us on ${WHATSAPP_DISPLAY}`, 4000);
  };

  const openMarket = (params: { categoryId?: string; query?: string } = {}) =>
    navigation.navigate('Tabs', { screen: 'Categories', params: { categoryId: 'all', query: '', ...params, ts: Date.now() } });

  const search = () => {
    if (!query.trim()) return;
    openMarket({ query: query.trim() });
    setQuery('');
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image source={require('../../assets/logo.png')} style={styles.brandMark} resizeMode="contain" />
            <View>
              <Text style={[styles.brandName, { color: colors.text }]}>
                Love<Text style={{ color: primary }}>Nest</Text>
              </Text>
              <Text style={[styles.brandScript, { color: colors.text }]}>Gifts</Text>
            </View>
          </View>
          <Pressable
            onPress={() => navigation.navigate('Notifications')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}
            style={[styles.bell, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Icon name="notifications-outline" color={colors.text} />
            {unread > 0 && (
              <View style={[styles.bellBadge, { borderColor: colors.bg }]}>
                <Text style={styles.bellBadgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            )}
          </Pressable>
        </View>
        <Text style={[styles.tagline, { color: colors.textMuted }]}>Gifts for Every Moment</Text>

        <View style={styles.searchWrap}>
          <SearchBar value={query} onChangeText={setQuery} onSubmit={search} />
        </View>

        <View style={styles.hero}>
          <Image source={require('../../assets/hero-gift.png')} resizeMode="cover" style={styles.heroImage} />
          <View style={styles.heroOverlay}>
            <Text style={[styles.heroTitle, styles.heroTextShadow]}>Make Every</Text>
            <Text style={[styles.heroScript, styles.heroTextShadow]}>Moment Special</Text>
            <Text style={[styles.heroSubtitle, styles.heroTextShadow]}>Thoughtful gifts for your loved ones, delivered with love.</Text>
            <Button label="Shop Now" onPress={() => openMarket()} style={styles.heroButton} />
          </View>
        </View>

        <View style={styles.categoryRow}>
          {categories.map((c) => (
            <CategoryTile
              key={c.id}
              category={c}
              style={styles.categoryItem}
              onPress={() => openMarket({ categoryId: c.id })}
            />
          ))}
        </View>

        <View style={styles.badgeGrid}>
          {badges.map((b) => (
            <View key={b.label} style={styles.badge}>
              <View style={[styles.badgeIcon, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <Icon name={b.icon} color={primary} size={18} />
              </View>
              <Text style={[styles.badgeLabel, { color: colors.textMuted }]}>{b.label}</Text>
            </View>
          ))}
        </View>

        <Pressable
          onPress={contactOnWhatsApp}
          accessibilityRole="button"
          accessibilityLabel="Chat with LoveNest on WhatsApp"
          style={({ pressed }) => [styles.whatsapp, pressed && styles.whatsappPressed]}
        >
          <View style={styles.whatsappLeft}>
            <View style={styles.whatsappIcon}>
              <Icon name="logo-whatsapp" color={onPrimary} size={20} />
            </View>
            <View style={styles.whatsappTextCol}>
              <Text style={styles.whatsappLabel} numberOfLines={1}>Order Now / Enquiries</Text>
              <Text style={styles.whatsappNumber} numberOfLines={1}>{WHATSAPP_DISPLAY}</Text>
            </View>
          </View>
          <View style={styles.whatsappCta}>
            <Text style={styles.whatsappCtaText}>Chat</Text>
            <Icon name="chevron-forward" color={primary} size={14} />
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandMark: { width: 44, height: 44, borderRadius: radii.md },
  brandName: { fontSize: font.size.lg, fontFamily: font.sansBold },
  brandScript: { fontFamily: font.script, fontSize: font.size.md, marginTop: -4 },
  tagline: { textAlign: 'center', fontFamily: font.sans, fontSize: font.size.sm, marginTop: spacing.xs, marginBottom: spacing.lg },
  searchWrap: { marginBottom: spacing.xl },
  hero: {
    marginHorizontal: spacing.md,
    borderRadius: radii.lg,
    overflow: 'hidden',
    minHeight: 260,
    marginBottom: spacing.xl,
  },
  heroImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  heroOverlay: { backgroundColor: 'rgba(6,3,4,0.62)', padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  heroTextShadow: { textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  heroTitle: { color: onPrimary, fontSize: font.size.xl, fontFamily: font.sansBold },
  heroScript: { fontFamily: font.script, color: primary, fontSize: font.size.xxl, marginBottom: spacing.sm },
  heroSubtitle: { color: 'rgba(255,255,255,0.92)', fontSize: font.size.sm, fontFamily: font.sans, marginBottom: spacing.md, maxWidth: 220 },
  heroButton: { alignSelf: 'flex-start', paddingHorizontal: spacing.lg },
  categoryRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xl,
  },
  categoryItem: { flex: 1, width: undefined },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    rowGap: spacing.md,
    marginBottom: spacing.xl,
  },
  badge: { width: '23%', alignItems: 'center', gap: spacing.xs },
  badgeIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: { fontFamily: font.sans, fontSize: 10, textAlign: 'center' },
  whatsapp: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: primary,
    marginHorizontal: spacing.md,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  whatsappLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  whatsappTextCol: { flexShrink: 1 },
  whatsappIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: whatsappGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappLabel: { color: onPrimary, fontSize: font.size.xs, fontFamily: font.sans },
  whatsappNumber: { color: onPrimary, fontSize: font.size.md, fontFamily: font.sansBold },
  whatsappPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  whatsappCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: onPrimary,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    marginLeft: spacing.sm,
  },
  whatsappCtaText: { color: primary, fontSize: font.size.sm, fontFamily: font.sansBold },
  bell: { width: 42, height: 42, borderRadius: radii.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
    backgroundColor: primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: { color: onPrimary, fontSize: 10, fontFamily: font.sansBold, lineHeight: 12 },
});
