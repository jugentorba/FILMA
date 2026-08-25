import React, { useMemo, useRef, useState } from 'react';
import { FlatList, Image, Modal, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { stringsFor } from '../i18n';
import { shouldShowInContinueWatching } from '../services/progress';
import { mediaItemForEpisode, type StremioVideo } from '../services/stremio';
import type { MediaItem } from '../types';
import { useFilma } from '../store/FilmaContext';
import { FocusButton } from './FocusButton';
import { theme } from './theme';

type Props = {
  series: MediaItem;
  episodes: StremioVideo[];
  onChoose(video: StremioVideo): void;
  onClose(): void;
};

function episodeLabel(video: StremioVideo, fallback: string): string {
  const number = typeof video.episode === 'number' ? `E${video.episode}` : fallback;
  return `${number} · ${video.title}`;
}

export function EpisodePickerModal({ series, episodes, onChoose, onClose }: Props) {
  const { state } = useFilma();
  const text = stringsFor(state.preferences.appLanguage);
  const seasonListRef = useRef<FlatList<number>>(null);
  const episodeListRef = useRef<FlatList<StremioVideo>>(null);
  const copy = state.preferences.appLanguage === 'fr'
    ? { series: 'SÉRIE', episodes: 'épisodes', season: 'Saison', episode: 'Épisode', play: 'Lire', watched: 'regardé', locale: 'fr-FR' }
    : state.preferences.appLanguage === 'sq'
      ? { series: 'SERIAL', episodes: 'episode', season: 'Sezoni', episode: 'Episod', play: 'Luaj', watched: 'parë', locale: 'sq-AL' }
      : { series: 'SERIES', episodes: 'episodes', season: 'Season', episode: 'Episode', play: 'Play', watched: 'watched', locale: 'en-US' };

  const seasons = useMemo(() => {
    const values = new Set<number>();
    for (const video of episodes) {
      if (typeof video.season === 'number') values.add(video.season);
    }
    return [...values].sort((a, b) => a - b);
  }, [episodes]);

  const resumeEpisode = useMemo(() => episodes
    .map(video => {
      const item = mediaItemForEpisode(series, video);
      return { video, progress: state.progress[item.id] };
    })
    .filter(entry => shouldShowInContinueWatching(entry.progress))
    .sort((a, b) => new Date(b.progress!.updatedAt).getTime() - new Date(a.progress!.updatedAt).getTime())[0]?.video,
  [episodes, series, state.progress]);

  const [selectedSeason, setSelectedSeason] = useState<number | 'all'>(resumeEpisode?.season ?? seasons[0] ?? 'all');

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
            <Text style={styles.eyebrow}>{copy.series}</Text>
            <Text numberOfLines={1} style={styles.title}>{series.title}</Text>
            <Text style={styles.subtitle}>{episodes.length} {copy.episodes}</Text>
          </View>
          <FocusButton compact label={text.dismiss} onPress={onClose} />
        </View>

        {seasons.length ? (
          <FlatList
            ref={seasonListRef}
            horizontal
            data={seasons}
            keyExtractor={season => String(season)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.seasonRow}
            onScrollToIndexFailed={({ index, averageItemLength }) => {
              seasonListRef.current?.scrollToOffset({ offset: Math.max(0, index * averageItemLength), animated: true });
            }}
            renderItem={({ item: season, index }) => (
              <FocusButton
                compact
                label={`${copy.season} ${season}`}
                active={selectedSeason === season}
                preferredFocus={season === selectedSeason}
                onFocus={() => {
                  if (Platform.isTV) {
                    seasonListRef.current?.scrollToIndex({ index, viewPosition: 0.3, animated: true });
                  }
                }}
                onPress={() => {
                  setSelectedSeason(season);
                  episodeListRef.current?.scrollToOffset({ offset: 0, animated: false });
                }}
              />
            )}
          />
        ) : null}

        <FlatList
          ref={episodeListRef}
          style={styles.episodes}
          contentContainerStyle={styles.episodeContent}
          data={visible}
          keyExtractor={video => video.id}
          initialNumToRender={Platform.isTV ? 12 : 8}
          windowSize={Platform.isTV ? 9 : 5}
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            episodeListRef.current?.scrollToOffset({ offset: Math.max(0, index * averageItemLength), animated: true });
          }}
          renderItem={({ item: video, index }) => {
            const mediaItem = mediaItemForEpisode(series, video);
            const progress = state.progress[mediaItem.id];
            const canContinue = shouldShowInContinueWatching(progress);
            const ratio = progress?.durationSeconds
              ? Math.min(1, Math.max(0, progress.positionSeconds / progress.durationSeconds))
              : 0;

            return (
              <View style={styles.episodeRow}>
                <View style={styles.thumbnailWrap}>
                  {video.thumbnail ? (
                    <Image source={{ uri: video.thumbnail }} style={styles.thumbnail} resizeMode="cover" />
                  ) : (
                    <View style={styles.thumbnailFallback}>
                      <Text style={styles.thumbnailFallbackText}>{typeof video.episode === 'number' ? `E${video.episode}` : 'FILMA'}</Text>
                    </View>
                  )}
                  {ratio > 0 ? (
                    <View style={styles.thumbnailProgressTrack}>
                      <View style={[styles.thumbnailProgressFill, { width: `${Math.round(ratio * 100)}%` }]} />
                    </View>
                  ) : null}
                </View>

                <View style={styles.episodeText}>
                  <Text style={styles.episodeTitle}>{episodeLabel(video, copy.episode)}</Text>
                  {video.overview ? <Text numberOfLines={2} style={styles.overview}>{video.overview}</Text> : null}
                  <View style={styles.metaRow}>
                    {video.released ? (
                      <Text style={styles.released}>{new Date(video.released).toLocaleDateString(copy.locale)}</Text>
                    ) : null}
                    {ratio > 0 ? <Text style={styles.progressText}>{Math.round(ratio * 100)}% {copy.watched}</Text> : null}
                  </View>
                </View>

                <FocusButton
                  compact
                  label={canContinue ? text.continue : copy.play}
                  active
                  preferredFocus={!seasons.length && (resumeEpisode?.id === video.id || (!resumeEpisode && index === 0))}
                  accessibilityHint={episodeLabel(video, copy.episode)}
                  onFocus={() => {
                    if (Platform.isTV) {
                      episodeListRef.current?.scrollToIndex({ index, viewPosition: 0.46, animated: true });
                    }
                  }}
                  onPress={() => onChoose(video)}
                />
              </View>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
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
  headerText: { flex: 1 },
  eyebrow: { color: theme.accent, fontWeight: '900', letterSpacing: 2, fontSize: 12 },
  title: { color: theme.text, fontSize: Platform.isTV ? 31 : 23, fontWeight: '900', marginTop: 4 },
  subtitle: { color: theme.muted, marginTop: 4 },
  seasonRow: {
    gap: 10,
    paddingHorizontal: Platform.isTV ? 54 : 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  episodes: { flex: 1 },
  episodeContent: { paddingHorizontal: Platform.isTV ? 54 : 18, paddingVertical: 12, paddingBottom: 70 },
  episodeRow: {
    minHeight: Platform.isTV ? 138 : 112,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Platform.isTV ? 22 : 14,
  },
  thumbnailWrap: {
    width: Platform.isTV ? 190 : 118,
    aspectRatio: 16 / 9,
    borderRadius: Platform.isTV ? 12 : 9,
    overflow: 'hidden',
    backgroundColor: theme.surfaceRaised,
  },
  thumbnail: { width: '100%', height: '100%' },
  thumbnailFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#171d2b' },
  thumbnailFallbackText: { color: '#dfe5ef', fontWeight: '900', fontSize: Platform.isTV ? 22 : 15 },
  thumbnailProgressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, backgroundColor: 'rgba(255,255,255,0.28)' },
  thumbnailProgressFill: { height: '100%', backgroundColor: theme.accent },
  episodeText: { flex: 1 },
  episodeTitle: { color: theme.text, fontWeight: '800', fontSize: Platform.isTV ? 21 : 16 },
  overview: { color: theme.muted, marginTop: 5, lineHeight: Platform.isTV ? 22 : 19 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  released: { color: theme.muted, fontSize: 12 },
  progressText: { color: theme.accent, fontSize: 12, fontWeight: '800' },
});