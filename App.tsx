import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { stringsFor } from './src/i18n';
import { HomeScreen } from './src/screens/HomeScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { LiveTvScreen } from './src/screens/LiveTvScreen';
import { SearchScreen } from './src/screens/SearchScreen';
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

type Screen = 'home' | 'search' | 'library' | 'profile' | 'live' | 'youtube' | 'settings';
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
  retry: string;
  sourcesOptional: string;
};

function playbackCopyFor(language: AppLanguage): PlaybackCopy {
  if (language === 'fr') {
    return {
      noEnabledSource: 'Aucune source de lecture automatique n’est disponible pour ce titre.',
      manifestsUnavailable: 'FILMA n’a pas pu contacter les sources de lecture. Vérifiez la connexion et réessayez.',
      noStreamResource: 'Le titre est disponible dans le catalogue, mais aucune lecture n’est disponible.',
      noCompatibleProvider: 'Aucune lecture compatible n’est actuellement disponible pour ce titre.',
      noProviderResponse: 'Aucune disponibilité de lecture n’a été renvoyée pour ce titre.',
      indirectEntries: count => `${count} option${count === 1 ? '' : 's'} externe${count === 1 ? '' : 's'} détectée${count === 1 ? '' : 's'}, mais aucune lecture directe dans FILMA.`,
      noPlayableStream: 'Aucune lecture n’est disponible pour le moment.',
      missingMediaIdentity: 'Ce contenu ne fournit pas un identifiant compatible avec FILMA.',
      resolveFailed: 'FILMA n’a pas pu vérifier la lecture.',
      youtubeOpenFailed: 'FILMA n’a pas pu ouvrir cette vidéo YouTube.',
      youtubeAppleTvUnavailable: 'YouTube ne peut pas être ouvert sur cet Apple TV.',
      itemNotPlayable: 'Ce contenu ne fournit pas de source de lecture.',
      noEpisodes: 'Aucun épisode n’est disponible pour cette série.',
      episodesFailed: 'FILMA n’a pas pu charger les épisodes de cette série.',
      retry: 'Rechercher à nouveau',
      sourcesOptional: 'Sources avancées',
    };
  }
  if (language === 'sq') {
    return {
      noEnabledSource: 'Nuk ka burim automatik luajtjeje për këtë titull.',
      manifestsUnavailable: 'FILMA nuk arriti të kontaktojë burimet e luajtjes. Kontrollo internetin dhe provo përsëri.',
      noStreamResource: 'Titulli është në katalog, por nuk ka luajtje të disponueshme.',
      noCompatibleProvider: 'Nuk ka luajtje të përputhshme për këtë titull.',
      noProviderResponse: 'Nuk u kthye asnjë mundësi luajtjeje për këtë titull.',
      indirectEntries: count => `U gjetën ${count} opsione të jashtme, por jo transmetim direkt në FILMA.`,
      noPlayableStream: 'Nuk ka luajtje të disponueshme për momentin.',
      missingMediaIdentity: 'Kjo përmbajtje nuk ka identitet të përputhshëm me FILMA.',
      resolveFailed: 'FILMA nuk arriti të kontrollojë luajtjen.',
      youtubeOpenFailed: 'FILMA nuk arriti ta hapë këtë video në YouTube.',
      youtubeAppleTvUnavailable: 'YouTube nuk mund të hapet në këtë Apple TV.',
      itemNotPlayable: 'Kjo përmbajtje nuk ka burim luajtjeje.',
      noEpisodes: 'Nuk ka episode të disponueshme për këtë serial.',
      episodesFailed: 'FILMA nuk arriti të ngarkojë episodet.',
      retry: 'Kërko përsëri',
      sourcesOptional: 'Burime të avancuara',
    };
  }
  return {
    noEnabledSource: 'No automatic playback source is currently available for this title.',
    manifestsUnavailable: 'FILMA could not contact playback sources. Check the connection and try again.',
    noStreamResource: 'This title is in the catalogue, but no playback is available.',
    noCompatibleProvider: 'No compatible playback is currently available for this title.',
    noProviderResponse: 'No playback availability was returned for this title.',
    indirectEntries: count => `${count} external option${count === 1 ? '' : 's'} found, but no direct playback in FILMA.`,
    noPlayableStream: 'No playback is available right now.',
    missingMediaIdentity: 'This content does not provide an identity compatible with FILMA.',
    resolveFailed: 'FILMA could not check playback.',
    youtubeOpenFailed: 'FILMA could not open this YouTube video.',
    youtubeAppleTvUnavailable: 'YouTube cannot be opened on this Apple TV.',
    itemNotPlayable: 'This content does not provide a playback source.',
    noEpisodes: 'No episodes are available for this series.',
    episodesFailed: 'FILMA could not load the episode list.',
    retry: 'Search again',
    sourcesOptional: 'Advanced sources',
  };
}

