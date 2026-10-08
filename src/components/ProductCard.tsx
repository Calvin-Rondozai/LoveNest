import { Pressable, Text, StyleSheet } from 'react-native';
import { ProductImage } from './ProductImage';
import { Product } from '../data/catalog';
import { useTheme } from '../context/ThemeContext';
import { font, radii, spacing, primary } from '../theme';

export const ProductCard = ({ product, onPress }: { product: Product; onPress: () => void }) => {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <ProductImage product={product} iconSize={32} style={styles.image} />
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
        {product.name}
      </Text>
      <Text style={styles.price}>US${product.price.toFixed(2)}</Text>
      {product.inStock === false ? <Text style={[styles.soldOut, { color: colors.textMuted }]}>Sold out</Text> : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    borderWidth: 1,
  },
  image: {
    height: 90,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  name: { fontSize: font.size.sm, fontFamily: font.sansSemi },
  price: { fontSize: font.size.sm, fontFamily: font.sansBold, color: primary, marginTop: 2 },
  soldOut: { fontSize: font.size.xs, fontFamily: font.sansMedium, marginTop: 2 },
});
