import React, { useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MediaItem, WatchProgress } from '../types';
import { theme } from './theme';

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
  const ratio = progress?.durationSeconds
    ? Math.min(1, Math.max(0, progress.positionSeconds / progress.durationSeconds))
    : 0;
  const showPoster = Boolean(item.poster && !posterFailed);
  const mediaType = item.source?.kind === 'stremio'
    ? item.source.mediaType === 'series' ? 'SERIES' : 'MOVIE'
    : undefined;
  const meta = [item.year, item.genres?.[0]].filter(Boolean).join('  •  ') || item.subtitle || 'FILMA';

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
        Platform.isTV && focused && styles.focused,
        !Platform.isTV && pressed && styles.pressed,
      ]}
    >
      <View style={[styles.art, Platform.isTV && focused && styles.artFocused]}>
        {showPoster ? (
          <Image
            source={{ uri: item.poster }}
            resizeMode="cover"
            style={styles.poster}
            onError={() => setPosterFailed(true)}
          />
        ) : (
          <View style={styles.fallback}>
            <Text style={styles.monogram}>{item.title.slice(0, 2).toUpperCase()}</Text>
          </View>
        )}

        <View style={styles.topBadges}>
          {mediaType ? (
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>{mediaType}</Text>
            </View>
          ) : <View />}
          {favorite ? (
            <View style={styles.favoriteBadge}>
              <Text style={styles.favorite}>♥</Text>
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

      <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
      <Text numberOfLines={1} style={styles.meta}>{meta}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: Platform.isTV ? 202 : 148,
    marginRight: Platform.isTV ? 24 : 13,
    paddingBottom: 10,
  },
  focused: {
    transform: [{ scale: 1.055 }],
    zIndex: 3,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  art: {
    width: '100%',
    height: Platform.isTV ? 294 : 220,
    borderRadius: Platform.isTV ? 18 : 15,
    backgroundColor: theme.surfaceRaised,
    borderWidth: Platform.isTV ? 1 : 0,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  artFocused: {
    borderColor: '#ffffff',
    borderWidth: 4,
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
    fontSize: Platform.isTV ? 52 : 38,
    fontWeight: '900',
    letterSpacing: -2,
    opacity: 0.85,
  },
  topBadges: {
    position: 'absolute',
    top: 9,
    left: 9,
    right: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: 'rgba(5,8,14,0.76)',
  },
  typeText: {
    color: '#e9edf5',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  favoriteBadge: {
    width: Platform.isTV ? 34 : 29,
    height: Platform.isTV ? 34 : 29,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,8,14,0.78)',
  },
  favorite: {
    color: theme.accent,
    fontSize: Platform.isTV ? 20 : 17,
  },
  progressArea: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
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
    fontSize: Platform.isTV ? 18 : 14,
    lineHeight: Platform.isTV ? 22 : 18,
    marginTop: 10,
    minHeight: Platform.isTV ? 44 : 36,
  },
  meta: {
    color: theme.muted,
    fontSize: Platform.isTV ? 13 : 11,
    marginTop: 3,
    fontWeight: '600',
  },
});
