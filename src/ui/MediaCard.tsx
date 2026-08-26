import React, { useMemo, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MediaItem, WatchProgress } from '../types';
import { theme } from './theme';
import { useResponsiveLayout } from './useResponsiveLayout';

type Props = {
  item: MediaItem;
  progress?: WatchProgress;
  favorite?: boolean;
  preferredFocus?: boolean;
  onFocus?(): void;
  onPress(): void;
};

export function MediaCard({ item, progress, favorite = false, preferredFocus = false, onFocus, onPress }: Props) {
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const layout = useResponsiveLayout();
  const ratio = progress?.durationSeconds ? Math.min(1, Math.max(0, progress.positionSeconds / progress.durationSeconds)) : 0;
  const showPoster = Boolean(item.poster && !posterFailed);
  const meta = [item.year, item.genres?.[0]].filter(Boolean).join('  •  ');

  const size = useMemo(() => {
    const width = layout.mediaCardWidth;
    return {
      card: { width, marginRight: layout.isTv ? 17 : layout.isCompactPhone ? 10 : 12 },
      art: { height: Math.round(width * 1.48), borderRadius: layout.isTv ? 18 : 14 },
      title: {
        fontSize: layout.isTv ? 15 : layout.isCompactPhone ? 12 : layout.isTablet ? 14 : 13,
        lineHeight: layout.isTv ? 19 : layout.isCompactPhone ? 15 : 17,
      },
      meta: { fontSize: layout.isTv ? 11 : layout.isCompactPhone ? 9 : 10 },
      heart: { width: layout.isTv ? 31 : 27, height: layout.isTv ? 31 : 27 },
      monogram: { fontSize: layout.isTv ? 43 : layout.isCompactPhone ? 29 : 34 },
    };
  }, [layout.isCompactPhone, layout.isTablet, layout.isTv, layout.mediaCardWidth]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.title}
      accessibilityHint={progress?.positionSeconds ? 'Continue watching' : 'Open title'}
      accessibilityState={{ selected: focused }}
      hasTVPreferredFocus={Platform.isTV && preferredFocus}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onFocus={() => { setFocused(true); onFocus?.(); }}
      onBlur={() => setFocused(false)}
      style={[styles.card, size.card, Platform.isTV && focused && styles.focused, !Platform.isTV && pressed && styles.pressed]}
    >
      <View style={[styles.art, size.art, Platform.isTV && focused && styles.artFocused]}>
        {showPoster ? (
          <Image source={{ uri: item.poster }} resizeMode="cover" style={styles.poster} onError={() => setPosterFailed(true)} />
        ) : (
          <View style={styles.fallback}><Text style={[styles.monogram, size.monogram]}>{item.title.slice(0, 2).toUpperCase()}</Text></View>
        )}

        {favorite ? <View style={[styles.heart, size.heart]}><Text style={styles.heartText}>♥</Text></View> : null}

        {ratio > 0 ? (
          <View style={styles.progressArea}>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round(ratio * 100)}%` }]} /></View>
          </View>
        ) : null}
      </View>

      <Text numberOfLines={2} style={[styles.title, size.title]}>{item.title}</Text>
      {meta ? <Text numberOfLines={1} style={[styles.meta, size.meta]}>{meta}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { paddingBottom: 8 },
  focused: { transform: [{ scale: 1.045 }], zIndex: 3 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  art: { width: '100%', overflow: 'hidden', backgroundColor: '#141820' },
  artFocused: { borderWidth: 3, borderColor: '#ffffff' },
  poster: { width: '100%', height: '100%' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#151922' },
  monogram: { color: '#c9d0dc', fontWeight: '900', letterSpacing: -2, opacity: 0.68 },
  heart: { position: 'absolute', top: 8, right: 8, borderRadius: 99, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,6,10,0.78)' },
  heartText: { color: theme.accent, fontSize: Platform.isTV ? 16 : 14, fontWeight: '900' },
  progressArea: { position: 'absolute', left: 8, right: 8, bottom: 8, padding: 3, borderRadius: 99, backgroundColor: 'rgba(3,5,9,0.7)' },
  progressTrack: { height: Platform.isTV ? 5 : 4, borderRadius: 99, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.28)' },
  progressFill: { height: '100%', borderRadius: 99, backgroundColor: theme.accent },
  title: { color: '#f5f6f8', fontWeight: '800', marginTop: 8, minHeight: Platform.isTV ? 38 : 30 },
  meta: { color: '#737c8d', marginTop: 1, fontWeight: '600' },
});
