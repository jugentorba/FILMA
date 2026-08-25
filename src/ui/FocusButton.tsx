import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { theme } from './theme';

type Props = {
  label: string;
  onPress(): void;
  active?: boolean;
  compact?: boolean;
  style?: ViewStyle;
};

export function FocusButton({ label, onPress, active = false, compact = false, style }: Props) {
  const [focused, setFocused] = useState(false);
  const highlighted = active || focused;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onFocus={() => setFocused(true)}
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
