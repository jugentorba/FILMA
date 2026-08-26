import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { stringsFor } from './src/i18n';
import { HomeScreen } from './src/screens/HomeScreen';
import { LiveTvScreen } from './src/screens/LiveTvScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { YouTubeScreen } from './src/screens/YouTubeScreen';
import { getMetaCached } from './src/services/mediaDiscovery';
import { resolveStreamsAcrossAddons, type StreamResolutionDiagnostics } from './src/services/streamResolver';
import { FILMA_ARCHIVE_MANIFEST_URL, mediaItemForEpisode, type StremioVideo } from './src/services/stremio';
import { type YouTubeVideo, youtubeWatchUrl } from './src/services/youtube';
import { DeviceModeProvider, useDeviceMode } from './src/store/DeviceModeContext';
import { DropboxSyncProvider } from './src/store/DropboxSyncContext';
import { FilmaProvider, useFilma } from './src/store/FilmaContext';
import type { AppLanguage, MediaItem } from './src/types';
import { EpisodePickerModal } from './src/ui/EpisodePickerModal';
import { FocusButton } from './src/ui/FocusButton';
import { MediaDetailsModal } from './src/ui/MediaDetailsModal';
import { NavTab } from './src/ui/NavTab';
import { PlayerModal } from './src/ui/PlayerModal';
import { ProfileSwitcher } from './src/ui/ProfileSwitcher';
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
  sources: string;
};

function playbackCopyFor(language: AppLanguage): PlaybackCopy {
  if (language === 'fr') {
    return {
      noEnabledSource: 'Aucune source de lecture n’est configurée pour les films et séries.',
      manifestsUnavailable: 'FILMA n’a pas pu contacter les fournisseurs de lecture. Vérifiez la connexion et réessayez.',
      noStreamResource: 'Tes fournisseurs actuels donnent un catalogue, mais aucun ne fournit de lecture pour ce titre.',
      noCompatibleProvider: 'Ce titre est dans le catalogue, mais aucun fournisseur actif ne prend actuellement en charge sa lecture.',
      noProviderResponse: 'Les fournisseurs compatibles n’ont renvoyé aucune disponibilité de lecture pour ce titre.',
      indirectEntries: count => `${count} option${count === 1 ? '' : 's'} externe${count === 1 ? '' : 's'} détectée${count === 1 ? '' : 's'}, mais aucune lecture directe dans FILMA.`,
      noPlayableStream: 'Ce titre est disponible dans le catalogue, mais aucune source de lecture n’est disponible pour le moment.',
      missingMediaIdentity: 'Ce contenu ne fournit pas un identifiant compatible avec les fournisseurs FILMA.',
      resolveFailed: 'FILMA n’a pas pu vérifier les sources de lecture.',
      youtubeOpenFailed: 'FILMA n’a pas pu ouvrir cette vidéo YouTube.',
      youtubeAppleTvUnavailable: 'YouTube ne peut pas être ouvert sur cet Apple TV. Installez ou mettez à jour l’app YouTube depuis l’App Store de l’Apple TV, puis réessayez.',
      itemNotPlayable: 'Ce contenu ne fournit pas de source de lecture.',
      noEpisodes: 'Cette série n’a renvoyé aucune liste d’épisodes.',
      episodesFailed: 'FILMA n’a pas pu charger les épisodes de cette série.',
      sources: 'Sources',
    };
  }
  if (language === 'sq') {
    return {
      noEnabledSource: 'Nuk ka burim aktiv për luajtjen e filmave dhe serialeve.',
      manifestsUnavailable: 'FILMA nuk arriti të kontaktojë burimet e luajtjes. Kontrollo internetin dhe provo përsëri.',
      noStreamResource: 'Burimet aktuale japin katalog, por asnjëri nuk ofron luajtje për këtë titull.',
      noCompatibleProvider: 'Ky titull është në katalog, por asnjë burim aktiv nuk e mbështet aktualisht luajtjen e tij.',
      noProviderResponse: 'Burimet e përputhshme nuk kthyen disponueshmëri luajtjeje për këtë titull.',
      indirectEntries: count => `U gjetën ${count} opsione të jashtme, por jo transmetim direkt në FILMA.`,
      noPlayableStream: 'Ky titull është në katalog, por për momentin nuk ka burim luajtjeje.',
      missingMediaIdentity: 'Ky përmbajtje nuk ka identitet të përputhshëm me burimet FILMA.',
      resolveFailed: 'FILMA nuk arriti të kontrollojë burimet e luajtjes.',
      youtubeOpenFailed: 'FILMA nuk arriti ta hapë këtë video në YouTube.',
      youtubeAppleTvUnavailable: 'YouTube nuk mund të hapet në këtë Apple TV. Instalo ose përditëso aplikacionin YouTube nga App Store i Apple TV dhe provo përsëri.',
      itemNotPlayable: 'Ky përmbajtje nuk ka burim luajtjeje.',
      noEpisodes: 'Ky serial nuk ktheu asnjë listë episodesh.',
      episodesFailed: 'FILMA nuk arriti të ngarkojë episodet e këtij seriali.',
      sources: 'Burimet',
    };
  }
  return {
    noEnabledSource: 'No playback provider is configured for movies and series.',
    manifestsUnavailable: 'FILMA could not contact the playback providers. Check the connection and try again.',
    noStreamResource: 'Your current providers supply catalogue data, but none supplies playback for this title.',
    noCompatibleProvider: 'This title is in the catalogue, but none of your active providers currently supports playback for it.',
    noProviderResponse: 'Compatible providers returned no playback availability for this title.',
    indirectEntries: count => `${count} external option${count === 1 ? '' : 's'} found, but no direct playback in FILMA.`,
    noPlayableStream: 'This title is in the catalogue, but no playback source is currently available.',
    missingMediaIdentity: 'This content does not provide an identity compatible with FILMA providers.',
    resolveFailed: 'FILMA could not check playback sources.',
    youtubeOpenFailed: 'FILMA could not open this YouTube video.',
    youtubeAppleTvUnavailable: 'YouTube cannot be opened on this Apple TV. Install or update the YouTube app from the Apple TV App Store, then try again.',
    itemNotPlayable: 'This content does not provide a playback source.',
    noEpisodes: 'This series source returned no episode list.',
    episodesFailed: 'FILMA could not load this series episode list.',
    sources: 'Sources',
  };
}

