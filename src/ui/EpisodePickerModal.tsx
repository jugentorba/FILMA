import React, { useMemo, useRef, useState } from 'react';
import { FlatList, Image, Modal, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { stringsFor } from '../i18n';
import { shouldShowInContinueWatching } from '../services/progress';
import { mediaItemForEpisode, type StremioVideo } from '../services/stremio';
import type { MediaItem } from '../types';
import { useFilma } from '../store/FilmaContext';
import { FocusButton } from './FocusButton';
import { theme } from './theme';
import { useResponsiveLayout } from './useResponsiveLayout';

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
  const layout = useResponsiveLayout();
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

  const headerStyle = useMemo(() => ({
    minHeight: layout.isTv ? 96 : layout.isCompactPhone ? 68 : layout.isTablet ? 84 : 76,
    paddingHorizontal: layout.horizontalPadding,
    paddingVertical: layout.isTv ? 14 : layout.isCompactPhone ? 9 : 12,
    gap: layout.isCompactPhone ? 10 : 18,
  }), [layout.horizontalPadding, layout.isCompactPhone, layout.isTablet, layout.isTv]);

  const titleStyle = useMemo(() => ({
    fontSize: layout.isTv ? 28 : layout.isCompactPhone ? 19 : layout.isTablet ? 25 : 21,
  }), [layout.isCompactPhone, layout.isTablet, layout.isTv]);

  const seasonRowStyle = useMemo(() => ({
    gap: layout.isCompactPhone ? 6 : 9,
    paddingHorizontal: layout.horizontalPadding,
    paddingVertical: layout.isTv ? 13 : layout.isCompactPhone ? 8 : 11,
  }), [layout.horizontalPadding, layout.isCompactPhone, layout.isTv]);

  const episodeContentStyle = useMemo(() => ({
    paddingHorizontal: layout.horizontalPadding,
    paddingVertical: layout.isCompactPhone ? 5 : 9,
    paddingBottom: layout.isTv ? 62 : 88,
  }), [layout.horizontalPadding, layout.isCompactPhone, layout.isTv]);

  const episodeRowStyle = useMemo(() => ({
    minHeight: layout.isTv ? 124 : layout.isCompactPhone ? 82 : layout.isTablet ? 112 : 96,
    paddingVertical: layout.isTv ? 11 : layout.isCompactPhone ? 7 : 9,
    gap: layout.isTv ? 18 : layout.isCompactPhone ? 9 : layout.isTablet ? 15 : 11,
  }), [layout.isCompactPhone, layout.isTablet, layout.isTv]);

  const thumbnailStyle = useMemo(() => ({
    width: layout.isTv ? 172 : layout.isCompactPhone ? 92 : layout.isTablet ? 154 : 112,
    borderRadius: layout.isTv ? 11 : layout.isCompactPhone ? 7 : 9,
  }), [layout.isCompactPhone, layout.isTablet, layout.isTv]);

  const episodeTitleStyle = useMemo(() => ({
    fontSize: layout.isTv ? 19 : layout.isCompactPhone ? 13 : layout.isTablet ? 17 : 15,
  }), [layout.isCompactPhone, layout.isTablet, layout.isTv]);

  const overviewStyle = useMemo(() => ({
    fontSize: layout.isCompactPhone ? 11 : layout.isTv ? 14 : 12,
    lineHeight: layout.isTv ? 20 : layout.isCompactPhone ? 15 : 18,
    marginTop: layout.isCompactPhone ? 3 : 5,
  }), [layout.isCompactPhone, layout.isTv]);

  const fallbackStyle = useMemo(() => ({
    fontSize: layout.isTv ? 20 : layout.isCompactPhone ? 12 : 14,
  }), [layout.isCompactPhone, layout.isTv]);

  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <View style={[styles.header, headerStyle]}>
          <View style={styles.headerText}>
            <Text style={[styles.eyebrow, layout.isCompactPhone && styles.eyebrowCompact]}>{copy.series}</Text>
            <Text numberOfLines={1} style={[styles.title, titleStyle]}>{series.title}</Text>
            <Text style={[styles.subtitle, layout.isCompactPhone && styles.subtitleCompact]}>{episodes.length} {copy.episodes}</Text>
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
            contentContainerStyle={[styles.seasonRow, seasonRowStyle]}
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
          contentContainerStyle={[styles.episodeContent, episodeContentStyle]}
          data={visible}
          keyExtractor={video => video.id}
          initialNumToRender={layout.isTv ? 12 : layout.isTablet ? 10 : 8}
          windowSize={layout.isTv ? 9 : 5}
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
              <View style={[styles.episodeRow, episodeRowStyle]}>
                <View style={[styles.thumbnailWrap, thumbnailStyle]}>
                  {video.thumbnail ? (
                    <Image source={{ uri: video.thumbnail }} style={styles.thumbnail} resizeMode="cover" />
                  ) : (
                    <View style={styles.thumbnailFallback}>
                      <Text style={[styles.thumbnailFallbackText, fallbackStyle]}>{typeof video.episode === 'number' ? `E${video.episode}` : 'FILMA'}</Text>
                    </View>
                  )}
                  {ratio > 0 ? (
                    <View style={styles.thumbnailProgressTrack}>
                      <View style={[styles.thumbnailProgressFill, { width: `${Math.round(ratio * 100)}%` }]} />
                    </View>
                  ) : null}
                </View>

                <View style={styles.episodeText}>
                  <Text numberOfLines={layout.isCompactPhone ? 1 : 2} style={[styles.episodeTitle, episodeTitleStyle]}>{episodeLabel(video, copy.episode)}</Text>
                  {video.overview && !layout.isCompactPhone ? <Text numberOfLines={2} style={[styles.overview, overviewStyle]}>{video.overview}</Text> : null}
                  <View style={[styles.metaRow, layout.isCompactPhone && styles.metaRowCompact]}>
                    {video.released ? (
                      <Text style={[styles.released, layout.isCompactPhone && styles.metaCompact]}>{new Date(video.released).toLocaleDateString(copy.locale)}</Text>
                    ) : null}
                    {ratio > 0 ? <Text style={[styles.progressText, layout.isCompactPhone && styles.metaCompact]}>{Math.round(ratio * 100)}% {copy.watched}</Text> : null}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerText: { flex: 1, minWidth: 0 },
  eyebrow: { color: theme.accent, fontWeight: '900', letterSpacing: 2, fontSize: 12 },
  eyebrowCompact: { fontSize: 10, letterSpacing: 1.5 },
  title: { color: theme.text, fontWeight: '900', marginTop: 3 },
  subtitle: { color: theme.muted, marginTop: 3, fontSize: 13 },
  subtitleCompact: { fontSize: 11, marginTop: 2 },
  seasonRow: {
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  episodes: { flex: 1 },
  episodeContent: {},
  episodeRow: {
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnailWrap: {
    aspectRatio: 16 / 9,
    overflow: 'hidden',
    backgroundColor: theme.surfaceRaised,
    flexShrink: 0,
  },
  thumbnail: { width: '100%', height: '100%' },
  thumbnailFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#171d2b' },
  thumbnailFallbackText: { color: '#dfe5ef', fontWeight: '900' },
  thumbnailProgressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, backgroundColor: 'rgba(255,255,255,0.28)' },
  thumbnailProgressFill: { height: '100%', backgroundColor: theme.accent },
  episodeText: { flex: 1, minWidth: 0 },
  episodeTitle: { color: theme.text, fontWeight: '800' },
  overview: { color: theme.muted },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  metaRowCompact: { gap: 6, marginTop: 3 },
  released: { color: theme.muted, fontSize: 12 },
  progressText: { color: theme.accent, fontSize: 12, fontWeight: '800' },
  metaCompact: { fontSize: 10 },
});