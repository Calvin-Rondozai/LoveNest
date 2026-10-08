import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from './Icon';
import { Stepper } from './Stepper';
import { useTheme } from '../context/ThemeContext';
import { font, spacing, primary } from '../theme';

export const CheckoutHeader = ({ title, step }: { title: string; step: number }) => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { borderBottomColor: colors.border }]}>
      <View style={styles.top}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Icon name="arrow-back" color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Icon name="shield-checkmark-outline" color={primary} />
      </View>
      <Stepper current={step} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: 1, marginBottom: spacing.lg },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  title: { fontSize: font.size.lg, fontFamily: font.sansBold },
});
