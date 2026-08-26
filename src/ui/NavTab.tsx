import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { theme } from './theme';
import { useResponsiveLayout } from './useResponsiveLayout';

export type NavIconName = 'home' | 'search' | 'library' | 'profile' | 'movies' | 'live' | 'youtube' | 'settings';

type Props = {
  label: string;
  icon: NavIconName;
  active?: boolean;
  onPress(): void;
};

function NavIcon({ name, color, size }: { name: NavIconName; color: string; size: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24' } as const;

  if (name === 'home') {
    return (
      <Svg {...common} fill="none">
        <Path d="M3.5 10.4 12 3l8.5 7.4v9.1a1.5 1.5 0 0 1-1.5 1.5h-4.8v-6.2H9.8V21H5a1.5 1.5 0 0 1-1.5-1.5v-9.1Z" fill={color} />
      </Svg>
    );
  }

  if (name === 'search') {
    return (
      <Svg {...common} fill="none">
        <Circle cx="10.8" cy="10.8" r="6.2" stroke={color} strokeWidth="2.4" />
        <Path d="m15.4 15.4 5 5" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      </Svg>
    );
  }

  if (name === 'library') {
    return (
      <Svg {...common} fill="none">
        <Rect x="4.4" y="7.2" width="15.2" height="13" rx="2.8" fill={color} />
        <Path d="M7 4.6h10M8.6 2.8h6.8" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </Svg>
    );
  }

  if (name === 'profile') {
    return (
      <Svg {...common} fill="none">
        <Circle cx="12" cy="8" r="4" fill={color} />
        <Path d="M4.7 20c.7-4.1 3.1-6.2 7.3-6.2s6.6 2.1 7.3 6.2" fill={color} />
      </Svg>
    );
  }

  if (name === 'movies') {
    return (
      <Svg {...common} fill="none">
        <Rect x="3" y="5" width="18" height="14" rx="2.4" stroke={color} strokeWidth="1.9" />
        <Path d="M7 5v14M17 5v14M3 9h4M17 9h4M3 15h4M17 15h4" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      </Svg>
    );
  }

  if (name === 'live') {
    return (
      <Svg {...common} fill="none">
        <Rect x="3" y="5" width="18" height="14" rx="3" stroke={color} strokeWidth="1.9" />
        <Path d="M8 3l4 2 4-2" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="16.8" cy="12" r="1.5" fill={color} />
        <Path d="M7.2 9.2v5.6M10.1 9.2v5.6" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      </Svg>
    );
  }

  if (name === 'youtube') {
    return (
      <Svg {...common} fill="none">
        <Path d="M21 8.2c-.2-1.5-1.2-2.6-2.7-2.8C16.5 5.1 14.4 5 12 5s-4.5.1-6.3.4C4.2 5.6 3.2 6.7 3 8.2A25 25 0 003 12a25 25 0 00.4 3.8c.2 1.5 1.2 2.6 2.7 2.8 1.8.3 3.9.4 6.3.4s4.5-.1 6.3-.4c1.5-.2 2.5-1.3 2.7-2.8A25 25 0 0021 12a25 25 0 00-.4-3.8z" stroke={color} strokeWidth="1.8" />
        <Path d="M10 9l5 3-5 3V9z" fill={color} />
      </Svg>
    );
  }

  return (
    <Svg {...common} fill="none">
      <Circle cx="12" cy="12" r="3.2" stroke={color} strokeWidth="1.8" />
      <Path d="M12 2.8v2.1M12 19.1v2.1M21.2 12h-2.1M4.9 12H2.8M18.5 5.5L17 7M7 17l-1.5 1.5M18.5 18.5L17 17M7 7L5.5 5.5" stroke={color} strokeWidth="1.9" strokeLinecap="round" />
      <Circle cx="12" cy="12" r="7" stroke={color} strokeWidth="1.2" strokeDasharray="1 3" />
    </Svg>
  );
}

export function NavTab({ label, icon, active = false, onPress }: Props) {
  const [focused, setFocused] = useState(false);
  const layout = useResponsiveLayout();
  const iconColor = active || focused ? '#ffffff' : '#b1b5bc';
  const iconSize = Math.max(20, layout.iconSize + 3);

  const rootStyle = useMemo(() => ({
    minHeight: layout.isCompactPhone ? 58 : layout.isTablet ? 70 : 64,
    borderRadius: layout.isCompactPhone ? 24 : 28,
  }), [layout.isCompactPhone, layout.isTablet]);

  const labelStyle = useMemo(() => ({
    fontSize: layout.isCompactPhone ? 10 : layout.isTablet ? 13 : 11,
  }), [layout.isCompactPhone, layout.isTablet]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      focusable
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={[styles.root, rootStyle, active && styles.active, focused && styles.focused]}
    >
      <View style={styles.iconWrap}>
        <NavIcon name={icon} color={iconColor} size={iconSize} />
      </View>
      <Text numberOfLines={1} style={[styles.label, labelStyle, active && styles.labelActive, focused && styles.labelFocused]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  active: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  focused: {
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  iconWrap: {
    minHeight: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#b1b5bc',
    fontWeight: '700',
  },
  labelActive: {
    color: '#ffffff',
    fontWeight: '900',
  },
  labelFocused: {
    color: '#ffffff',
  },
});
