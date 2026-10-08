import { useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { OrderProgressBar, statusColor } from '../components/OrderProgress';
import { useOrders } from '../store/orders';
import { STATUS_INFO } from '../data/orderStatus';
import { useTheme } from '../context/ThemeContext';
import { font, radii, spacing, primary } from '../theme';
import { RootStackParamList } from '../navigation/types';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

export const OrdersScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const orders = useOrders((s) => s.orders);
  const refresh = useOrders((s) => s.refresh);
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <Text style={[styles.title, { color: colors.text }]}>My Orders</Text>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.orderNumber}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} colors={[primary]} />}
        renderItem={({ item }) => {
          const info = STATUS_INFO[item.status];
          const tint = statusColor(item.status, colors.textMuted);
          const firstItem = item.items[0];
          const summary = firstItem
            ? `${firstItem.name}${item.items.length > 1 ? ` + ${item.items.length - 1} more` : ''}`
            : '';
          return (
            <Pressable
              onPress={() => navigation.navigate('OrderDetail', { orderNumber: item.orderNumber })}
              style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Order ${item.orderNumber}, ${info.label}`}
            >
              <View style={styles.row}>
                <Text style={[styles.orderNumber, { color: colors.text }]}>{item.orderNumber}</Text>
                <View style={styles.status}>
                  <Icon name={info.icon} size={15} color={tint} />
                  <Text style={[styles.statusText, { color: tint }]}>{info.label}</Text>
                </View>
              </View>
              {summary ? (
                <Text style={[styles.summary, { color: colors.text }]} numberOfLines={1}>
                  {summary}
                </Text>
              ) : null}
              <OrderProgressBar status={item.status} />
              <View style={[styles.row, styles.footer]}>
                <Text style={[styles.date, { color: colors.textMuted }]}>{formatDate(item.placedAt)}</Text>
                <View style={styles.status}>
                  <Text style={styles.total}>US${item.total.toFixed(2)}</Text>
                  <Icon name="chevron-forward" size={16} color={colors.textMuted} />
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="receipt-outline" size={40} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No orders yet</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>Your orders and their delivery progress will show here.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: { fontSize: font.size.xl, fontFamily: font.sansBold, paddingHorizontal: spacing.md, marginTop: spacing.sm, marginBottom: spacing.lg },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.md, flexGrow: 1 },
  card: { borderRadius: radii.md, borderWidth: 1, padding: spacing.md },
  pressed: { opacity: 0.7 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumber: { fontSize: font.size.sm, fontFamily: font.sansBold },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusText: { fontSize: font.size.xs, fontFamily: font.sansBold },
  summary: { fontSize: font.size.sm, fontFamily: font.sans, marginTop: spacing.xs },
  footer: { marginTop: spacing.sm },
  date: { fontSize: font.size.xs, fontFamily: font.sans },
  total: { fontSize: font.size.sm, fontFamily: font.sansBold, color: primary },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingBottom: spacing.xxl },
  emptyTitle: { fontSize: font.size.md, fontFamily: font.sansBold, marginTop: spacing.sm },
  emptyText: { fontSize: font.size.sm, fontFamily: font.sans, textAlign: 'center', paddingHorizontal: spacing.xl },
});
