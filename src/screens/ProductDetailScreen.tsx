import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { QuantityControl } from '../components/QuantityControl';
import { ProductImage } from '../components/ProductImage';
import { useCatalog, useProduct } from '../store/catalog';
import { useCart } from '../store/cart';
import { useToast } from '../store/toast';
import { useTheme } from '../context/ThemeContext';
import { font, radii, spacing, primary } from '../theme';
import { RootStackParamList } from '../navigation/types';

export const ProductDetailScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ProductDetail'>>();
  const { colors } = useTheme();
  const product = useProduct(route.params.productId);
  const synced = useCatalog((s) => s.synced);
  const [quantity, setQuantity] = useState(1);
  const add = useCart((s) => s.add);
  const showToast = useToast((s) => s.show);

  if (!product) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back} hitSlop={12}>
          <Icon name="arrow-back" color={colors.text} />
        </Pressable>
        <View style={styles.missing}>
          <Icon name="alert-circle-outline" size={36} color={colors.textMuted} />
          <Text style={[styles.description, { color: colors.textMuted }]}>This product is no longer available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const maxQty = Math.min(20, product.stock ?? 20);
  const soldOut = product.inStock === false;
  // Bundled offline items are only placeholders until the live catalog loads.
  const canBuy = synced && !soldOut;
  const addToCart = () => add(product.id, Math.min(quantity, maxQty));

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <Pressable onPress={() => navigation.goBack()} style={styles.back} hitSlop={12}>
        <Icon name="arrow-back" color={colors.text} />
      </Pressable>
      <ProductImage product={product} iconSize={72} style={styles.image} />
      <View style={styles.body}>
        <Text style={[styles.name, { color: colors.text }]}>{product.name}</Text>
        <Text style={styles.price}>US${product.price.toFixed(2)}</Text>
        <Text style={[styles.description, { color: colors.textMuted }]}>{product.description}</Text>

        <View style={styles.qtyRow}>
          <Text style={[styles.qtyLabel, { color: colors.text }]}>Quantity</Text>
          <QuantityControl
            quantity={quantity}
            onIncrement={() => setQuantity((q) => Math.min(maxQty, q + 1))}
            onDecrement={() => setQuantity((q) => Math.max(1, q - 1))}
          />
        </View>

        {!canBuy ? (
          <Text style={[styles.unavailable, { color: colors.textMuted }]}>
            {soldOut ? 'Sold out for now. Check back soon.' : 'Connect to the internet to shop. Products are loading.'}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Button
            disabled={!canBuy}
            label="Add to Cart"
            icon="cart-outline"
            variant="outline"
            onPress={() => {
              addToCart();
              showToast(`Added ${product.name} to cart`);
            }}
            style={styles.actionBtn}
          />
          <Button
            disabled={!canBuy}
            label="Buy Now"
            onPress={() => {
              addToCart();
              navigation.navigate('Cart');
            }}
            style={styles.actionBtn}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  back: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  image: {
    height: 240,
    marginHorizontal: spacing.md,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  body: { paddingHorizontal: spacing.md },
  name: { fontSize: font.size.xl, fontFamily: font.sansBold },
  price: { fontSize: font.size.lg, fontFamily: font.sansBold, color: primary, marginTop: spacing.xs, marginBottom: spacing.md },
  description: { fontSize: font.size.sm, fontFamily: font.sans, lineHeight: 20, marginBottom: spacing.lg },
  qtyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  qtyLabel: { fontSize: font.size.md, fontFamily: font.sansSemi },
  actions: { flexDirection: 'row', gap: spacing.md },
  unavailable: { fontSize: font.size.sm, fontFamily: font.sansMedium, marginBottom: spacing.md },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  actionBtn: { flex: 1 },
});
