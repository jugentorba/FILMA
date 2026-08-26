import { useEventListener } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  useTVEventHandler,
  View,
} from 'react-native';
import type { ViewStyle } from 'react-native';
import { stringsFor } from '../i18n';
import { resolvedStreamsForItem } from '../services/streamResolver';
import { useFilma } from '../store/FilmaContext';
import type { AppLanguage, AudioLanguage, LiveChannel, MediaItem, WatchProgress } from '../types';
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

type PlayerButtonProps = {
  label: string;
  accessibilityLabel: string;
  onPress(): void;
  active?: boolean;
  preferredFocus?: boolean;
  onFocus?(): void;
  onBlur?(): void;
  wide?: boolean;
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

function PlayerButton({
  label,
  accessibilityLabel,
  onPress,
  active = false,
  preferredFocus = false,
  onFocus,
  onBlur,
  wide = false,
}: PlayerButtonProps) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      focusable
      hasTVPreferredFocus={Platform.isTV && preferredFocus}
      onPress={onPress}
      onFocus={() => { setFocused(true); onFocus?.(); }}
      onBlur={() => { setFocused(false); onBlur?.(); }}
      style={[
        styles.playerButton,
        wide && styles.playerButtonWide,
        active && styles.playerButtonActive,
        focused && styles.playerButtonFocused,
      ]}
    >
      <Text numberOfLines={1} style={[styles.playerButtonText, wide && styles.playerButtonTextWide]}>{label}</Text>
    </Pressable>
  );
}

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
        previousChannel: 'Chaîne précédente',
        nextChannel: 'Chaîne suivante',
        channels: 'Chaînes',
        channelHint: 'OK ouvre la liste · Haut/Bas change de chaîne',
        openingProvider: 'Ouverture du fournisseur…',
        providerFailed: 'FILMA n’a pas pu ouvrir ce fournisseur.',
        player: isLive ? 'TV en direct' : 'FILMA',
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
          player: isLive ? 'TV Live' : 'FILMA',
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
          channelHint: 'OK opens the list · Up/Down changes channel',
          openingProvider: 'Opening provider…',
          providerFailed: 'FILMA could not open this provider.',
          player: isLive ? 'Live TV' : 'FILMA',
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

  const requestClose = useCallback(() => {
    if (channelPickerOpen) {
      setChannelPickerOpen(false);
      return;
    }
    onClose();
  }, [channelPickerOpen, onClose]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      requestClose();
      return true;
    });
    return () => subscription.remove();
  }, [requestClose]);

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
    if (event.eventType === 'down') onNextChannel?.();
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
  const channelPanelStyle = useMemo<ViewStyle>(() => ({
    width: layout.isTv ? 460 : layout.isTablet ? '56%' : '88%',
    maxWidth: layout.isTv ? 500 : 460,
  }), [layout.isTablet, layout.isTv]);
  const titleSize = layout.isTv ? 20 : layout.isCompactPhone ? 13 : layout.isTablet ? 17 : 15;
  const subtitleSize = layout.isTv ? 12 : layout.isCompactPhone ? 9 : 10;
  const channelTitleSize = layout.isTv ? 25 : layout.isCompactPhone ? 17 : layout.isTablet ? 22 : 20;
  const compactDock = layout.isCompactPhone || (!layout.isTv && !layout.isTablet);

  const previousLabel = compactDock ? '‹' : `‹ ${copy.previousChannel}`;
  const nextLabel = compactDock ? '›' : `${copy.nextChannel} ›`;
  const nextSourceLabel = compactDock ? '↻' : `↻ ${copy.nextSource}`;

  return (
    <Modal
      visible
      animationType="fade"
      supportedOrientations={['landscape', 'portrait']}
      presentationStyle="fullScreen"
      onRequestClose={requestClose}
    >
      <View style={styles.root}>
        {!initialExternalProvider ? (
          <VideoView
            style={styles.video}
            player={player}
            nativeControls
            contentFit="contain"
            fullscreenOptions={{ enable: true }}
          />
        ) : <View style={styles.video} />}

        <SafeAreaView pointerEvents="box-none" style={styles.safeChrome}>
          <View pointerEvents="box-none" style={styles.chromeLayout}>
            <View style={[styles.topChrome, { marginHorizontal: layout.isTv ? 28 : 10, marginTop: layout.isTv ? 16 : 6 }]}>
              <PlayerButton
                label="×"
                accessibilityLabel={text.dismiss}
                preferredFocus={!isLive}
                onPress={requestClose}
                {...controlFocusProps}
              />

              <View style={styles.titleBlock} pointerEvents="none">
                <Text numberOfLines={1} style={[styles.title, { fontSize: titleSize }]}>{item.title}</Text>
                <Text numberOfLines={1} style={[styles.subtitle, { fontSize: subtitleSize }]}>
                  {item.subtitle ?? copy.player}{channelPosition ? ` · ${channelPosition}` : ''}
                </Text>
              </View>

              {isLive && channelQueue.length ? (
                <PlayerButton
                  label="☰"
                  accessibilityLabel={copy.channels}
                  onPress={() => setChannelPickerOpen(true)}
                  {...controlFocusProps}
                />
              ) : !isLive ? (
                <PlayerButton
                  label={favorite ? '♥' : '♡'}
                  accessibilityLabel={text.favorites}
                  active={favorite}
                  onPress={onToggleFavorite}
                />
              ) : <View style={styles.playerButtonPlaceholder} />}
            </View>

            <View style={styles.chromeSpacer} />

            <View pointerEvents="box-none" style={[styles.bottomChrome, { paddingHorizontal: layout.isTv ? 28 : 10, paddingBottom: layout.isTv ? 18 : 6 }]}>
              {sourceMessage || terminalError ? (
                <View style={[styles.statusBanner, terminalError && styles.errorBanner]}>
                  <Text numberOfLines={2} style={styles.statusText}>{terminalError ?? sourceMessage}</Text>
                </View>
              ) : null}

              {(isLive && (onPreviousChannel || onNextChannel || candidateUrls.length > 1)) || (!isLive && candidateUrls.length > 1) ? (
                <View style={styles.controlDock}>
                  {isLive && onPreviousChannel ? (
                    <PlayerButton label={previousLabel} accessibilityLabel={copy.previousChannel} onPress={onPreviousChannel} wide={!compactDock} {...controlFocusProps} />
                  ) : null}
                  {isLive && channelQueue.length ? (
                    <PlayerButton label="☰" accessibilityLabel={copy.channels} onPress={() => setChannelPickerOpen(true)} {...controlFocusProps} />
                  ) : null}
                  {candidateUrls.length > 1 ? (
                    <PlayerButton label={nextSourceLabel} accessibilityLabel={copy.nextSource} onPress={manuallyTryNextSource} wide={!compactDock} {...controlFocusProps} />
                  ) : null}
                  {isLive && onNextChannel ? (
                    <PlayerButton label={nextLabel} accessibilityLabel={copy.nextChannel} onPress={onNextChannel} wide={!compactDock} {...controlFocusProps} />
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        </SafeAreaView>

        {channelPickerOpen && channelQueue.length ? (
          <View style={styles.channelOverlay}>
            <Pressable style={styles.channelOverlayBackdrop} onPress={() => setChannelPickerOpen(false)} />
            <SafeAreaView style={[styles.channelPanel, channelPanelStyle]}>
              <View style={styles.channelPanelHeader}>
                <View style={styles.channelPanelHeading}>
                  <Text style={[styles.channelPanelTitle, { fontSize: channelTitleSize }]}>{copy.channels}</Text>
                  <Text style={styles.channelPanelHint}>{copy.channelHint}</Text>
                </View>
                <PlayerButton label="×" accessibilityLabel={text.dismiss} onPress={() => setChannelPickerOpen(false)} {...controlFocusProps} />
              </View>
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
                        { minHeight: Math.max(42, channelRowHeight - 6) },
                        current && styles.channelOptionCurrent,
                        focused && styles.channelOptionFocused,
                      ]}
                    >
                      <View style={styles.channelOptionLogo}>
                        {channel.logo ? <Image source={{ uri: channel.logo }} style={styles.channelOptionLogoImage} resizeMode="contain" /> : null}
                      </View>
                      <View style={styles.channelOptionText}>
                        <Text numberOfLines={1} style={styles.channelOptionName}>{channel.name}</Text>
                        <Text numberOfLines={1} style={styles.channelOptionMeta}>{channel.group ?? channel.country ?? 'Live TV'}</Text>
                      </View>
                      <Text style={styles.channelOptionNumber}>{index + 1}</Text>
                    </Pressable>
                  );
                }}
              />
            </SafeAreaView>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  video: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  safeChrome: { ...StyleSheet.absoluteFillObject },
  chromeLayout: { flex: 1 },
  topChrome: {
    minHeight: 54,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 17,
    backgroundColor: 'rgba(5,7,12,0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  titleBlock: { flex: 1, minWidth: 0 },
  title: { color: '#fff', fontWeight: '900', letterSpacing: -0.25 },
  subtitle: { color: '#b4bdcc', marginTop: 2, fontWeight: '700' },
  chromeSpacer: { flex: 1 },
  bottomChrome: { alignItems: 'center', gap: 8 },
  controlDock: {
    maxWidth: '100%',
    minHeight: 50,
    paddingHorizontal: 7,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: 'rgba(5,7,12,0.76)',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  playerButton: {
    minWidth: Platform.isTV ? 48 : 42,
    height: Platform.isTV ? 48 : 42,
    borderRadius: 999,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(22,25,33,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
  },
  playerButtonWide: { minWidth: Platform.isTV ? 138 : 112, borderRadius: 999 },
  playerButtonActive: { backgroundColor: 'rgba(247,58,95,0.94)', borderColor: theme.accent },
  playerButtonFocused: { borderColor: '#fff', borderWidth: 2, transform: [{ scale: 1.04 }] },
  playerButtonText: { color: '#fff', fontSize: Platform.isTV ? 21 : 18, fontWeight: '900', lineHeight: Platform.isTV ? 24 : 21 },
  playerButtonTextWide: { fontSize: Platform.isTV ? 14 : 12, lineHeight: Platform.isTV ? 18 : 15 },
  playerButtonPlaceholder: { width: Platform.isTV ? 48 : 42, height: Platform.isTV ? 48 : 42 },
  statusBanner: {
    maxWidth: 720,
    borderRadius: 13,
    backgroundColor: 'rgba(13,25,40,0.94)',
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  errorBanner: { backgroundColor: 'rgba(59,16,24,0.96)' },
  statusText: { color: theme.text, fontWeight: '800', textAlign: 'center', fontSize: Platform.isTV ? 14 : 11 },
  channelOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  channelOverlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  channelPanel: {
    height: '100%',
    backgroundColor: 'rgba(7,9,14,0.985)',
    borderLeftWidth: 1,
    borderLeftColor: '#252b38',
  },
  channelPanelHeader: {
    paddingHorizontal: Platform.isTV ? 18 : 12,
    paddingTop: Platform.isTV ? 16 : 8,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  channelPanelHeading: { flex: 1, minWidth: 0 },
  channelPanelTitle: { color: '#fff', fontWeight: '900', letterSpacing: -0.5 },
  channelPanelHint: { color: '#8e98aa', fontSize: Platform.isTV ? 12 : 9, fontWeight: '700', marginTop: 3 },
  channelPanelList: { paddingHorizontal: Platform.isTV ? 16 : 10, paddingBottom: 24 },
  channelOption: {
    marginBottom: 6,
    borderRadius: 12,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10141d',
    borderWidth: 1,
    borderColor: '#202633',
  },
  channelOptionCurrent: { backgroundColor: '#182331', borderColor: '#3f546f' },
  channelOptionFocused: { borderColor: '#fff', borderWidth: 2, transform: [{ scale: 1.012 }] },
  channelOptionLogo: {
    width: Platform.isTV ? 42 : 34,
    height: Platform.isTV ? 42 : 34,
    marginRight: 9,
    borderRadius: 8,
    backgroundColor: '#0a0d13',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  channelOptionLogoImage: { width: '100%', height: '100%' },
  channelOptionText: { flex: 1, minWidth: 0 },
  channelOptionName: { color: '#f4f6fa', fontSize: Platform.isTV ? 16 : 12, fontWeight: '900' },
  channelOptionMeta: { color: '#7f899b', fontSize: Platform.isTV ? 11 : 9, marginTop: 2, fontWeight: '700' },
  channelOptionNumber: { color: '#7d8798', fontSize: Platform.isTV ? 13 : 10, fontWeight: '900', marginLeft: 8 },
});
