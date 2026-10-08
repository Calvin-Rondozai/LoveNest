import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOrders } from '../store/orders';
import { useTheme } from '../context/ThemeContext';
import { font, radii, spacing, primary } from '../theme';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

export const OrdersScreen = () => {
  const orders = useOrders((s) => s.orders);
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <Text style={[styles.title, { color: colors.text }]}>My Orders</Text>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.orderNumber}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.row}>
              <Text style={[styles.orderNumber, { color: colors.text }]}>{item.orderNumber}</Text>
              <View style={[styles.badge, { backgroundColor: colors.surfaceAlt }]}>
                <Text style={styles.badgeText}>Confirmed</Text>
              </View>
            </View>
            <Text style={[styles.date, { color: colors.textMuted }]}>{formatDate(item.placedAt)}</Text>
            <Text style={styles.total}>US${item.total.toFixed(2)}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={[styles.empty, { color: colors.textMuted }]}>You haven't placed any orders yet.</Text>}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: { fontSize: font.size.xl, fontFamily: font.sansBold, paddingHorizontal: spacing.md, marginTop: spacing.sm, marginBottom: spacing.lg },
  list: { paddingHorizontal: spacing.md, gap: spacing.md },
  card: { borderRadius: radii.md, borderWidth: 1, padding: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumber: { fontSize: font.size.sm, fontFamily: font.sansBold },
  badge: { borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  badgeText: { fontSize: font.size.xs, fontFamily: font.sansBold, color: primary },
  date: { fontSize: font.size.xs, fontFamily: font.sans, marginTop: spacing.xs },
  total: { fontSize: font.size.sm, fontFamily: font.sansBold, color: primary, marginTop: spacing.xs },
  empty: { textAlign: 'center', marginTop: spacing.xl },
});