function resolutionMessage(diagnostics: StreamResolutionDiagnostics, copy: PlaybackCopy): string {
  if (diagnostics.enabledProviders === 0) return copy.noEnabledSource;
  if (diagnostics.manifestsLoaded === 0) return copy.manifestsUnavailable;
  if (diagnostics.streamCapableProviders === 0) return copy.noStreamResource;
  if (diagnostics.compatibleProviders === 0) return copy.noCompatibleProvider;
  if (diagnostics.providerResponses === 0) return copy.noProviderResponse;
  if (diagnostics.totalReturnedEntries > 0 && diagnostics.directPlayableEntries === 0) return copy.indirectEntries(diagnostics.totalReturnedEntries);
  return copy.noPlayableStream;
}

function FilmaApp() {
  const { ready, state, setMode, updateProgress, toggleFavorite } = useFilma();
  const { isTvMode } = useDeviceMode();
  const text = stringsFor(state.preferences.appLanguage);
  const playbackCopy = useMemo(() => playbackCopyFor(state.preferences.appLanguage), [state.preferences.appLanguage]);
  const [screen, setScreen] = useState<Screen>('home');
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [detailsItem, setDetailsItem] = useState<MediaItem | null>(null);
  const [selectedYouTube, setSelectedYouTube] = useState<YouTubeVideo | null>(null);
  const [pendingEpisodes, setPendingEpisodes] = useState<PendingEpisodes | null>(null);
  const [resolvingTitle, setResolvingTitle] = useState<string>();
  const [playbackError, setPlaybackError] = useState<string>();
  const [availabilityNotice, setAvailabilityNotice] = useState<string>();

  const goMovies = () => { setMode('movies'); setScreen('home'); };
  const goLive = () => { setMode('live'); setScreen('live'); };
  const goYouTube = () => { if (isTvMode) setScreen('youtube'); };
  const goSettings = () => { setDetailsItem(null); setAvailabilityNotice(undefined); setScreen('settings'); };

  const resolveStreamsFor = async (item: MediaItem) => {
    if (item.source?.kind !== 'stremio') {
      setPlaybackError(playbackCopy.missingMediaIdentity);
      return;
    }
    setPlaybackError(undefined);
    setAvailabilityNotice(undefined);
    setResolvingTitle(item.title);
    try {
      const resolution = await resolveStreamsAcrossAddons(item, state.addons, state.preferences.preferredAudioLanguages);
      const best = resolution.streams[0];
      if (!best) {
        if (resolution.diagnostics.manifestsLoaded === 0 && resolution.diagnostics.enabledProviders > 0) setPlaybackError(resolutionMessage(resolution.diagnostics, playbackCopy));
        else setAvailabilityNotice(resolutionMessage(resolution.diagnostics, playbackCopy));
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
    setAvailabilityNotice(undefined);
    if (Platform.OS === 'android') {
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

  const handlePlayItem = async (item: MediaItem) => {
    setDetailsItem(null);
    setPlaybackError(undefined);
    setAvailabilityNotice(undefined);
    if (item.streamUrl) { setSelected(item); return; }
    if (item.source?.kind === 'youtube') {
      await handleYouTubeVideo({ id: item.source.videoId, title: item.title, channelTitle: item.source.channelTitle ?? item.subtitle ?? 'YouTube', thumbnail: item.poster });
      return;
    }
    if (item.source?.kind !== 'stremio') {
      setPlaybackError(playbackCopy.itemNotPlayable);
      return;
    }
    if (item.source.mediaType === 'series' && !item.source.videoId) {
      setResolvingTitle(item.title);
      try {
        const meta = await getMetaCached(item.source.manifestUrl, item.source.mediaType, item.source.mediaId);
        const episodes = (meta.videos ?? []).filter(video => Boolean(video.id && video.title));
        if (!episodes.length) {
          setAvailabilityNotice(playbackCopy.noEpisodes);
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

  const handleBrowseSelect = (item: MediaItem) => {
    setPlaybackError(undefined);
    setAvailabilityNotice(undefined);
    setDetailsItem(item);
  };

  const handleLiveSelect = async (item: MediaItem) => {
    setDetailsItem(null);
    await handlePlayItem(item);
  };

  const handleProgress = useCallback((positionSeconds: number, durationSeconds: number) => {
    if (selected && !selected.id.startsWith('live:')) updateProgress(selected, positionSeconds, durationSeconds);
  }, [selected, updateProgress]);

  if (!ready) {
    return <View style={styles.loading}><Text style={styles.brand}>FILMA</Text><ActivityIndicator size="large" /></View>;
  }

  const selectedFavorite = selected ? state.favorites[selected.id] : undefined;
  const detailsFavorite = detailsItem ? state.favorites[detailsItem.id] : undefined;
  const detailsKnownPlayable = Boolean(detailsItem?.streamUrl || detailsItem?.source?.kind === 'youtube' || (detailsItem?.source?.kind === 'stremio' && detailsItem.source.manifestUrl === FILMA_ARCHIVE_MANIFEST_URL));

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" hidden={Platform.isTV} />
      {Platform.isTV ? (
        <View style={styles.tvNav}>
          <View style={styles.brandRow}><View style={styles.brandMark}><Text style={styles.brandMarkText}>F</Text></View><Text style={styles.brand}>FILMA</Text></View>
          <View style={styles.navButtons}>
            <FocusButton compact label={text.movies} active={screen === 'home'} onPress={goMovies} />
            <FocusButton compact label={text.liveTv} active={screen === 'live'} onPress={goLive} />
            <FocusButton compact label={text.youtube} active={screen === 'youtube'} onPress={goYouTube} />
            <ProfileSwitcher />
            <FocusButton compact label={text.settings} active={screen === 'settings'} onPress={goSettings} />
          </View>
        </View>
      ) : (
        <View style={styles.mobileHeader}>
          <View style={styles.brandRow}><View style={styles.brandMark}><Text style={styles.brandMarkText}>F</Text></View><Text style={styles.brand}>FILMA</Text></View>
          <View style={styles.mobileHeaderActions}><Text style={styles.screenLabel}>{screen === 'home' ? text.movies : screen === 'live' ? text.liveTv : screen === 'youtube' ? text.youtube : text.settings}</Text><ProfileSwitcher /></View>
        </View>
      )}

      {playbackError ? <View style={styles.errorBar}><Text style={styles.errorText}>{playbackError}</Text><FocusButton compact label={text.dismiss} onPress={() => setPlaybackError(undefined)} /></View> : null}
      {availabilityNotice ? (
        <View style={styles.noticeBar}>
          <Text style={styles.noticeText}>{availabilityNotice}</Text>
          <View style={styles.noticeActions}><FocusButton compact active label={playbackCopy.sources} onPress={goSettings} /><FocusButton compact label={text.dismiss} onPress={() => setAvailabilityNotice(undefined)} /></View>
        </View>
      ) : null}
      {resolvingTitle ? <View style={styles.resolveBar}><ActivityIndicator size="small" /><Text numberOfLines={1} style={styles.resolveText}>{text.loading} {resolvingTitle}…</Text></View> : null}

      <View style={styles.content}>
        {screen === 'home' ? <HomeScreen onSelect={handleBrowseSelect} onOpenYouTubeVideo={video => void handleYouTubeVideo(video)} onOpenSettings={goSettings} /> : null}
        {screen === 'live' ? <LiveTvScreen onSelect={item => void handleLiveSelect(item)} onOpenSettings={goSettings} /> : null}
        {screen === 'youtube' && isTvMode ? <YouTubeScreen onOpenVideo={video => void handleYouTubeVideo(video)} /> : null}
        {screen === 'settings' ? <SettingsScreen /> : null}
      </View>

      {!Platform.isTV ? (
        <View style={styles.bottomNav}>
          <NavTab label={text.movies} icon="movies" active={screen === 'home'} onPress={goMovies} />
          <NavTab label={text.liveTv} icon="live" active={screen === 'live'} onPress={goLive} />
          {isTvMode ? <NavTab label={text.youtube} icon="youtube" active={screen === 'youtube'} onPress={goYouTube} /> : null}
          <NavTab label={text.settings} icon="settings" active={screen === 'settings'} onPress={goSettings} />
        </View>
      ) : null}

      {detailsItem ? (
        <MediaDetailsModal
          item={detailsItem}
          favorite={Boolean(detailsFavorite && !detailsFavorite.deletedAt)}
          knownPlayable={detailsKnownPlayable}
          onPlay={item => void handlePlayItem(item)}
          onOpenSources={goSettings}
          onToggleFavorite={() => toggleFavorite(detailsItem.id)}
          onClose={() => setDetailsItem(null)}
        />
      ) : null}

      {pendingEpisodes ? (
        <EpisodePickerModal
          series={pendingEpisodes.series}
          episodes={pendingEpisodes.episodes}
          onChoose={video => { const item = mediaItemForEpisode(pendingEpisodes.series, video); setPendingEpisodes(null); void resolveStreamsFor(item); }}
          onClose={() => setPendingEpisodes(null)}
        />
      ) : null}

      {selectedYouTube ? <YouTubePlayerModal videoId={selectedYouTube.id} title={selectedYouTube.title} channelTitle={selectedYouTube.channelTitle} onClose={() => setSelectedYouTube(null)} /> : null}
      {selected?.streamUrl ? <PlayerModal item={selected} progress={state.progress[selected.id]} favorite={Boolean(selectedFavorite && !selectedFavorite.deletedAt)} onProgress={handleProgress} onToggleFavorite={() => toggleFavorite(selected.id)} onClose={() => setSelected(null)} /> : null}
    </SafeAreaView>
  );
}

export default function App() {
  return <DeviceModeProvider><FilmaProvider><DropboxSyncProvider><FilmaApp /></DropboxSyncProvider></FilmaProvider></DeviceModeProvider>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  loading: { flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', gap: 22 },
  tvNav: { minHeight: 82, paddingHorizontal: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#090c14', borderBottomWidth: 1, borderBottomColor: theme.border, zIndex: 10 },
  mobileHeader: { minHeight: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#090c14', borderBottomWidth: 1, borderBottomColor: '#1d2432', gap: 10 },
  mobileHeaderActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexShrink: 1 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  brandMark: { width: Platform.isTV ? 38 : 30, height: Platform.isTV ? 38 : 30, borderRadius: 10, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#fff', fontWeight: '900', fontSize: Platform.isTV ? 20 : 16 },
  brand: { color: theme.text, fontWeight: '900', fontSize: Platform.isTV ? 29 : 20, letterSpacing: 2 },
  screenLabel: { color: theme.muted, fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  navButtons: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bottomNav: { minHeight: 70, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 4, flexDirection: 'row', gap: 2, backgroundColor: '#090c14', borderTopWidth: 1, borderTopColor: '#202737' },
  resolveBar: { minHeight: 48, paddingHorizontal: Platform.isTV ? 48 : 16, backgroundColor: theme.surface, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  resolveText: { color: theme.text, fontWeight: '700', flex: 1 },
  errorBar: { minHeight: 58, paddingHorizontal: Platform.isTV ? 48 : 14, paddingVertical: 8, backgroundColor: '#3b1018', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  errorText: { flex: 1, color: '#fecdd3', fontWeight: '700' },
  noticeBar: { minHeight: 62, paddingHorizontal: Platform.isTV ? 48 : 14, paddingVertical: 9, backgroundColor: '#172033', borderBottomWidth: 1, borderBottomColor: '#33415d', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  noticeText: { flex: 1, minWidth: 190, color: '#d7dfec', fontWeight: '700', fontSize: 12 },
  noticeActions: { flexDirection: 'row', gap: 6 },
  content: { flex: 1 },
});
