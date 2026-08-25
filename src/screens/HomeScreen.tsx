import React, { useMemo } from 'react';
import { FlatList, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { demoMovies } from '../data/demo';
import { useFilma } from '../store/FilmaContext';
import type { MediaItem } from '../types';
import { FocusButton } from '../ui/FocusButton';
import { MediaCard } from '../ui/MediaCard';
import { theme } from '../ui/theme';

type Props = {
  onSelect(item: MediaItem): void;
};

export function HomeScreen({ onSelect }: Props) {
  const { state } = useFilma();
  const continueWatching = useMemo(
    () => demoMovies
      .filter(item => Boolean(state.progress[item.id]?.positionSeconds))
      .sort((a, b) => new Date(state.progress[b.id].updatedAt).getTime() - new Date(state.progress[a.id].updatedAt).getTime()),
    [state.progress],
  );

  const hero = continueWatching[0] ?? demoMovies[0];

  const row = (title: string, data: MediaItem[]) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <FlatList
        horizontal
        data={data}
        keyExtractor={item => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowContent}
        renderItem={({ item }) => (
          <MediaCard
            item={item}
            progress={state.progress[item.id]}
            favorite={Boolean(state.favorites[item.id])}
            onPress={() => onSelect(item)}
          />
        )}
      />
    </View>
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>FILMA ORIGINAL EXPERIENCE</Text>
        <Text style={styles.heroTitle}>{hero.title}</Text>
        <Text style={styles.heroText}>
          Movies open first. Continue on this device or pick up from your saved watch position on another device after sync.
        </Text>
        <View style={styles.heroActions}>
          <FocusButton label={state.progress[hero.id] ? '▶ Continue' : '▶ Play'} active onPress={() => onSelect(hero)} />
        </View>
      </View>

      {continueWatching.length ? row('Continue Watching', continueWatching) : null}
      {row('Featured', demoMovies)}
      {row('Recently Added', [...demoMovies].reverse())}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    paddingBottom: 80,
  },
  hero: {
    minHeight: Platform.isTV ? 390 : 320,
    paddingHorizontal: Platform.isTV ? 64 : 20,
    paddingTop: Platform.isTV ? 86 : 54,
    paddingBottom: 42,
    justifyContent: 'center',
    backgroundColor: '#0d1220',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  eyebrow: {
    color: theme.accent,
    fontWeight: '900',
    letterSpacing: 1.5,
    fontSize: 12,
  },
  heroTitle: {
    color: theme.text,
    fontSize: Platform.isTV ? 52 : 34,
    lineHeight: Platform.isTV ? 58 : 40,
    fontWeight: '900',
    marginTop: 12,
  },
  heroText: {
    maxWidth: 700,
    color: theme.muted,
    fontSize: Platform.isTV ? 19 : 15,
    lineHeight: Platform.isTV ? 28 : 22,
    marginTop: 12,
  },
  heroActions: {
    flexDirection: 'row',
    marginTop: 24,
  },
  section: {
    paddingTop: Platform.isTV ? 34 : 28,
  },
  sectionTitle: {
    color: theme.text,
    fontSize: Platform.isTV ? 27 : 21,
    fontWeight: '800',
    paddingHorizontal: Platform.isTV ? 64 : 20,
    marginBottom: 16,
  },
  rowContent: {
    paddingLeft: Platform.isTV ? 64 : 20,
    paddingRight: Platform.isTV ? 40 : 6,
  },
});
