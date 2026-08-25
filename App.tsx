import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useMemo, useState } from 'react';
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
import type { AppLanguage, MediaItem } from './src/types';
import { EpisodePickerModal } from './src/ui/EpisodePickerModal';
import { FocusButton } from './src/ui/FocusButton';
import { PlayerModal } from './src/ui/PlayerModal';
import { YouTubePlayerModal } from './src/ui/YouTubePlayerModal';
import { theme } from './src/ui/theme';

type Screen = 'home' | 'live' | 'youtube' | 'settings';

type PendingEpisodes = { series: MediaItem; episodes: StremioVideo[] };

type PlaybackCopy = {
  noEnabledSource: string;
  manifestsUnavailable: string;
  noStreamResource: string;
  noCompatibleProvider: string;
  noProviderResponse: string;
  indirectEntries(count: number): string;
  noPlayableStream: string;
  missingMediaIdentity: string;
  resolveFailed: string;
  youtubeOpenFailed: string;
  youtubeAppleTvUnavailable: string;
  itemNotPlayable: string;
  noEpisodes: string;
  episodesFailed: string;
};

function playbackCopyFor(language: AppLanguage): PlaybackCopy {
  if (language === 'fr') {
    return {
      noEnabledSource: 'Aucune source de films active n’est configurée. Ajoutez une source Stremio compatible avec la lecture dans les Réglages.',
      manifestsUnavailable: 'FILMA n’a pu charger aucun manifeste de source de films. Vérifiez les URL et votre connexion.',
      noStreamResource: 'Les extensions configurées fournissent des catalogues ou des métadonnées, mais aucune ne fournit de ressource de lecture.',
      noCompatibleProvider: 'Des sources de lecture existent, mais aucune n’annonce la prise en charge de ce film, épisode ou identifiant.',
      noProviderResponse: 'Des sources compatibles ont été trouvées, mais aucune n’a renvoyé une réponse de lecture valide.',
      indirectEntries: count => `Les fournisseurs ont renvoyé ${count} source${count === 1 ? '' : 's'}, mais aucune n’est un flux HTTP/HLS direct lisible dans FILMA.`,
      noPlayableStream: 'Aucun flux lisible n’a été renvoyé pour ce titre.',
      missingMediaIdentity: 'Ce contenu ne fournit pas un identifiant média compatible avec Stremio.',
      resolveFailed: 'FILMA n’a pas pu résoudre les sources de lecture.',
      youtubeOpenFailed: 'FILMA n’a pas pu ouvrir cette vidéo YouTube.',
      youtubeAppleTvUnavailable: 'YouTube ne peut pas être ouvert sur cet Apple TV. Installez ou mettez à jour l’app YouTube depuis l’App Store de l’Apple TV, puis réessayez.',
      itemNotPlayable: 'Ce contenu ne fournit pas de source lisible.',
      noEpisodes: 'Cette série n’a renvoyé aucune liste d’épisodes.',
      episodesFailed: 'FILMA n’a pas pu charger les épisodes de cette série.',
    };
  }

  if (language === 'sq') {
    return {
      noEnabledSource: 'Nuk ka asnjë burim aktiv filmash. Shto te Cilësimet një burim Stremio që ofron transmetim.',
      manifestsUnavailable: 'FILMA nuk arriti të ngarkojë asnjë manifest të burimeve të filmave. Kontrollo URL-të dhe lidhjen me internetin.',
      noStreamResource: 'Shtesat e konfiguruara japin katalogë ose metadata, por asnjëra nuk ofron burim transmetimi.',
      noCompatibleProvider: 'Ka burime transmetimi, por asnjëri nuk deklaron mbështetje për këtë film, episod ose ID.',
      noProviderResponse: 'U gjetën burime të përputhshme, por asnjëri nuk ktheu përgjigje të vlefshme transmetimi.',
      indirectEntries: count => `Burimet kthyen ${count} hyrje, por asnjëra nuk është transmetim i drejtpërdrejtë HTTP/HLS që FILMA mund ta luajë.`,
      noPlayableStream: 'Nuk u gjet asnjë transmetim i luajtshëm për këtë titull.',
      missingMediaIdentity: 'Ky përmbajtje nuk ka një identitet media të përputhshëm me Stremio.',
      resolveFailed: 'FILMA nuk arriti të gjejë burimet e transmetimit.',
      youtubeOpenFailed: 'FILMA nuk arriti ta hapë këtë video në YouTube.',
      youtubeAppleTvUnavailable: 'YouTube nuk mund të hapet në këtë Apple TV. Instalo ose përditëso aplikacionin YouTube nga App Store i Apple TV dhe provo përsëri.',
      itemNotPlayable: 'Ky përmbajtje nuk ofron një burim të luajtshëm.',
      noEpisodes: 'Ky serial nuk ktheu asnjë listë episodesh.',
      episodesFailed: 'FILMA nuk arriti të ngarkojë episodet e këtij seriali.',
    };
  }

  return {
    noEnabledSource: 'No enabled movie source is configured. Add a stream-capable Stremio-compatible source in Settings.',
    manifestsUnavailable: 'FILMA could not load any movie-source manifest. Check the source URLs and your connection.',
    noStreamResource: 'The configured add-ons provide catalogs or metadata, but none advertise a stream resource.',
    noCompatibleProvider: 'Stream providers are configured, but none advertise support for this movie, episode, or ID.',
    noProviderResponse: 'Compatible stream providers were found, but none returned a successful stream response.',
    indirectEntries: count => `Providers returned ${count} source entr${count === 1 ? 'y' : 'ies'}, but none was a direct HTTP/HLS stream FILMA can play in-app.`,
    noPlayableStream: 'No playable stream was returned for this title.',
    missingMediaIdentity: 'This item does not provide a Stremio-compatible media identity.',
    resolveFailed: 'FILMA could not resolve movie sources.',
    youtubeOpenFailed: 'FILMA could not open this YouTube video.',
    youtubeAppleTvUnavailable: 'YouTube cannot be opened on this Apple TV. Install or update the YouTube app from the Apple TV App Store, then try again.',
    itemNotPlayable: 'This item does not provide a playable source.',
    noEpisodes: 'This series source returned no episode list.',
    episodesFailed: 'FILMA could not load this series episode list.',
  };
}

