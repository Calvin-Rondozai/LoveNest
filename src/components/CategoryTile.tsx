import { Pressable, Text, View, StyleSheet, ViewStyle } from 'react-native';
import { Icon } from './Icon';
import { Category } from '../data/catalog';
import { useTheme } from '../context/ThemeContext';
import { font, radii, spacing, primary } from '../theme';

type Props = { category: Category; selected?: boolean; onPress: () => void; style?: ViewStyle };

export const CategoryTile = ({ category, selected, onPress, style }: Props) => {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.wrap, style]}>
      <View
        style={[
          styles.iconBox,
          { backgroundColor: colors.surfaceAlt, borderColor: selected ? primary : 'transparent' },
        ]}
      >
        <Icon name={category.icon} iconSet={category.iconSet} size={20} color={primary} />
      </View>
      <Text style={[styles.label, { color: selected ? primary : colors.textMuted }]}>{category.name}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.xs },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: font.size.xs, fontFamily: font.sansMedium, textAlign: 'center' },
});