function mobileCopy(language: AppLanguage) {
  if (language === 'fr') return { home: 'Accueil', search: 'Rechercher', library: 'Bibliothèque', profile: 'Profil' };
  if (language === 'sq') return { home: 'Kryefaqja', search: 'Kërko', library: 'Biblioteka', profile: 'Profili' };
  return { home: 'Home', search: 'Search', library: 'Library', profile: 'Profile' };
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
  const nav = useMemo(() => mobileCopy(state.preferences.appLanguage), [state.preferences.appLanguage]);
  const playbackCopy = useMemo(() => playbackCopyFor(state.preferences.appLanguage), [state.preferences.appLanguage]);
  const [screen, setScreen] = useState<Screen>('home');
  const screenHistoryRef = useRef<Screen[]>([]);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [detailsItem, setDetailsItem] = useState<MediaItem | null>(null);
  const [selectedYouTube, setSelectedYouTube] = useState<YouTubeVideo | null>(null);
  const [pendingEpisodes, setPendingEpisodes] = useState<PendingEpisodes | null>(null);
  const [pendingRetryItem, setPendingRetryItem] = useState<MediaItem | null>(null);
  const [resolvingTitle, setResolvingTitle] = useState<string>();
  const [playbackError, setPlaybackError] = useState<string>();
  const [availabilityNotice, setAvailabilityNotice] = useState<string>();

  const clearAvailability = useCallback(() => {
    setAvailabilityNotice(undefined);
    setPendingRetryItem(null);
  }, []);

  const navigateTo = useCallback((next: Screen) => {
    setScreen(current => {
      if (next !== current) screenHistoryRef.current.push(current);
      return next;
    });
  }, []);

  const goHome = () => { clearAvailability(); setMode('movies'); navigateTo('home'); };
  const goSearch = () => { clearAvailability(); setMode('movies'); navigateTo('search'); };
  const goLibrary = () => { clearAvailability(); setMode('movies'); navigateTo('library'); };
  const goProfile = () => { setDetailsItem(null); clearAvailability(); navigateTo('profile'); };
  const goLive = () => { clearAvailability(); setMode('live'); navigateTo('live'); };
  const goYouTube = () => { if (isTvMode) { clearAvailability(); navigateTo('youtube'); } };
  const goSettings = () => { setDetailsItem(null); clearAvailability(); navigateTo(Platform.isTV ? 'settings' : 'profile'); };

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selected) { setSelected(null); return true; }
      if (selectedYouTube) { setSelectedYouTube(null); return true; }
      if (pendingEpisodes) { setPendingEpisodes(null); return true; }
      if (detailsItem) { setDetailsItem(null); return true; }
      if (playbackError) { setPlaybackError(undefined); return true; }
      if (availabilityNotice) { clearAvailability(); return true; }
      if (resolvingTitle) return true;

      const previous = screenHistoryRef.current.pop();
      if (previous) {
        clearAvailability();
        if (previous === 'live') setMode('live'); else setMode('movies');
        setScreen(previous);
        return true;
      }

      if (screen !== 'home') {
        clearAvailability();
        setMode('movies');
        setScreen('home');
        return true;
      }

      return true;
    });

    return () => subscription.remove();
  }, [availabilityNotice, clearAvailability, detailsItem, pendingEpisodes, playbackError, resolvingTitle, screen, selected, selectedYouTube, setMode]);

  const resolveStreamsFor = async (item: MediaItem, force = false) => {
    if (item.source?.kind !== 'stremio') {
      setPlaybackError(playbackCopy.missingMediaIdentity);
      return;
    }
    setPlaybackError(undefined);
    setAvailabilityNotice(undefined);
    setPendingRetryItem(null);
    setResolvingTitle(item.title);
    try {
      const resolution = await resolveStreamsAcrossAddons(item, state.addons, state.preferences.preferredAudioLanguages, force);
      const best = resolution.streams[0];
      if (!best) {
        setPendingRetryItem(item);
        setAvailabilityNotice(resolutionMessage(resolution.diagnostics, playbackCopy));
        return;
      }
      setSelected({ ...item, streamUrl: best.url });
    } catch (error) {
      setPendingRetryItem(item);
      setAvailabilityNotice(error instanceof Error && error.message ? `${playbackCopy.resolveFailed} ${error.message}` : playbackCopy.resolveFailed);
    } finally {
      setResolvingTitle(undefined);
    }
  };

  const handleYouTubeVideo = async (video: YouTubeVideo) => {
    setPlaybackError(undefined);
    clearAvailability();
    if (Platform.OS === 'android') {
      setSelectedYouTube(video);
      return;
    }
    const watchUrl = youtubeWatchUrl(video.id);
    if (isTvMode && Platform.OS === 'ios') {
      try {
        const canOpen = await Linking.canOpenURL(watchUrl);
        if (!canOpen) { setPlaybackError(playbackCopy.youtubeAppleTvUnavailable); return; }
        await Linking.openURL(watchUrl);
      } catch {
        setPlaybackError(playbackCopy.youtubeAppleTvUnavailable);
      }
      return;
    }
    try { await Linking.openURL(watchUrl); } catch { setPlaybackError(playbackCopy.youtubeOpenFailed); }
  };

  const handlePlayItem = async (item: MediaItem) => {
    setDetailsItem(null);
    setPlaybackError(undefined);
    clearAvailability();
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
        if (!episodes.length) { setAvailabilityNotice(playbackCopy.noEpisodes); return; }
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
    clearAvailability();
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
  const mobilePrimary = screen === 'live' ? 'library' : screen;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" hidden={Platform.isTV} />

      {Platform.isTV ? (
        <View style={styles.tvNav}>
          <View style={styles.brandRow}><View style={styles.brandMark}><Text style={styles.brandMarkText}>F</Text></View><Text style={styles.brand}>FILMA</Text></View>
          <View style={styles.navButtons}>
            <FocusButton compact label={text.movies} active={screen === 'home'} onPress={goHome} />
            <FocusButton compact label={text.liveTv} active={screen === 'live'} onPress={goLive} />
            <FocusButton compact label={text.youtube} active={screen === 'youtube'} onPress={goYouTube} />
            <ProfileSwitcher />
            <FocusButton compact label={text.settings} active={screen === 'settings'} onPress={goSettings} />
          </View>
        </View>
      ) : null}

      {playbackError ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{playbackError}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={text.dismiss} hitSlop={10} onPress={() => setPlaybackError(undefined)}><Text style={styles.closeNotice}>×</Text></Pressable>
        </View>
      ) : null}

      {availabilityNotice ? (
        <View style={styles.noticeBar}>
          <Text style={styles.noticeText}>{availabilityNotice}</Text>
          <View style={styles.noticeActions}>
            {pendingRetryItem ? <FocusButton compact active label={playbackCopy.retry} onPress={() => void resolveStreamsFor(pendingRetryItem, true)} /> : null}
            {pendingRetryItem ? <FocusButton compact label={playbackCopy.sourcesOptional} onPress={goSettings} /> : null}
            <Pressable accessibilityRole="button" accessibilityLabel={text.dismiss} hitSlop={10} onPress={clearAvailability}><Text style={styles.closeNotice}>×</Text></Pressable>
          </View>
        </View>
      ) : null}

      {resolvingTitle ? <View style={styles.resolveBar}><ActivityIndicator size="small" /><Text numberOfLines={1} style={styles.resolveText}>{text.loading} {resolvingTitle}…</Text></View> : null}

      <View style={styles.content}>
        {screen === 'home' ? <HomeScreen onSelect={handleBrowseSelect} onOpenYouTubeVideo={video => void handleYouTubeVideo(video)} onOpenSettings={goSettings} /> : null}
        {screen === 'search' ? <SearchScreen onSelect={handleBrowseSelect} /> : null}
        {screen === 'library' ? <LibraryScreen onSelect={handleBrowseSelect} onOpenLiveTv={goLive} /> : null}
        {screen === 'profile' ? <SettingsScreen /> : null}
        {screen === 'live' ? <LiveTvScreen onSelect={item => void handleLiveSelect(item)} onOpenSettings={goSettings} /> : null}
        {screen === 'youtube' && isTvMode ? <YouTubeScreen onOpenVideo={video => void handleYouTubeVideo(video)} /> : null}
        {screen === 'settings' ? <SettingsScreen /> : null}
      </View>

      {!Platform.isTV ? (
        <View style={styles.bottomNav}>
          <NavTab label={nav.home} icon="home" active={mobilePrimary === 'home'} onPress={goHome} />
          <NavTab label={nav.search} icon="search" active={mobilePrimary === 'search'} onPress={goSearch} />
          <NavTab label={nav.library} icon="library" active={mobilePrimary === 'library'} onPress={goLibrary} />
          <NavTab label={nav.profile} icon="profile" active={mobilePrimary === 'profile'} onPress={goProfile} />
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
  safe: { flex: 1, backgroundColor: '#080808' },
  loading: { flex: 1, backgroundColor: '#080808', alignItems: 'center', justifyContent: 'center', gap: 22 },
  tvNav: { minHeight: 82, paddingHorizontal: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#090c14', borderBottomWidth: 1, borderBottomColor: theme.border, zIndex: 10 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  brandMark: { width: 38, height: 38, borderRadius: 10, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#fff', fontWeight: '900', fontSize: 20 },
  brand: { color: theme.text, fontWeight: '900', fontSize: Platform.isTV ? 29 : 23, letterSpacing: 2 },
  navButtons: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bottomNav: { position: 'absolute', left: 12, right: 12, bottom: 8, minHeight: 70, padding: 5, flexDirection: 'row', gap: 2, backgroundColor: 'rgba(29,29,30,0.96)', borderWidth: 1, borderColor: '#3a3a3d', borderRadius: 34, overflow: 'hidden', zIndex: 40 },
  resolveBar: { minHeight: 46, paddingHorizontal: Platform.isTV ? 48 : 16, backgroundColor: '#151516', flexDirection: 'row', alignItems: 'center', gap: 12 },
  resolveText: { color: '#ededee', fontWeight: '700', flex: 1 },
  errorBar: { minHeight: 54, paddingHorizontal: Platform.isTV ? 48 : 16, paddingVertical: 8, backgroundColor: '#3b1018', flexDirection: 'row', alignItems: 'center', gap: 12 },
  errorText: { flex: 1, color: '#fecdd3', fontWeight: '700' },
  noticeBar: { minHeight: 58, paddingHorizontal: Platform.isTV ? 48 : 16, paddingVertical: 8, backgroundColor: '#181a1f', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  noticeText: { flex: 1, minWidth: 190, color: '#d7d9de', fontWeight: '700', fontSize: 12 },
  noticeActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  closeNotice: { color: '#e8e8e9', fontSize: 28, lineHeight: 29, fontWeight: '300', paddingHorizontal: 4 },
  content: { flex: 1 },
});
