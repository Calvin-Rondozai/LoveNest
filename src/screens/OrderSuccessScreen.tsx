import { View, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { font, radii, spacing, primary, onPrimary, palettes } from '../theme';
import { RootStackParamList } from '../navigation/types';

const formatDate = (date: Date) => date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

export const OrderSuccessScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { orderNumber } = useRoute<RouteProp<RootStackParamList, 'OrderSuccess'>>().params;
  const today = new Date();
  const estimated = new Date(today);
  estimated.setDate(estimated.getDate() + 2);

  const goToTab = (screen: 'Orders' | 'Home') =>
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Tabs', params: { screen } }] }));

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.check}>
        <Icon name="checkmark" size={40} color={primary} />
      </View>
      <Text style={styles.title}>Order Placed Successfully!</Text>
      <Text style={styles.subtitle}>Thank you for shopping with LoveNest Gifts.</Text>

      <View style={styles.card}>
        <Row label="Order Number" value={orderNumber} />
        <Row label="Order Date" value={formatDate(today)} />
        <Row label="Estimated Delivery" value={formatDate(estimated)} />
      </View>

      <Button label="Track My Order" variant="inverseOutline" onPress={() => goToTab('Orders')} style={styles.trackButton} />
      <Button label="Continue Shopping" icon="" variant="light" onPress={() => goToTab('Home')} style={styles.shopButton} />
    </SafeAreaView>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: primary, alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  check: { width: 84, height: 84, borderRadius: radii.pill, backgroundColor: onPrimary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  title: { fontSize: font.size.xl, fontFamily: font.sansBold, color: onPrimary, textAlign: 'center' },
  subtitle: { fontSize: font.size.sm, fontFamily: font.sans, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.lg },
  card: { width: '100%', backgroundColor: onPrimary, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.xl },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontSize: font.size.xs, fontFamily: font.sans, color: palettes.light.textMuted },
  rowValue: { fontSize: font.size.sm, fontFamily: font.sansBold, color: palettes.light.text },
  trackButton: { width: '100%', marginBottom: spacing.sm },
  shopButton: { width: '100%' },
});
