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
  const [posterFailed, setPosterFailed] = useState(false);
  const ratio = progress?.durationSeconds
    ? Math.min(1, Math.max(0, progress.positionSeconds / progress.durationSeconds))
    : 0;
  const showPoster = Boolean(item.poster && !posterFailed);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.title}
      accessibilityHint={progress?.positionSeconds ? 'Continue watching' : 'Open title'}
      accessibilityState={{ selected: focused }}
      hasTVPreferredFocus={Platform.isTV && preferredFocus}
      onPress={onPress}
      onFocus={() => {
        setFocused(true);
        onFocus?.();
      }}
      onBlur={() => setFocused(false)}
      style={[styles.card, Platform.isTV && focused && styles.focused]}
    >
      <View style={[styles.art, focused && styles.artFocused]}>
        {showPoster ? (
          <Image
            source={{ uri: item.poster }}
            resizeMode="cover"
            style={styles.poster}
            onError={() => setPosterFailed(true)}
          />
        ) : (
          <Text style={styles.monogram}>{item.title.slice(0, 1).toUpperCase()}</Text>
        )}
        {favorite ? <Text style={styles.favorite}>♥</Text> : null}
        {ratio > 0 ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(ratio * 100)}%` }]} />
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={styles.title}>{item.title}</Text>
      <Text numberOfLines={1} style={styles.meta}>
        {[item.year, item.genres?.slice(0, 2).join(' • ')].filter(Boolean).join('  ') || item.subtitle || 'FILMA'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: Platform.isTV ? 190 : 154,
    marginRight: Platform.isTV ? 24 : 14,
    paddingBottom: 12,
  },
  focused: {
    transform: [{ scale: 1.06 }],
  },
  art: {
    width: '100%',
    height: Platform.isTV ? 276 : 224,
    borderRadius: 16,
    backgroundColor: theme.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  artFocused: {
    borderColor: theme.accent,
    borderWidth: 4,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  monogram: {
    color: theme.text,
    fontSize: Platform.isTV ? 58 : 48,
    fontWeight: '900',
    opacity: 0.9,
  },
  favorite: {
    position: 'absolute',
    top: 10,
    right: 12,
    color: theme.accent,
    fontSize: 24,
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 5,
    backgroundColor: '#30384d',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.accent,
  },
  title: {
    color: theme.text,
    fontWeight: '700',
    fontSize: Platform.isTV ? 18 : 15,
    marginTop: 10,
  },
  meta: {
    color: theme.muted,
    fontSize: Platform.isTV ? 14 : 12,
    marginTop: 3,
  },
});
