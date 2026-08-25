import React, { useMemo, useState } from 'react';
import { Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MediaItem } from '../types';
import type { StremioVideo } from '../services/stremio';
import { FocusButton } from './FocusButton';
import { theme } from './theme';

type Props = {
  series: MediaItem;
  episodes: StremioVideo[];
  onChoose(video: StremioVideo): void;
  onClose(): void;
};

function episodeLabel(video: StremioVideo): string {
  const number = typeof video.episode === 'number' ? `E${video.episode}` : 'Episode';
  return `${number} · ${video.title}`;
}

export function EpisodePickerModal({ series, episodes, onChoose, onClose }: Props) {
  const seasons = useMemo(() => {
    const values = new Set<number>();
    for (const video of episodes) {
      if (typeof video.season === 'number') values.add(video.season);
    }
    return [...values].sort((a, b) => a - b);
  }, [episodes]);

  const [selectedSeason, setSelectedSeason] = useState<number | 'all'>(seasons[0] ?? 'all');

  const visible = useMemo(() => episodes
    .filter(video => selectedSeason === 'all' || video.season === selectedSeason)
    .sort((a, b) => {
      const seasonA = a.season ?? 0;
      const seasonB = b.season ?? 0;
      if (seasonA !== seasonB) return seasonA - seasonB;
      const episodeA = a.episode ?? Number.MAX_SAFE_INTEGER;
      const episodeB = b.episode ?? Number.MAX_SAFE_INTEGER;
      if (episodeA !== episodeB) return episodeA - episodeB;
      return (a.released ?? '').localeCompare(b.released ?? '');
    }), [episodes, selectedSeason]);

  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>SERIES</Text>
            <Text numberOfLines={1} style={styles.title}>{series.title}</Text>
            <Text style={styles.subtitle}>{episodes.length} episodes</Text>
          </View>
          <FocusButton compact label="Close" onPress={onClose} />
        </View>

        {seasons.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seasonRow}>
            {seasons.map(season => (
              <FocusButton
                key={season}
                compact
                label={`Season ${season}`}
                active={selectedSeason === season}
                onPress={() => setSelectedSeason(season)}
              />
            ))}
          </ScrollView>
        ) : null}

        <ScrollView style={styles.episodes} contentContainerStyle={styles.episodeContent}>
          {visible.map(video => (
            <View key={video.id} style={styles.episodeRow}>
              <View style={styles.episodeText}>
                <Text style={styles.episodeTitle}>{episodeLabel(video)}</Text>
                {video.overview ? <Text numberOfLines={2} style={styles.overview}>{video.overview}</Text> : null}
                {video.released ? (
                  <Text style={styles.released}>{new Date(video.released).toLocaleDateString()}</Text>
                ) : null}
              </View>
              <FocusButton compact label="Play" active onPress={() => onChoose(video)} />
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    minHeight: Platform.isTV ? 110 : 86,
    paddingHorizontal: Platform.isTV ? 54 : 18,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    color: theme.accent,
    fontWeight: '900',
    letterSpacing: 2,
    fontSize: 12,
  },
  title: {
    color: theme.text,
    fontSize: Platform.isTV ? 31 : 23,
    fontWeight: '900',
    marginTop: 4,
  },
  subtitle: {
    color: theme.muted,
    marginTop: 4,
  },
  seasonRow: {
    gap: 10,
    paddingHorizontal: Platform.isTV ? 54 : 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  episodes: {
    flex: 1,
  },
  episodeContent: {
    paddingHorizontal: Platform.isTV ? 54 : 18,
    paddingVertical: 12,
    paddingBottom: 70,
  },
  episodeRow: {
    minHeight: Platform.isTV ? 104 : 88,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  episodeText: {
    flex: 1,
  },
  episodeTitle: {
    color: theme.text,
    fontWeight: '800',
    fontSize: Platform.isTV ? 21 : 17,
  },
  overview: {
    color: theme.muted,
    marginTop: 5,
    lineHeight: Platform.isTV ? 22 : 19,
  },
  released: {
    color: theme.muted,
    marginTop: 5,
    fontSize: 12,
  },
});
