import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { useTheme } from '../context/ThemeContext';
import { font, radii, primary } from '../theme';

type Props = { quantity: number; onIncrement: () => void; onDecrement: () => void };

export const QuantityControl = ({ quantity, onIncrement, onDecrement }: Props) => {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Pressable onPress={onDecrement} style={styles.btn} hitSlop={8}>
        <Icon name="remove" size={16} color={primary} />
      </Pressable>
      <Text style={[styles.value, { color: colors.text }]}>{quantity}</Text>
      <Pressable onPress={onIncrement} style={styles.btn} hitSlop={8}>
        <Icon name="add" size={16} color={primary} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btn: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { fontSize: font.size.md, fontFamily: font.sansBold, minWidth: 18, textAlign: 'center' },
});
