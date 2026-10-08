import { useState } from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';
import { Icon } from './Icon';
import { Product } from '../data/catalog';
import { useCatalog, productIcon } from '../store/catalog';
import { useTheme } from '../context/ThemeContext';
import { primary } from '../theme';

type Props = { product: Product; iconSize: number; style: ViewStyle };

/** Product photo from the server, or the product/category icon when there is none (or it fails). */
export const ProductImage = ({ product, iconSize, style }: Props) => {
  const { colors } = useTheme();
  const categories = useCatalog((s) => s.categories);
  const [failed, setFailed] = useState(false);
  const icon = productIcon(product, categories);

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surfaceAlt }, style]}>
      {product.image && !failed ? (
        <Image
          source={{ uri: product.image }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFailed(true)}
          accessibilityLabel={product.name}
        />
      ) : (
        <Icon name={icon.name} iconSet={icon.set} size={iconSize} color={primary} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
