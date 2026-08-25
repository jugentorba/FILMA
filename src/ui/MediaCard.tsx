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
  const ratio = progress?.durationSeconds
    ? Math.min(1, Math.max(0, progress.positionSeconds / progress.durationSeconds))
    : 0;
  const showPoster = Boolean(item.poster && !posterFailed);
  const mediaType = item.source?.kind === 'stremio'
    ? item.source.mediaType === 'series' ? 'SERIES' : 'MOVIE'
    : undefined;
  const meta = [item.year, item.genres?.[0]].filter(Boolean).join('  •  ') || item.subtitle || 'FILMA';

  const cardSize = useMemo(() => {
    const width = layout.mediaCardWidth;
    return {
      card: { width, marginRight: layout.isTv ? 18 : layout.isCompactPhone ? 9 : 11 },
      art: { height: Math.round(width * 1.47), borderRadius: layout.isTv ? 16 : 13 },
      title: {
        fontSize: layout.isTv ? 16 : layout.isCompactPhone ? 12 : layout.isTablet ? 14 : 13,
        lineHeight: layout.isTv ? 20 : layout.isCompactPhone ? 16 : 18,
        minHeight: layout.isTv ? 40 : layout.isCompactPhone ? 32 : 36,
      },
      meta: { fontSize: layout.isTv ? 12 : layout.isCompactPhone ? 10 : 11 },
      favoriteBadge: {
        width: layout.isTv ? 31 : layout.isCompactPhone ? 25 : 27,
        height: layout.isTv ? 31 : layout.isCompactPhone ? 25 : 27,
      },
      favoriteText: { fontSize: layout.isTv ? 18 : layout.isCompactPhone ? 14 : 16 },
      monogram: { fontSize: layout.isTv ? 46 : layout.isCompactPhone ? 31 : 35 },
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
      onFocus={() => {
        setFocused(true);
        onFocus?.();
      }}
      onBlur={() => setFocused(false)}
      style={[
        styles.card,
        cardSize.card,
        Platform.isTV && focused && styles.focused,
        !Platform.isTV && pressed && styles.pressed,
      ]}
    >
      <View style={[styles.art, cardSize.art, Platform.isTV && focused && styles.artFocused]}>
        {showPoster ? (
          <Image
            source={{ uri: item.poster }}
            resizeMode="cover"
            style={styles.poster}
            onError={() => setPosterFailed(true)}
          />
        ) : (
          <View style={styles.fallback}>
            <Text style={[styles.monogram, cardSize.monogram]}>{item.title.slice(0, 2).toUpperCase()}</Text>
          </View>
        )}

        <View style={styles.topBadges}>
          {mediaType ? (
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>{mediaType}</Text>
            </View>
          ) : <View />}
          {favorite ? (
            <View style={[styles.favoriteBadge, cardSize.favoriteBadge]}>
              <Text style={[styles.favorite, cardSize.favoriteText]}>♥</Text>
            </View>
          ) : null}
        </View>

        {ratio > 0 ? (
          <View style={styles.progressArea}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(ratio * 100)}%` }]} />
            </View>
          </View>
        ) : null}
      </View>

      <Text numberOfLines={2} style={[styles.title, cardSize.title]}>{item.title}</Text>
      <Text numberOfLines={1} style={[styles.meta, cardSize.meta]}>{meta}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingBottom: 8,
  },
  focused: {
    transform: [{ scale: 1.045 }],
    zIndex: 3,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  art: {
    width: '100%',
    backgroundColor: theme.surfaceRaised,
    borderWidth: Platform.isTV ? 1 : 0,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  artFocused: {
    borderColor: '#ffffff',
    borderWidth: 3,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171d2b',
  },
  monogram: {
    color: '#dfe5ef',
    fontWeight: '900',
    letterSpacing: -2,
    opacity: 0.85,
  },
  topBadges: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(5,8,14,0.76)',
  },
  typeText: {
    color: '#e9edf5',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  favoriteBadge: {
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,8,14,0.78)',
  },
  favorite: {
    color: theme.accent,
  },
  progressArea: {
    position: 'absolute',
    left: 9,
    right: 9,
    bottom: 9,
    padding: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(4,7,12,0.74)',
  },
  progressTrack: {
    height: Platform.isTV ? 5 : 4,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#4a5060',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: theme.accent,
  },
  title: {
    color: theme.text,
    fontWeight: '800',
    marginTop: 8,
  },
  meta: {
    color: theme.muted,
    marginTop: 2,
    fontWeight: '600',
  },
});
