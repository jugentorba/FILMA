import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { theme } from './theme';
import { useResponsiveLayout } from './useResponsiveLayout';

type Props = {
  label: string;
  onPress(): void;
  onFocus?(): void;
  onBlur?(): void;
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
  onBlur,
  active = false,
  compact = false,
  preferredFocus = false,
  accessibilityHint,
  style,
}: Props) {
  const [focused, setFocused] = useState(false);
  const highlighted = active || focused;
  const layout = useResponsiveLayout();

  const responsiveStyle = useMemo<ViewStyle>(() => {
    const baseHeight = layout.isTv ? 44 : layout.isCompactPhone ? 38 : layout.isTablet ? 44 : 40;
    const compactHeight = layout.isTv ? 38 : layout.isCompactPhone ? 32 : 35;
    return {
      minHeight: compact ? compactHeight : baseHeight,
      paddingHorizontal: Math.round((compact ? 11 : 14) * layout.controlScale),
      paddingVertical: Math.round((compact ? 7 : 9) * layout.controlScale),
      borderRadius: layout.isTv ? 11 : 10,
    };
  }, [compact, layout.controlScale, layout.isCompactPhone, layout.isTablet, layout.isTv]);

  const textStyle = useMemo(() => ({
    fontSize: layout.isTv ? 15 : layout.isCompactPhone ? 12 : layout.isTablet ? 15 : 13,
  }), [layout.isCompactPhone, layout.isTablet, layout.isTv]);

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
      onBlur={() => {
        setFocused(false);
        onBlur?.();
      }}
      style={[
        styles.base,
        responsiveStyle,
        highlighted && styles.highlighted,
        Platform.isTV && focused && styles.tvFocused,
        style,
      ]}
    >
      <Text style={[styles.text, textStyle, highlighted && styles.textHighlighted]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlighted: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  tvFocused: {
    transform: [{ scale: 1.045 }],
    borderWidth: 2,
  },
  text: {
    color: theme.text,
    fontWeight: '700',
  },
  textHighlighted: {
    color: '#ffffff',
  },
});
