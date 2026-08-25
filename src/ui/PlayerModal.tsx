import { useEventListener } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Modal, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { stringsFor } from '../i18n';
import { resolvedStreamsForItem } from '../services/streamResolver';
import { useFilma } from '../store/FilmaContext';
import type { MediaItem, WatchProgress } from '../types';
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
  const [sourceMessage, setSourceMessage] = useState<string>();
  const [terminalError, setTerminalError] = useState<string>();
  const [sourceAttempt, setSourceAttempt] = useState(0);
  const [sourceReady, setSourceReady] = useState(Boolean(initialExternalProvider));

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
    if (!progress?.completed && progress?.positionSeconds && progress.positionSeconds > 5) {
      instance.currentTime = progress.positionSeconds;
    }
    instance.play();
  });

  const openExternalProvider = useCallback(async (url: string) => {
    setTerminalError(undefined);
    setSourceMessage(copy.openingProvider);
    try {
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
            {isLive && onPreviousChannel ? <FocusButton compact label={`‹ ${copy.previousChannel}`} onPress={onPreviousChannel} /> : null}
            {isLive && onNextChannel ? <FocusButton compact label={`${copy.nextChannel} ›`} onPress={onNextChannel} /> : null}
            {candidateUrls.length > 1 ? <FocusButton compact label={`↻ ${copy.nextSource}`} onPress={manuallyTryNextSource} /> : null}
            {!isLive ? <FocusButton compact label={`${favorite ? '♥' : '♡'} ${text.favorites}`} active={favorite} onPress={onToggleFavorite} /> : null}
            <FocusButton compact label={text.dismiss} onPress={onClose} />
          </View>
        </View>
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
    top: Platform.isTV ? 36 : 10,
    left: Platform.isTV ? 48 : 14,
    right: Platform.isTV ? 48 : 14,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(7,9,15,0.88)',
    borderWidth: 1,
    borderColor: theme.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleBlock: { flex: 1, marginRight: 16 },
  title: { color: theme.text, fontSize: Platform.isTV ? 26 : 17, fontWeight: '800' },
  subtitle: { color: theme.muted, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10 },
});