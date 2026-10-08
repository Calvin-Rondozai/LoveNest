import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { useTheme } from '../context/ThemeContext';
import { font, radii, spacing } from '../theme';

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  /** Fired by the keyboard's search key or tapping the magnifier. */
  onSubmit?: () => void;
  placeholder?: string;
};

export const SearchBar = ({ value, onChangeText, onSubmit, placeholder = 'Search for gifts, occasions...' }: Props) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable onPress={onSubmit} hitSlop={8} disabled={!onSubmit}>
        <Icon name="search" size={18} color={colors.textMuted} />
      </Pressable>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        autoCorrect={false}
        maxLength={60}
        style={[styles.input, { color: colors.text }]}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={8}>
          <Icon name="close-circle" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    height: 48,
  },
  input: { flex: 1, fontSize: font.size.sm, fontFamily: font.sans },
});
