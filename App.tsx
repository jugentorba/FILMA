import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { stringsFor } from './src/i18n';
import { HomeScreen } from './src/screens/HomeScreen';
import { LiveTvScreen } from './src/screens/LiveTvScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { YouTubeScreen } from './src/screens/YouTubeScreen';
import { resolveStreamsAcrossAddons, type StreamResolutionDiagnostics } from './src/services/streamResolver';
import { fetchMeta, mediaItemForEpisode, type StremioVideo } from './src/services/stremio';
import { type YouTubeVideo, youtubeWatchUrl } from './src/services/youtube';
import { DeviceModeProvider, useDeviceMode } from './src/store/DeviceModeContext';
import { DropboxSyncProvider } from './src/store/DropboxSyncContext';
import { FilmaProvider, useFilma } from './src/store/FilmaContext';
import type { MediaItem } from './src/types';
import { EpisodePickerModal } from './src/ui/EpisodePickerModal';
import { FocusButton } from './src/ui/FocusButton';
import { PlayerModal } from './src/ui/PlayerModal';
import { StreamPickerModal, type StreamChoice } from './src/ui/StreamPickerModal';
import { YouTubePlayerModal } from './src/ui/YouTubePlayerModal';
import { theme } from './src/ui/theme';

type Screen = 'home' | 'live' | 'youtube' | 'settings';

type PendingStreams = { item: MediaItem; streams: StreamChoice[] };
type PendingEpisodes = { series: MediaItem; episodes: StremioVideo[] };

function resolutionMessage(diagnostics: StreamResolutionDiagnostics): string {
  if (diagnostics.enabledProviders === 0) {
    return 'No enabled movie source is configured. Add a stream-capable Stremio-compatible source in Settings.';
  }
  if (diagnostics.manifestsLoaded === 0) {
    return 'FILMA could not load any configured movie-source manifest. Check the source URLs and your connection.';
  }
  if (diagnostics.streamCapableProviders === 0) {
    return 'The configured add-ons provide catalogs or metadata, but none advertise a stream resource.';
  }
  if (diagnostics.compatibleProviders === 0) {
    return 'Stream providers are configured, but none advertise support for this movie/episode type or ID.';
  }
  if (diagnostics.providerResponses === 0) {
    return 'Compatible stream providers were found, but none returned a successful stream response.';
  }
  if (diagnostics.totalReturnedEntries > 0 && diagnostics.directPlayableEntries === 0) {
    return `Providers returned ${diagnostics.totalReturnedEntries} source entr${diagnostics.totalReturnedEntries === 1 ? 'y' : 'ies'}, but none was a direct HTTP/HLS stream FILMA can play in-app.`;
  }
  return 'No playable stream was returned by the configured providers for this title.';
}

