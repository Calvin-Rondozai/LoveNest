import { useEffect } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { useNotifications, AppNotification } from '../store/notifications';
import { useTheme } from '../context/ThemeContext';
import { font, radii, spacing, primary } from '../theme';
import { RootStackParamList } from '../navigation/types';

const timeAgo = (iso: string) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
};

export const NotificationsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const items = useNotifications((s) => s.items);
  const markRead = useNotifications((s) => s.markRead);
  const markAllRead = useNotifications((s) => s.markAllRead);
  const remove = useNotifications((s) => s.remove);
  const clearAll = useNotifications((s) => s.clearAll);
  const hasUnread = items.some((n) => !n.read);

  // Leaving the screen counts as having seen everything, so the bell badge clears.
  useEffect(() => navigation.addListener('beforeRemove', () => markAllRead()), [navigation, markAllRead]);

  const open = (n: AppNotification) => {
    markRead(n.id);
    if (n.target === 'orders') navigation.navigate('Tabs', { screen: 'Orders' });
    if (n.target === 'market') navigation.navigate('Tabs', { screen: 'Categories', params: { categoryId: 'all', query: '', ts: Date.now() } });
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Icon name="arrow-back" color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
        {items.length ? (
          <Pressable onPress={hasUnread ? markAllRead : clearAll} hitSlop={8}>
            <Text style={styles.action}>{hasUnread ? 'Mark all read' : 'Clear all'}</Text>
          </Pressable>
        ) : (
          <View style={styles.actionSpacer} />
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => open(item)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: item.read ? colors.surface : colors.surfaceAlt, borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Icon name={item.icon} size={20} color={primary} />
            </View>
            <View style={styles.textCol}>
              <View style={styles.titleRow}>
                <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                {!item.read && <View style={styles.unreadDot} />}
              </View>
              <Text style={[styles.body, { color: colors.textMuted }]}>{item.body}</Text>
              <Text style={[styles.time, { color: colors.textMuted }]}>{timeAgo(item.createdAt)}</Text>
            </View>
            <Pressable onPress={() => remove(item.id)} hitSlop={10}>
              <Icon name="close" size={16} color={colors.textMuted} />
            </Pressable>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceAlt }]}>
              <Icon name="notifications-off-outline" size={30} color={primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No notifications yet</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>Order updates and offers will show up here.</Text>
          </View>
        }
      />
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
  title: { flex: 1, fontSize: font.size.lg, fontFamily: font.sansBold },
  action: { color: primary, fontSize: font.size.xs, fontFamily: font.sansSemi },
  actionSpacer: { width: 1 },
  list: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, borderWidth: 1, borderRadius: radii.md, padding: spacing.md },
  iconWrap: { width: 40, height: 40, borderRadius: radii.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  textCol: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  itemTitle: { flexShrink: 1, fontSize: font.size.sm, fontFamily: font.sansBold },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: primary },
  body: { fontSize: font.size.xs, fontFamily: font.sans, lineHeight: 18, marginTop: 2 },
  time: { fontSize: 11, fontFamily: font.sansMedium, marginTop: spacing.xs },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingBottom: spacing.xxl },
  emptyIcon: { width: 64, height: 64, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  emptyTitle: { fontSize: font.size.md, fontFamily: font.sansBold },
  emptyText: { fontSize: font.size.sm, fontFamily: font.sans },
});
