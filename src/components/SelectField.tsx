import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { useTheme } from '../context/ThemeContext';
import { font, radii, spacing, danger, primary } from '../theme';

type Option = { id: string; label: string };

type Props = {
  label: string;
  value: string | null;
  options: readonly Option[];
  placeholder?: string;
  error?: string | null;
  onChange: (id: string) => void;
};

export const SelectField = ({ label, value, options, placeholder = 'Choose an option', error, onChange }: Props) => {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={[
          styles.control,
          {
            borderColor: error ? danger : open ? primary : colors.border,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <Text
          style={[styles.controlText, { color: selected ? colors.text : colors.placeholder }]}
          numberOfLines={2}
        >
          {selected?.label ?? placeholder}
        </Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </Pressable>
      {open ? (
        <View style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {options.map((option, index) => {
            const isSelected = option.id === value;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: isSelected }}
                onPress={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
                style={[
                  styles.item,
                  index < options.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                ]}
              >
                <Text style={[styles.itemText, { color: colors.text, fontFamily: isSelected ? font.sansSemi : font.sans }]}>
                  {option.label}
                </Text>
                {isSelected ? <Icon name="checkmark" size={18} color={primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { fontSize: font.size.xs, fontFamily: font.sansMedium, marginBottom: spacing.xs },
  control: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  controlText: { flex: 1, fontSize: font.size.md },
  menu: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  item: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  itemText: { flex: 1, fontSize: font.size.sm },
  error: { fontSize: font.size.xs, fontFamily: font.sansMedium, color: danger, marginTop: spacing.xs },
});