function resolutionMessage(diagnostics: StreamResolutionDiagnostics, copy: PlaybackCopy): string {
  if (diagnostics.enabledProviders === 0) return copy.noEnabledSource;
  if (diagnostics.manifestsLoaded === 0) return copy.manifestsUnavailable;
  if (diagnostics.streamCapableProviders === 0) return copy.noStreamResource;
  if (diagnostics.compatibleProviders === 0) return copy.noCompatibleProvider;
  if (diagnostics.providerResponses === 0) return copy.noProviderResponse;
  if (diagnostics.totalReturnedEntries > 0 && diagnostics.directPlayableEntries === 0) {
    return copy.indirectEntries(diagnostics.totalReturnedEntries);
  }
  return copy.noPlayableStream;
}

function FilmaApp() {
  const { ready, state, setMode, updateProgress, toggleFavorite } = useFilma();
  const { isTvMode } = useDeviceMode();
  const text = stringsFor(state.preferences.appLanguage);
  const playbackCopy = useMemo(() => playbackCopyFor(state.preferences.appLanguage), [state.preferences.appLanguage]);
  const [screen, setScreen] = useState<Screen>('home');
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [selectedYouTube, setSelectedYouTube] = useState<YouTubeVideo | null>(null);
  const [pendingEpisodes, setPendingEpisodes] = useState<PendingEpisodes | null>(null);
  const [resolvingTitle, setResolvingTitle] = useState<string>();
  const [playbackError, setPlaybackError] = useState<string>();

  const goMovies = () => { setMode('movies'); setScreen('home'); };
  const goLive = () => { setMode('live'); setScreen('live'); };
  const goYouTube = () => { if (isTvMode) setScreen('youtube'); };
  const goSettings = () => setScreen('settings');

  const resolveStreamsFor = async (item: MediaItem) => {
    if (item.source?.kind !== 'stremio') {
      setPlaybackError(playbackCopy.missingMediaIdentity);
      return;
    }

    setResolvingTitle(item.title);
    try {
      const resolution = await resolveStreamsAcrossAddons(
        item,
        state.addons,
        state.preferences.preferredAudioLanguages,
      );

      const best = resolution.streams[0];
      if (!best) {
        setPlaybackError(resolutionMessage(resolution.diagnostics, playbackCopy));
        return;
      }

      setSelected({ ...item, streamUrl: best.url });
    } catch (error) {
      setPlaybackError(error instanceof Error && error.message ? `${playbackCopy.resolveFailed} ${error.message}` : playbackCopy.resolveFailed);
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

    const watchUrl = youtubeWatchUrl(video.id);

    if (isTvMode && Platform.OS === 'ios') {
      try {
        const canOpen = await Linking.canOpenURL(watchUrl);
        if (!canOpen) {
          setPlaybackError(playbackCopy.youtubeAppleTvUnavailable);
          return;
        }
        await Linking.openURL(watchUrl);
      } catch {
        setPlaybackError(playbackCopy.youtubeAppleTvUnavailable);
      }
      return;
    }

    try {
      await Linking.openURL(watchUrl);
    } catch {
      setPlaybackError(playbackCopy.youtubeOpenFailed);
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
      setPlaybackError(playbackCopy.itemNotPlayable);
      return;
    }

    if (item.source.mediaType === 'series' && !item.source.videoId) {
      setResolvingTitle(`${item.title}`);
      try {
        const meta = await fetchMeta(item.source.manifestUrl, item.source.mediaType, item.source.mediaId);
        const episodes = (meta.videos ?? []).filter(video => Boolean(video.id && video.title));
        if (!episodes.length) {
          setPlaybackError(playbackCopy.noEpisodes);
          return;
        }
        setPendingEpisodes({ series: item, episodes });
      } catch (error) {
        setPlaybackError(error instanceof Error && error.message ? `${playbackCopy.episodesFailed} ${error.message}` : playbackCopy.episodesFailed);
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