function FilmaApp() {
  const { ready, state, setMode, updateProgress, toggleFavorite } = useFilma();
  const { isTvMode } = useDeviceMode();
  const text = stringsFor(state.preferences.appLanguage);
  const [screen, setScreen] = useState<Screen>('home');
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [selectedYouTube, setSelectedYouTube] = useState<YouTubeVideo | null>(null);
  const [pendingStreams, setPendingStreams] = useState<PendingStreams | null>(null);
  const [pendingEpisodes, setPendingEpisodes] = useState<PendingEpisodes | null>(null);
  const [resolvingTitle, setResolvingTitle] = useState<string>();
  const [playbackError, setPlaybackError] = useState<string>();

  const goMovies = () => { setMode('movies'); setScreen('home'); };
  const goLive = () => { setMode('live'); setScreen('live'); };
  const goYouTube = () => { if (isTvMode) setScreen('youtube'); };
  const goSettings = () => setScreen('settings');

  const resolveStreamsFor = async (item: MediaItem) => {
    if (item.source?.kind !== 'stremio') {
      setPlaybackError('This item does not provide a Stremio-compatible media identity.');
      return;
    }

    setResolvingTitle(item.title);
    try {
      const resolution = await resolveStreamsAcrossAddons(
        item,
        state.addons,
        state.preferences.preferredAudioLanguages,
      );

      const streams: StreamChoice[] = resolution.streams.map(stream => ({
        title: `${stream.providerName} · ${stream.title}`,
        url: stream.url,
      }));

      if (!streams.length) {
        setPlaybackError(resolutionMessage(resolution.diagnostics));
      } else if (streams.length === 1) {
        setSelected({ ...item, streamUrl: streams[0].url });
      } else {
        setPendingStreams({ item, streams });
      }
    } catch (error) {
      setPlaybackError(error instanceof Error ? error.message : 'Could not resolve movie sources.');
    } finally {
      setResolvingTitle(undefined);
    }
  };

  const handleYouTubeVideo = async (video: YouTubeVideo) => {
    setPlaybackError(undefined);

    if (isTvMode && Platform.OS === 'android') {
      setSelectedYouTube(video);
      return;
    }

    try {
      await Linking.openURL(youtubeWatchUrl(video.id));
    } catch (error) {
      setPlaybackError(error instanceof Error ? error.message : 'Could not open this YouTube video.');
    }
  };

  const handleSelect = async (item: MediaItem) => {
    setPlaybackError(undefined);
    if (item.streamUrl) { setSelected(item); return; }

    if (item.source?.kind === 'youtube') {
      await handleYouTubeVideo({
        id: item.source.videoId,
        title: item.title,
        channelTitle: item.source.channelTitle ?? item.subtitle ?? 'YouTube',
        thumbnail: item.poster,
      });
      return;
    }

    if (item.source?.kind !== 'stremio') {
      setPlaybackError('This item does not provide a playable source.');
      return;
    }

    if (item.source.mediaType === 'series' && !item.source.videoId) {
      setResolvingTitle(`${item.title}`);
      try {
        const meta = await fetchMeta(item.source.manifestUrl, item.source.mediaType, item.source.mediaId);
        const episodes = (meta.videos ?? []).filter(video => Boolean(video.id && video.title));
        if (!episodes.length) {
          setPlaybackError('This series source returned no episode list.');
          return;
        }
        setPendingEpisodes({ series: item, episodes });
      } catch (error) {
        setPlaybackError(error instanceof Error ? error.message : 'Could not load series episodes.');
      } finally {
        setResolvingTitle(undefined);
      }
      return;
    }

    await resolveStreamsFor(item);
  };

  const handleProgress = useCallback((positionSeconds: number, durationSeconds: number) => {
    if (selected && !selected.id.startsWith('live:')) updateProgress(selected, positionSeconds, durationSeconds);
  }, [selected, updateProgress]);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <Text style={styles.brand}>FILMA</Text>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const selectedFavorite = selected ? state.favorites[selected.id] : undefined;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" hidden={Platform.isTV} />

      {Platform.isTV ? (
        <View style={styles.tvNav}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>F</Text></View>
            <Text style={styles.brand}>FILMA</Text>
          </View>
          <View style={styles.navButtons}>
            <FocusButton compact label={text.movies} active={screen === 'home'} onPress={goMovies} />
            <FocusButton compact label={text.liveTv} active={screen === 'live'} onPress={goLive} />
            <FocusButton compact label={text.youtube} active={screen === 'youtube'} onPress={goYouTube} />
            <FocusButton compact label={text.settings} active={screen === 'settings'} onPress={goSettings} />
          </View>
        </View>
      ) : (
        <View style={styles.mobileHeader}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>F</Text></View>
            <Text style={styles.brand}>FILMA</Text>
          </View>
          <Text style={styles.screenLabel}>{screen === 'home' ? text.movies : screen === 'live' ? text.liveTv : screen === 'youtube' ? text.youtube : text.settings}</Text>
        </View>
      )}

      {playbackError ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{playbackError}</Text>
          <FocusButton compact label={text.dismiss} onPress={() => setPlaybackError(undefined)} />
        </View>
      ) : null}

      {resolvingTitle ? (
        <View style={styles.resolveBar}>
          <ActivityIndicator size="small" />
          <Text numberOfLines={1} style={styles.resolveText}>{text.loading} {resolvingTitle}…</Text>
        </View>
      ) : null}

      <View style={styles.content}>
        {screen === 'home' ? (
          <HomeScreen
            onSelect={item => void handleSelect(item)}
            onOpenYouTubeVideo={video => void handleYouTubeVideo(video)}
            onOpenSettings={goSettings}
          />
        ) : null}
        {screen === 'live' ? <LiveTvScreen onSelect={item => void handleSelect(item)} onOpenSettings={goSettings} /> : null}
        {screen === 'youtube' && isTvMode ? <YouTubeScreen onOpenVideo={video => void handleYouTubeVideo(video)} /> : null}
        {screen === 'settings' ? <SettingsScreen /> : null}
      </View>

      {!Platform.isTV ? (
        <View style={styles.bottomNav}>
          <FocusButton compact label={`▣ ${text.movies}`} active={screen === 'home'} style={styles.mobileTab} onPress={goMovies} />
          <FocusButton compact label={`◉ ${text.liveTv}`} active={screen === 'live'} style={styles.mobileTab} onPress={goLive} />
          {isTvMode ? <FocusButton compact label={`▶ ${text.youtube}`} active={screen === 'youtube'} style={styles.mobileTab} onPress={goYouTube} /> : null}
          <FocusButton compact label={`⚙ ${text.settings}`} active={screen === 'settings'} style={styles.mobileTab} onPress={goSettings} />
        </View>
      ) : null}

      {pendingEpisodes ? (
        <EpisodePickerModal
          series={pendingEpisodes.series}
          episodes={pendingEpisodes.episodes}
          onChoose={video => {
            const item = mediaItemForEpisode(pendingEpisodes.series, video);
            setPendingEpisodes(null);
            void resolveStreamsFor(item);
          }}
          onClose={() => setPendingEpisodes(null)}
        />
      ) : null}

      {pendingStreams ? (
        <StreamPickerModal
          title={pendingStreams.item.title}
          streams={pendingStreams.streams}
          onChoose={stream => { setSelected({ ...pendingStreams.item, streamUrl: stream.url }); setPendingStreams(null); }}
          onClose={() => setPendingStreams(null)}
        />
      ) : null}

      {selectedYouTube ? (
        <YouTubePlayerModal
          videoId={selectedYouTube.id}
          title={selectedYouTube.title}
          channelTitle={selectedYouTube.channelTitle}
          onClose={() => setSelectedYouTube(null)}
        />
      ) : null}

      {selected?.streamUrl ? (
        <PlayerModal
          item={selected}
          progress={state.progress[selected.id]}
          favorite={Boolean(selectedFavorite && !selectedFavorite.deletedAt)}
          onProgress={handleProgress}
          onToggleFavorite={() => toggleFavorite(selected.id)}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <DeviceModeProvider>
      <FilmaProvider>
        <DropboxSyncProvider>
          <FilmaApp />
        </DropboxSyncProvider>
      </FilmaProvider>
    </DeviceModeProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  loading: { flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', gap: 22 },
  tvNav: {
    minHeight: 82, paddingHorizontal: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#090c14', borderBottomWidth: 1, borderBottomColor: theme.border, zIndex: 10,
  },
  mobileHeader: {
    minHeight: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#090c14', borderBottomWidth: 1, borderBottomColor: '#1d2432',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: Platform.isTV ? 38 : 30, height: Platform.isTV ? 38 : 30, borderRadius: 10, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#fff', fontWeight: '900', fontSize: Platform.isTV ? 20 : 16 },
  brand: { color: theme.text, fontWeight: '900', fontSize: Platform.isTV ? 29 : 20, letterSpacing: 2 },
  screenLabel: { color: theme.muted, fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  navButtons: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bottomNav: {
    minHeight: 72, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 8, flexDirection: 'row', gap: 7,
    backgroundColor: '#090c14', borderTopWidth: 1, borderTopColor: '#202737',
  },
  mobileTab: { flex: 1, paddingHorizontal: 8 },
  resolveBar: { minHeight: 48, paddingHorizontal: Platform.isTV ? 48 : 16, backgroundColor: theme.surface, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  resolveText: { color: theme.text, fontWeight: '700', flex: 1 },
  errorBar: { minHeight: 58, paddingHorizontal: Platform.isTV ? 48 : 14, paddingVertical: 8, backgroundColor: '#3b1018', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  errorText: { flex: 1, color: '#fecdd3', fontWeight: '700' },
  content: { flex: 1 },
});
