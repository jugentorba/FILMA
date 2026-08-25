import { useEventListener } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, Linking, Modal, Platform, Pressable, SafeAreaView, StyleSheet, Text, useTVEventHandler, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { stringsFor } from '../i18n';
import { resolvedStreamsForItem } from '../services/streamResolver';
import { useFilma } from '../store/FilmaContext';
import type { AppLanguage, AudioLanguage, LiveChannel, MediaItem, WatchProgress } from '../types';
import { FocusButton } from './FocusButton';
import { theme } from './theme';
import { useResponsiveLayout } from './useResponsiveLayout';

type Props = {
  item: MediaItem;
  progress?: WatchProgress;
  onProgress(positionSeconds: number, durationSeconds: number): void;
  onClose(): void;
  onToggleFavorite(): void;
  favorite: boolean;
  onPreviousChannel?(): void;
  onNextChannel?(): void;
  channelPosition?: string;
  channelQueue?: LiveChannel[];
  channelIndex?: number;
  onSelectChannel?(index: number): void;
};

type LanguageTrack = {
  language: string;
  label: string;
  name?: string;
  isDefault?: boolean;
  autoSelect?: boolean;
};

const PLAYBACK_START_TIMEOUT_MS = 15_000;
const EXTERNAL_PROVIDER_PREFIX = 'external-provider:';

const LANGUAGE_ALIASES: Record<AppLanguage | AudioLanguage, string[]> = {
  en: ['en', 'eng', 'english', 'anglais', 'anglisht'],
  fr: ['fr', 'fra', 'fre', 'french', 'francais', 'français', 'frengjisht'],
  sq: ['sq', 'sqi', 'alb', 'albanian', 'shqip', 'albanais'],
  it: ['it', 'ita', 'italian', 'italiano', 'italien'],
  es: ['es', 'spa', 'spanish', 'espanol', 'español', 'espagnol'],
  de: ['de', 'deu', 'ger', 'german', 'deutsch', 'allemand'],
  tr: ['tr', 'tur', 'turkish', 'turkce', 'türkçe', 'turc'],
};

function externalProviderUrl(value?: string): string | undefined {
  if (!value?.startsWith(EXTERNAL_PROVIDER_PREFIX)) return undefined;
  try {
    return decodeURIComponent(value.slice(EXTERNAL_PROVIDER_PREFIX.length));
  } catch {
    return undefined;
  }
}

function normalizeLanguage(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase()
    .replace(/_/g, '-');
}

function trackText(track: LanguageTrack): string {
  return normalizeLanguage([track.language, track.label, track.name].filter(Boolean).join(' '));
}

function trackMatches(track: LanguageTrack, language: AppLanguage | AudioLanguage): boolean {
  const text = trackText(track);
  const primary = normalizeLanguage(track.language).split('-')[0];
  return LANGUAGE_ALIASES[language].some(alias => {
    const normalizedAlias = normalizeLanguage(alias);
    return primary === normalizedAlias || text.includes(normalizedAlias);
  });
}

function bestLanguageTrack<T extends LanguageTrack>(
  tracks: T[],
  languages: Array<AppLanguage | AudioLanguage>,
  allowAnyFallback: boolean,
): T | undefined {
  for (const language of languages) {
    const match = tracks.find(track => trackMatches(track, language));
    if (match) return match;
  }
  if (!allowAnyFallback) return tracks.find(track => track.isDefault || track.autoSelect);
  return tracks.find(track => track.isDefault || track.autoSelect) ?? tracks[0];
}

