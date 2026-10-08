import { View, Text, StyleSheet } from 'react-native';
import { useToast } from '../store/toast';
import { Icon } from './Icon';
import { font, radii, spacing, primary, onPrimary } from '../theme';

export const ToastHost = () => {
  const message = useToast((s) => s.message);
  if (!message) return null;
  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.pill}>
        <Icon name="checkmark-circle" color={onPrimary} size={18} />
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 100, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: primary,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
  },
  text: { color: onPrimary, fontFamily: font.sansSemi, fontSize: font.size.sm },
});
