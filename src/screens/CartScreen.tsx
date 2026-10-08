import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckoutHeader } from '../components/CheckoutHeader';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { QuantityControl } from '../components/QuantityControl';
import { PriceRow } from '../components/PriceRow';
import { ProductImage } from '../components/ProductImage';
import { useCatalog } from '../store/catalog';
import { useCart, cartSubtotal } from '../store/cart';
import { useTheme } from '../context/ThemeContext';
import { font, radii, spacing, primary } from '../theme';
import { RootStackParamList } from '../navigation/types';

export const CartScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const { items, increment, decrement, remove } = useCart();
  const products = useCatalog((s) => s.products);
  const subtotal = cartSubtotal(items, products);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <CheckoutHeader title="Checkout" step={1} />
      <Text style={[styles.cartTitle, { color: colors.text }]}>Your Cart ({items.length} items)</Text>
      <FlatList
        data={items}
        keyExtractor={(i) => i.productId}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const product = products.find((p) => p.id === item.productId);
          if (!product) return null;
          return (
            <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ProductImage product={product} iconSize={26} style={styles.thumb} />
              <View style={styles.info}>
                <Text style={[styles.name, { color: colors.text }]}>{product.name}</Text>
                <Text style={styles.price}>US${product.price.toFixed(2)}</Text>
                <QuantityControl
                  quantity={item.quantity}
                  onIncrement={() => increment(item.productId)}
                  onDecrement={() => decrement(item.productId)}
                />
              </View>
              <Pressable onPress={() => remove(item.productId)} hitSlop={10}>
                <Icon name="trash-outline" color={colors.textMuted} size={20} />
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={[styles.empty, { color: colors.textMuted }]}>Your cart is empty.</Text>}
      />
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <PriceRow label="Subtotal" value={`US$${subtotal.toFixed(2)}`} />
        <Button label="Continue to Delivery" disabled={items.length === 0} onPress={() => navigation.navigate('Delivery')} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  cartTitle: { fontSize: font.size.lg, fontFamily: font.sansBold, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  list: { paddingHorizontal: spacing.md, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radii.md, padding: spacing.sm, borderWidth: 1 },
  thumb: { width: 56, height: 56, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 4 },
  name: { fontSize: font.size.sm, fontFamily: font.sansBold },
  price: { fontSize: font.size.sm, color: primary, fontFamily: font.sansSemi },
  empty: { textAlign: 'center', marginTop: spacing.xl },
  footer: { padding: spacing.md, borderTopWidth: 1 },
});