export function PlayerModal({
  item,
  progress,
  onProgress,
  onClose,
  onToggleFavorite,
  favorite,
  onPreviousChannel,
  onNextChannel,
  channelPosition,
  channelQueue = [],
  channelIndex = 0,
  onSelectChannel,
}: Props) {
  const { state } = useFilma();
  const layout = useResponsiveLayout();
  const text = stringsFor(state.preferences.appLanguage);
  const isLive = item.id.startsWith('live:');
  const initialExternalProvider = externalProviderUrl(item.streamUrl);
  const progressHandler = useRef(onProgress);
  progressHandler.current = onProgress;
  const replacingRef = useRef(false);
  const failedUrlsRef = useRef(new Set<string>());
  const currentUrlRef = useRef(item.streamUrl ?? '');
  const lastKnownPositionRef = useRef(progress?.completed ? 0 : (progress?.positionSeconds ?? 0));
  const channelListRef = useRef<FlatList<LiveChannel>>(null);
  const [sourceMessage, setSourceMessage] = useState<string>();
  const [terminalError, setTerminalError] = useState<string>();
  const [sourceAttempt, setSourceAttempt] = useState(0);
  const [sourceReady, setSourceReady] = useState(Boolean(initialExternalProvider));
  const [channelPickerOpen, setChannelPickerOpen] = useState(false);
  const [customControlFocused, setCustomControlFocused] = useState(false);

  const copy = useMemo(() => state.preferences.appLanguage === 'fr'
    ? {
        trying: (current: number, total: number) => `Essai d’une autre source (${current}/${total})…`,
        failed: isLive
          ? 'FILMA a essayé toutes les sources disponibles pour cette chaîne, mais aucune ne fonctionne.'
          : 'FILMA a essayé toutes les sources disponibles, mais aucune ne peut lire ce titre.',
        timeout: 'Cette source met trop de temps à démarrer. FILMA essaie la suivante.',
        nextSource: 'Source suivante',
        previousChannel: 'Chaîne préc.',
        nextChannel: 'Chaîne suiv.',
        channels: 'Chaînes',
        channelHint: 'OK ouvre cette liste · Haut/Bas change de chaîne',
        openingProvider: 'Ouverture du fournisseur…',
        providerFailed: 'FILMA n’a pas pu ouvrir ce fournisseur.',
        player: isLive ? 'TV en direct · FILMA' : 'Lecteur FILMA',
      }
    : state.preferences.appLanguage === 'sq'
      ? {
          trying: (current: number, total: number) => `Po provohet një burim tjetër (${current}/${total})…`,
          failed: isLive
            ? 'FILMA provoi të gjitha burimet e disponueshme për këtë kanal, por asnjëri nuk funksionoi.'
            : 'FILMA provoi të gjitha burimet e disponueshme, por asnjëri nuk mund ta luajë këtë titull.',
          timeout: 'Ky burim po vonon shumë për të nisur. FILMA po provon tjetrin.',
          nextSource: 'Burimi tjetër',
          previousChannel: 'Kanali para',
          nextChannel: 'Kanali tjetër',
          channels: 'Kanalet',
          channelHint: 'OK hap listën · Lart/Poshtë ndërron kanalin',
          openingProvider: 'Po hapet ofruesi…',
          providerFailed: 'FILMA nuk arriti ta hapë këtë ofrues.',
          player: isLive ? 'TV Live · FILMA' : 'Luajtësi FILMA',
        }
      : {
          trying: (current: number, total: number) => `Trying another source (${current}/${total})…`,
          failed: isLive
            ? 'FILMA tried every available source for this channel, but none could play it.'
            : 'FILMA tried every available provider, but none could play this title.',
          timeout: 'This source is taking too long to start. FILMA is trying the next one.',
          nextSource: 'Next source',
          previousChannel: 'Previous channel',
          nextChannel: 'Next channel',
          channels: 'Channels',
          channelHint: 'OK opens this list · Up/Down changes channel',
          openingProvider: 'Opening provider…',
          providerFailed: 'FILMA could not open this provider.',
          player: isLive ? 'Live TV · FILMA' : 'FILMA player',
        }, [isLive, state.preferences.appLanguage]);

  const candidateUrls = useMemo(() => {
    const urls = [
      item.streamUrl,
      ...(item.alternateStreamUrls ?? []),
      ...resolvedStreamsForItem(item.id).map(stream => stream.url),
    ].filter((url): url is string => Boolean(url));
    return [...new Set(urls)];
  }, [item.alternateStreamUrls, item.id, item.streamUrl]);

  const player = useVideoPlayer(initialExternalProvider ? null : (item.streamUrl ?? null), instance => {
    instance.timeUpdateEventInterval = 5;
    if (!initialExternalProvider) {
      if (!progress?.completed && progress?.positionSeconds && progress.positionSeconds > 5) {
        instance.currentTime = progress.positionSeconds;
      }
      instance.play();
    }
  });

  const openExternalProvider = useCallback(async (url: string) => {
    setTerminalError(undefined);
    setSourceMessage(copy.openingProvider);
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) throw new Error('Unsupported provider URL');
      await Linking.openURL(url);
      setSourceMessage(undefined);
      setSourceReady(true);
      onClose();
    } catch {
      setSourceMessage(undefined);
      setTerminalError(copy.providerFailed);
    }
  }, [copy.openingProvider, copy.providerFailed, onClose]);

  const switchToNextCandidate = useCallback(async (reason?: string) => {
    if (replacingRef.current) return;
    replacingRef.current = true;

    try {
      while (true) {
        const currentUrl = currentUrlRef.current;
        if (currentUrl) failedUrlsRef.current.add(currentUrl);
        const nextUrl = candidateUrls.find(url => !failedUrlsRef.current.has(url));

        if (!nextUrl) {
          setSourceMessage(undefined);
          setSourceReady(false);
          setTerminalError(reason || copy.failed);
          return;
        }

        const nextNumber = candidateUrls.indexOf(nextUrl) + 1;
        setTerminalError(undefined);
        setSourceReady(false);
        setSourceMessage(copy.trying(nextNumber, candidateUrls.length));

        const external = externalProviderUrl(nextUrl);
        if (external) {
          currentUrlRef.current = nextUrl;
          replacingRef.current = false;
          await openExternalProvider(external);
          return;
        }

        try {
          const resumeAt = Math.max(lastKnownPositionRef.current, progress?.completed ? 0 : (progress?.positionSeconds ?? 0));
          await player.replaceAsync(nextUrl);
          currentUrlRef.current = nextUrl;
          if (!isLive && resumeAt > 5) player.currentTime = resumeAt;
          player.play();
          setSourceAttempt(value => value + 1);
          return;
        } catch (error) {
          failedUrlsRef.current.add(nextUrl);
          reason = error instanceof Error ? error.message : reason;
        }
      }
    } finally {
      replacingRef.current = false;
    }
  }, [candidateUrls, copy.failed, copy.trying, isLive, openExternalProvider, player, progress?.completed, progress?.positionSeconds]);

  const manuallyTryNextSource = useCallback(() => {
    const currentUrl = currentUrlRef.current;
    const remainingOtherSource = candidateUrls.some(url => url !== currentUrl && !failedUrlsRef.current.has(url));
    if (!remainingOtherSource) failedUrlsRef.current.clear();
    setTerminalError(undefined);
    setSourceReady(false);
    void switchToNextCandidate();
  }, [candidateUrls, switchToNextCandidate]);

  const chooseChannel = useCallback((index: number) => {
    if (!onSelectChannel || !channelQueue[index]) return;
    onSelectChannel(index);
    setChannelPickerOpen(false);
  }, [channelQueue, onSelectChannel]);

  useTVEventHandler(event => {
    if (!Platform.isTV || !isLive || customControlFocused) return;

    if (channelPickerOpen) {
      if (event.eventType === 'menu') setChannelPickerOpen(false);
      return;
    }

    if (event.eventType === 'select' && channelQueue.length) {
      setChannelPickerOpen(true);
      return;
    }
    if (event.eventType === 'up') {
      onPreviousChannel?.();
      return;
    }
    if (event.eventType === 'down') {
      onNextChannel?.();
    }
  });

  useEventListener(player, 'sourceLoad', ({ availableAudioTracks, availableSubtitleTracks }) => {
    if (Platform.OS === 'web' || (Platform.OS === 'ios' && Platform.isTV)) return;

    const audioPreferences = state.preferences.preferredAudioLanguages;
    if (audioPreferences.length && availableAudioTracks.length) {
      const preferredAudio = bestLanguageTrack(availableAudioTracks, audioPreferences, false);
      if (preferredAudio) player.audioTrack = preferredAudio;
    }

    if (availableSubtitleTracks.length) {
      const subtitlePreferences = [
        state.preferences.appLanguage,
        ...state.preferences.preferredAudioLanguages.filter(language => language !== state.preferences.appLanguage),
      ];
      const preferredSubtitle = bestLanguageTrack(availableSubtitleTracks, subtitlePreferences, true);
      if (preferredSubtitle) player.subtitleTrack = preferredSubtitle;
    }
  });

  useEventListener(player, 'statusChange', ({ status, error }) => {
    if (initialExternalProvider) return;
    if (status === 'readyToPlay') {
      setSourceReady(true);
      setSourceMessage(undefined);
      setTerminalError(undefined);
      return;
    }
    if (status === 'error') {
      setSourceReady(false);
      void switchToNextCandidate(error?.message);
    }
  });

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (Number.isFinite(currentTime)) lastKnownPositionRef.current = Math.max(0, currentTime);
    if (!isLive && Number.isFinite(currentTime) && Number.isFinite(player.duration) && player.duration > 0) {
      progressHandler.current(currentTime, player.duration);
    }
  });

  useEffect(() => {
    if (!initialExternalProvider) return;
    void openExternalProvider(initialExternalProvider);
  }, [initialExternalProvider, openExternalProvider]);

  useEffect(() => {
    if (initialExternalProvider || sourceReady || terminalError || !currentUrlRef.current) return;
    const timer = setTimeout(() => {
      void switchToNextCandidate(copy.timeout);
    }, PLAYBACK_START_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [copy.timeout, initialExternalProvider, sourceAttempt, sourceReady, switchToNextCandidate, terminalError]);

  useEffect(() => () => {
    if (!isLive && !initialExternalProvider && Number.isFinite(player.currentTime) && Number.isFinite(player.duration) && player.duration > 0) {
      progressHandler.current(player.currentTime, player.duration);
    }
  }, [initialExternalProvider, isLive, player]);

  const controlFocusProps = isLive
    ? { onFocus: () => setCustomControlFocused(true), onBlur: () => setCustomControlFocused(false) }
    : {};

  const densityFactor = state.preferences.interfaceDensity === 'comfortable' ? 1.05 : 0.94;
  const channelRowHeight = Math.round((layout.isTv ? 62 : layout.isCompactPhone ? 50 : layout.isTablet ? 58 : 54) * densityFactor);
  const statusBannerStyle = useMemo(() => ({
    left: layout.horizontalPadding,
    right: layout.horizontalPadding,
    bottom: layout.isTv ? 30 : layout.isCompactPhone ? 10 : 15,
    paddingHorizontal: layout.isCompactPhone ? 10 : 14,
    paddingVertical: layout.isCompactPhone ? 8 : 10,
    borderRadius: layout.isCompactPhone ? 10 : 12,
  }), [layout.horizontalPadding, layout.isCompactPhone, layout.isTv]);
  const topBarStyle = useMemo(() => ({
    top: layout.isTv ? 22 : 6,
    left: layout.horizontalPadding,
    right: layout.horizontalPadding,
    padding: layout.isTv ? 8 : layout.isCompactPhone ? 5 : 7,
    borderRadius: layout.isCompactPhone ? 10 : 12,
    gap: layout.isCompactPhone ? 5 : 8,
  }), [layout.horizontalPadding, layout.isCompactPhone, layout.isTv]);
  const titleStyle = useMemo(() => ({
    fontSize: layout.isTv ? 19 : layout.isCompactPhone ? 12 : layout.isTablet ? 16 : 14,
  }), [layout.isCompactPhone, layout.isTablet, layout.isTv]);
  const subtitleStyle = useMemo(() => ({
    fontSize: layout.isTv ? 12 : layout.isCompactPhone ? 9 : 10,
  }), [layout.isCompactPhone, layout.isTv]);
  const actionsStyle = useMemo(() => ({
    gap: layout.isCompactPhone ? 4 : 6,
  }), [layout.isCompactPhone]);
  const channelPanelStyle = useMemo<ViewStyle>(() => ({
    width: layout.isTv ? 460 : layout.isTablet ? '58%' : '88%',
    maxWidth: layout.isTv ? 500 : 460,
    paddingTop: layout.isTv ? 34 : layout.isCompactPhone ? 18 : 24,
    paddingHorizontal: layout.isTv ? 18 : layout.isCompactPhone ? 10 : 13,
  }), [layout.isCompactPhone, layout.isTablet, layout.isTv]);
  const channelTitleStyle = useMemo(() => ({
    fontSize: layout.isTv ? 25 : layout.isCompactPhone ? 17 : layout.isTablet ? 22 : 20,
  }), [layout.isCompactPhone, layout.isTablet, layout.isTv]);
  const channelHintStyle = useMemo(() => ({
    fontSize: layout.isTv ? 12 : layout.isCompactPhone ? 9 : 10,
    marginBottom: layout.isCompactPhone ? 8 : 12,
  }), [layout.isCompactPhone, layout.isTv]);
  const channelOptionStyle = useMemo(() => ({
    minHeight: Math.max(40, channelRowHeight - 6),
    marginBottom: 6,
    borderRadius: layout.isCompactPhone ? 9 : 11,
    paddingHorizontal: layout.isCompactPhone ? 7 : 9,
  }), [channelRowHeight, layout.isCompactPhone]);
  const channelLogoStyle = useMemo(() => {
    const size = layout.isTv ? 42 : layout.isCompactPhone ? 32 : layout.isTablet ? 40 : 36;
    return { width: size, height: size, borderRadius: layout.isCompactPhone ? 7 : 8, marginRight: layout.isCompactPhone ? 7 : 9 };
  }, [layout.isCompactPhone, layout.isTablet, layout.isTv]);
  const channelNameStyle = useMemo(() => ({
    fontSize: layout.isTv ? 16 : layout.isCompactPhone ? 12 : layout.isTablet ? 15 : 13,
  }), [layout.isCompactPhone, layout.isTablet, layout.isTv]);
  const channelMetaStyle = useMemo(() => ({
    fontSize: layout.isTv ? 11 : layout.isCompactPhone ? 9 : 10,
  }), [layout.isCompactPhone, layout.isTv]);

  const channelsLabel = layout.isCompactPhone ? '☰' : copy.channels;
  const previousLabel = layout.isCompactPhone ? '‹' : `‹ ${copy.previousChannel}`;
  const nextLabel = layout.isCompactPhone ? '›' : `${copy.nextChannel} ›`;
  const nextSourceLabel = layout.isCompactPhone ? '↻' : `↻ ${copy.nextSource}`;
  const favoriteLabel = layout.isCompactPhone ? (favorite ? '♥' : '♡') : `${favorite ? '♥' : '♡'} ${text.favorites}`;
  const closeLabel = layout.isCompactPhone ? '×' : text.dismiss;

  return (
    <Modal visible animationType="fade" supportedOrientations={['landscape', 'portrait']} onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        {!initialExternalProvider ? (
          <VideoView
            style={styles.video}
            player={player}
            nativeControls
            contentFit="contain"
            fullscreenOptions={{ enable: true }}
          />
        ) : <View style={styles.video} />}

        {sourceMessage || terminalError ? (
          <View style={[styles.statusBanner, statusBannerStyle, terminalError ? styles.errorBanner : undefined]}>
            <Text numberOfLines={2} style={[styles.statusText, layout.isCompactPhone && styles.statusTextCompact]}>{terminalError ?? sourceMessage}</Text>
          </View>
        ) : null}

        <View style={[styles.topBar, topBarStyle]}>
          <View style={styles.titleBlock}>
            <Text numberOfLines={1} style={[styles.title, titleStyle]}>{item.title}</Text>
            <Text numberOfLines={1} style={[styles.subtitle, subtitleStyle]}>
              {item.subtitle ?? copy.player}{channelPosition ? ` · ${channelPosition}` : ''}
            </Text>
          </View>
          <View style={[styles.actions, actionsStyle]}>
            {isLive && channelQueue.length ? (
              <FocusButton compact label={channelsLabel} accessibilityHint={copy.channels} onPress={() => setChannelPickerOpen(true)} {...controlFocusProps} />
            ) : null}
            {isLive && onPreviousChannel ? <FocusButton compact label={previousLabel} accessibilityHint={copy.previousChannel} onPress={onPreviousChannel} {...controlFocusProps} /> : null}
            {isLive && onNextChannel ? <FocusButton compact label={nextLabel} accessibilityHint={copy.nextChannel} onPress={onNextChannel} {...controlFocusProps} /> : null}
            {candidateUrls.length > 1 ? <FocusButton compact label={nextSourceLabel} accessibilityHint={copy.nextSource} onPress={manuallyTryNextSource} {...controlFocusProps} /> : null}
            {!isLive ? <FocusButton compact label={favoriteLabel} accessibilityHint={text.favorites} active={favorite} onPress={onToggleFavorite} /> : null}
            <FocusButton compact label={closeLabel} accessibilityHint={text.dismiss} onPress={onClose} {...controlFocusProps} />
          </View>
        </View>

        {channelPickerOpen && channelQueue.length ? (
          <View style={styles.channelOverlay}>
            <Pressable style={styles.channelOverlayBackdrop} onPress={() => setChannelPickerOpen(false)} />
            <View style={[styles.channelPanel, channelPanelStyle]}>
              <Text style={[styles.channelPanelTitle, channelTitleStyle]}>{copy.channels}</Text>
              <Text style={[styles.channelPanelHint, channelHintStyle]}>{copy.channelHint}</Text>
              <FlatList
                ref={channelListRef}
                data={channelQueue}
                keyExtractor={channel => channel.id}
                initialScrollIndex={Math.max(0, Math.min(channelIndex, channelQueue.length - 1))}
                getItemLayout={(_, index) => ({ length: channelRowHeight, offset: channelRowHeight * index, index })}
                onScrollToIndexFailed={({ index }) => {
                  channelListRef.current?.scrollToOffset({ offset: Math.max(0, index * channelRowHeight), animated: false });
                }}
                contentContainerStyle={styles.channelPanelList}
                renderItem={({ item: channel, index }) => {
                  const current = index === channelIndex;
                  return (
                    <Pressable
                      focusable
                      hasTVPreferredFocus={Platform.isTV && current}
                      accessibilityRole="button"
                      accessibilityLabel={channel.name}
                      onFocus={() => channelListRef.current?.scrollToIndex({ index, viewPosition: 0.48, animated: true })}
                      onPress={() => chooseChannel(index)}
                      style={({ focused }) => [
                        styles.channelOption,
                        channelOptionStyle,
                        current && styles.channelOptionCurrent,
                        focused && styles.channelOptionFocused,
                      ]}
                    >
                      <View style={[styles.channelOptionLogo, channelLogoStyle]}>
                        {channel.logo ? <Image source={{ uri: channel.logo }} style={styles.channelOptionLogoImage} resizeMode="contain" /> : null}
                      </View>
                      <View style={styles.channelOptionText}>
                        <Text numberOfLines={1} style={[styles.channelOptionName, channelNameStyle]}>{channel.name}</Text>
                        <Text numberOfLines={1} style={[styles.channelOptionMeta, channelMetaStyle]}>{channel.group ?? channel.country ?? 'Live TV'}</Text>
                      </View>
                      <Text style={[styles.channelOptionNumber, layout.isCompactPhone && styles.channelOptionNumberCompact]}>{index + 1}</Text>
                    </Pressable>
                  );
                }}
              />
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  video: { flex: 1, backgroundColor: '#000' },
  statusBanner: {
    position: 'absolute',
    backgroundColor: 'rgba(13,25,40,0.94)',
    borderWidth: 1,
    borderColor: theme.border,
  },
  errorBanner: { backgroundColor: 'rgba(59,16,24,0.96)' },
  statusText: { color: theme.text, fontWeight: '800', textAlign: 'center', fontSize: 13 },
  statusTextCompact: { fontSize: 11 },
  topBar: {
    position: 'absolute',
    backgroundColor: 'rgba(7,9,15,0.88)',
    borderWidth: 1,
    borderColor: theme.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleBlock: { flex: 1, minWidth: 0, marginRight: 8 },
  title: { color: theme.text, fontWeight: '800' },
  subtitle: { color: theme.muted, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end' },
  channelOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  channelOverlayBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  channelPanel: {
    height: '100%',
    backgroundColor: 'rgba(8,11,18,0.98)',
    borderLeftWidth: 1,
    borderLeftColor: theme.border,
  },
  channelPanelTitle: { color: theme.text, fontWeight: '900' },
  channelPanelHint: { color: theme.muted, marginTop: 4 },
  channelPanelList: { paddingBottom: 34 },
  channelOption: {
    borderWidth: 1,
    borderColor: '#242c3c',
    backgroundColor: '#111724',
    flexDirection: 'row',
    alignItems: 'center',
  },
  channelOptionCurrent: { borderColor: theme.accent, backgroundColor: '#21131a' },
  channelOptionFocused: { borderColor: '#ffffff', borderWidth: 2, transform: [{ scale: 1.012 }] },
  channelOptionLogo: {
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  channelOptionLogoImage: { width: '88%', height: '88%' },
  channelOptionText: { flex: 1, minWidth: 0 },
  channelOptionName: { color: theme.text, fontWeight: '800' },
  channelOptionMeta: { color: theme.muted, marginTop: 2 },
  channelOptionNumber: { color: theme.muted, fontSize: 11, marginLeft: 7, fontWeight: '700' },
  channelOptionNumberCompact: { fontSize: 9, marginLeft: 5 },
});