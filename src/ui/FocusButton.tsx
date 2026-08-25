import React, { useState } from 'react';
import { Platform, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { theme } from './theme';

type Props = {
  label: string;
  onPress(): void;
  onFocus?(): void;
  active?: boolean;
  compact?: boolean;
  preferredFocus?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

export function FocusButton({
  label,
  onPress,
  onFocus,
  active = false,
  compact = false,
  preferredFocus = false,
  accessibilityHint,
  style,
}: Props) {
  const [focused, setFocused] = useState(false);
  const highlighted = active || focused;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected: active }}
      hasTVPreferredFocus={Platform.isTV && preferredFocus}
      onPress={onPress}
      onFocus={() => {
        setFocused(true);
        onFocus?.();
      }}
      onBlur={() => setFocused(false)}
      style={[
        styles.base,
        compact && styles.compact,
        highlighted && styles.highlighted,
        Platform.isTV && focused && styles.tvFocused,
        style,
      ]}
    >
      <Text style={[styles.text, highlighted && styles.textHighlighted]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 46,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    minHeight: 40,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  highlighted: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  tvFocused: {
    transform: [{ scale: 1.08 }],
    borderWidth: 3,
  },
  text: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '700',
  },
  textHighlighted: {
    color: '#ffffff',
  },
});
