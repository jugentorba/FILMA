import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MediaItem, WatchProgress } from '../types';
import { theme } from './theme';

type Props = {
  item: MediaItem;
  progress?: WatchProgress;
  favorite?: boolean;
  onPress(): void;
};

export function MediaCard({ item, progress, favorite = false, onPress }: Props) {
  const [focused, setFocused] = useState(false);
  const ratio = progress?.durationSeconds
    ? Math.min(1, Math.max(0, progress.positionSeconds / progress.durationSeconds))
    : 0;

  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.card, Platform.isTV && focused && styles.focused]}
    >
      <View style={[styles.art, focused && styles.artFocused]}>
        <Text style={styles.monogram}>{item.title.slice(0, 1).toUpperCase()}</Text>
        {favorite ? <Text style={styles.favorite}>♥</Text> : null}
        {ratio > 0 ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(ratio * 100)}%` }]} />
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={styles.title}>{item.title}</Text>
      <Text numberOfLines={1} style={styles.meta}>
        {[item.year, item.genres?.slice(0, 2).join(' • ')].filter(Boolean).join('  ')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: Platform.isTV ? 250 : 154,
    marginRight: Platform.isTV ? 24 : 14,
    paddingBottom: 10,
  },
  focused: {
    transform: [{ scale: 1.06 }],
  },
  art: {
    height: Platform.isTV ? 142 : 218,
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
    borderWidth: 3,
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
    fontSize: 22,
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
