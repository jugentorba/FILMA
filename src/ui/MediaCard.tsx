import React, { useMemo, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { FILMA_ARCHIVE_MANIFEST_URL } from '../services/stremio';
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
  const directPlayable = item.source?.kind === 'stremio' && item.source.manifestUrl === FILMA_ARCHIVE_MANIFEST_URL;
  const series = item.source?.kind === 'stremio' && item.source.mediaType === 'series';
  const meta = [item.year, item.genres?.[0]].filter(Boolean).join('  •  ') || item.subtitle || 'FILMA';

  const size = useMemo(() => {
    const width = layout.mediaCardWidth;
    return {
      card: { width, marginRight: layout.isTv ? 16 : layout.isCompactPhone ? 9 : 10 },
      art: { height: Math.round(width * 1.48), borderRadius: layout.isTv ? 14 : 11 },
      title: {
        fontSize: layout.isTv ? 15 : layout.isCompactPhone ? 12 : layout.isTablet ? 14 : 13,
        lineHeight: layout.isTv ? 19 : layout.isCompactPhone ? 15 : 17,
      },
      meta: { fontSize: layout.isTv ? 11 : layout.isCompactPhone ? 9 : 10 },
      heart: { width: layout.isTv ? 29 : 25, height: layout.isTv ? 29 : 25 },
      monogram: { fontSize: layout.isTv ? 43 : layout.isCompactPhone ? 29 : 34 },
    };
  }, [layout.isCompactPhone, layout.isTablet, layout.isTv, layout.mediaCardWidth]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.title}
      accessibilityHint={progress?.positionSeconds ? 'Continue watching' : directPlayable ? 'Play in FILMA' : 'Open title'}
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

        <View style={styles.topRow}>
          {directPlayable ? (
            <View style={styles.freeBadge}><Text style={styles.freeBadgeText}>▶ FREE</Text></View>
          ) : series ? (
            <View style={styles.seriesBadge}><Text style={styles.seriesBadgeText}>SERIES</Text></View>
          ) : <View />}
          {favorite ? <View style={[styles.heart, size.heart]}><Text style={styles.heartText}>♥</Text></View> : null}
        </View>

        {ratio > 0 ? (
          <View style={styles.progressArea}>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round(ratio * 100)}%` }]} /></View>
          </View>
        ) : null}
      </View>

      <Text numberOfLines={1} style={[styles.title, size.title]}>{item.title}</Text>
      <Text numberOfLines={1} style={[styles.meta, size.meta]}>{meta}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { paddingBottom: 7 },
  focused: { transform: [{ scale: 1.045 }], zIndex: 3 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  art: { width: '100%', overflow: 'hidden', backgroundColor: '#151a25', borderWidth: 1, borderColor: '#202735' },
  artFocused: { borderColor: '#f5f7fb', borderWidth: 3 },
  poster: { width: '100%', height: '100%' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#161b27' },
  monogram: { color: '#c9d0dc', fontWeight: '900', letterSpacing: -2, opacity: 0.76 },
  topRow: { position: 'absolute', left: 7, right: 7, top: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  freeBadge: { borderRadius: 7, paddingHorizontal: 6, paddingVertical: 4, backgroundColor: 'rgba(18,67,50,0.94)', borderWidth: 1, borderColor: 'rgba(98,229,168,0.42)' },
  freeBadgeText: { color: '#78eab7', fontSize: 7, fontWeight: '900', letterSpacing: 0.6 },
  seriesBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: 'rgba(6,9,15,0.78)' },
  seriesBadgeText: { color: '#dbe1ea', fontSize: 7, fontWeight: '900', letterSpacing: 0.7 },
  heart: { borderRadius: 99, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5,8,14,0.82)' },
  heartText: { color: theme.accent, fontSize: Platform.isTV ? 16 : 14, fontWeight: '900' },
  progressArea: { position: 'absolute', left: 7, right: 7, bottom: 7, padding: 3, borderRadius: 99, backgroundColor: 'rgba(4,7,12,0.72)' },
  progressTrack: { height: Platform.isTV ? 5 : 4, borderRadius: 99, overflow: 'hidden', backgroundColor: '#4a5060' },
  progressFill: { height: '100%', borderRadius: 99, backgroundColor: theme.accent },
  title: { color: '#f0f3f7', fontWeight: '800', marginTop: 7 },
  meta: { color: '#747f92', marginTop: 1, fontWeight: '600' },
});
