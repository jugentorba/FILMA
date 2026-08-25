import { useEventListener } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, Linking, Modal, Platform, Pressable, SafeAreaView, StyleSheet, Text, useTVEventHandler, View } from 'react-native';
import { stringsFor } from '../i18n';
import { resolvedStreamsForItem } from '../services/streamResolver';
import { useFilma } from '../store/FilmaContext';
import type { LiveChannel, MediaItem, WatchProgress } from '../types';
import { FocusButton } from './FocusButton';
import { theme } from './theme';

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

const PLAYBACK_START_TIMEOUT_MS = 15_000;
const EXTERNAL_PROVIDER_PREFIX = 'external-provider:';

function externalProviderUrl(value?: string): string | undefined {
  if (!value?.startsWith(EXTERNAL_PROVIDER_PREFIX)) return undefined;
  try {
    return decodeURIComponent(value.slice(EXTERNAL_PROVIDER_PREFIX.length));
  } catch {
    return undefined;
  }
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
          <View style={[styles.statusBanner, terminalError ? styles.errorBanner : undefined]}>
            <Text numberOfLines={2} style={styles.statusText}>{terminalError ?? sourceMessage}</Text>
          </View>
        ) : null}

        <View style={styles.topBar}>
          <View style={styles.titleBlock}>
            <Text numberOfLines={1} style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>
              {item.subtitle ?? copy.player}{channelPosition ? ` · ${channelPosition}` : ''}
            </Text>
          </View>
          <View style={styles.actions}>
            {isLive && channelQueue.length ? (
              <FocusButton compact label={copy.channels} onPress={() => setChannelPickerOpen(true)} {...controlFocusProps} />
            ) : null}
            {isLive && onPreviousChannel ? <FocusButton compact label={`‹ ${copy.previousChannel}`} onPress={onPreviousChannel} {...controlFocusProps} /> : null}
            {isLive && onNextChannel ? <FocusButton compact label={`${copy.nextChannel} ›`} onPress={onNextChannel} {...controlFocusProps} /> : null}
            {candidateUrls.length > 1 ? <FocusButton compact label={`↻ ${copy.nextSource}`} onPress={manuallyTryNextSource} {...controlFocusProps} /> : null}
            {!isLive ? <FocusButton compact label={`${favorite ? '♥' : '♡'} ${text.favorites}`} active={favorite} onPress={onToggleFavorite} /> : null}
            <FocusButton compact label={text.dismiss} onPress={onClose} {...controlFocusProps} />
          </View>
        </View>

        {channelPickerOpen && channelQueue.length ? (
          <View style={styles.channelOverlay}>
            <Pressable style={styles.channelOverlayBackdrop} onPress={() => setChannelPickerOpen(false)} />
            <View style={styles.channelPanel}>
              <Text style={styles.channelPanelTitle}>{copy.channels}</Text>
              <Text style={styles.channelPanelHint}>{copy.channelHint}</Text>
              <FlatList
                ref={channelListRef}
                data={channelQueue}
                keyExtractor={channel => channel.id}
                initialScrollIndex={Math.max(0, Math.min(channelIndex, channelQueue.length - 1))}
                getItemLayout={(_, index) => ({ length: 66, offset: 66 * index, index })}
                onScrollToIndexFailed={({ index }) => {
                  channelListRef.current?.scrollToOffset({ offset: Math.max(0, index * 66), animated: false });
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
    left: Platform.isTV ? 48 : 14,
    right: Platform.isTV ? 48 : 14,
    bottom: Platform.isTV ? 40 : 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(13,25,40,0.94)',
    borderWidth: 1,
    borderColor: theme.border,
  },
  errorBanner: { backgroundColor: 'rgba(59,16,24,0.96)' },
  statusText: { color: theme.text, fontWeight: '800', textAlign: 'center' },
  topBar: {
    position: 'absolute',
    top: Platform.isTV ? 30 : 8,
    left: Platform.isTV ? 40 : 10,
    right: Platform.isTV ? 40 : 10,
    padding: Platform.isTV ? 10 : 8,
    borderRadius: 14,
    backgroundColor: 'rgba(7,9,15,0.88)',
    borderWidth: 1,
    borderColor: theme.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleBlock: { flex: 1, marginRight: 12 },
  title: { color: theme.text, fontSize: Platform.isTV ? 22 : 15, fontWeight: '800' },
  subtitle: { color: theme.muted, marginTop: 2, fontSize: Platform.isTV ? 13 : 11 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 7 },
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
    width: Platform.isTV ? 500 : '88%',
    maxWidth: 540,
    height: '100%',
    backgroundColor: 'rgba(8,11,18,0.98)',
    borderLeftWidth: 1,
    borderLeftColor: theme.border,
    paddingTop: Platform.isTV ? 44 : 26,
    paddingHorizontal: Platform.isTV ? 22 : 14,
  },
  channelPanelTitle: { color: theme.text, fontSize: Platform.isTV ? 28 : 22, fontWeight: '900' },
  channelPanelHint: { color: theme.muted, fontSize: Platform.isTV ? 13 : 11, marginTop: 5, marginBottom: 14 },
  channelPanelList: { paddingBottom: 40 },
  channelOption: {
    minHeight: 60,
    marginBottom: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#242c3c',
    backgroundColor: '#111724',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  channelOptionCurrent: { borderColor: theme.accent, backgroundColor: '#21131a' },
  channelOptionFocused: { borderColor: '#ffffff', borderWidth: 2, transform: [{ scale: 1.015 }] },
  channelOptionLogo: {
    width: Platform.isTV ? 46 : 40,
    height: Platform.isTV ? 46 : 40,
    borderRadius: 9,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 10,
  },
  channelOptionLogoImage: { width: '88%', height: '88%' },
  channelOptionText: { flex: 1, minWidth: 0 },
  channelOptionName: { color: theme.text, fontSize: Platform.isTV ? 17 : 14, fontWeight: '800' },
  channelOptionMeta: { color: theme.muted, fontSize: Platform.isTV ? 12 : 10, marginTop: 2 },
  channelOptionNumber: { color: theme.muted, fontSize: 12, marginLeft: 8, fontWeight: '700' },
});
