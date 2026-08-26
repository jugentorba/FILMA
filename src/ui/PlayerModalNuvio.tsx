import { useEventListener } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, FlatList, Image, Linking, Modal, Platform, Pressable, SafeAreaView, StyleSheet, Text, useTVEventHandler, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { stringsFor } from '../i18n';
import { resolvedStreamsForItem } from '../services/streamResolver';
import { useFilma } from '../store/FilmaContext';
import type { AppLanguage, AudioLanguage, LiveChannel, MediaItem, WatchProgress } from '../types';
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

const ABSOLUTE_FILL: ViewStyle = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 };
const PLAYBACK_START_TIMEOUT_MS = 15_000;
const EXTERNAL_PROVIDER_PREFIX = 'external-provider:';
const RATES = [1, 1.25, 1.5, 2];

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
  try { return decodeURIComponent(value.slice(EXTERNAL_PROVIDER_PREFIX.length)); } catch { return undefined; }
}

function normalizeLanguage(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase().replace(/_/g, '-');
}

function trackMatches(track: LanguageTrack, language: AppLanguage | AudioLanguage): boolean {
  const text = normalizeLanguage([track.language, track.label, track.name].filter(Boolean).join(' '));
  const primary = normalizeLanguage(track.language).split('-')[0];
  return LANGUAGE_ALIASES[language].some(alias => {
    const normalized = normalizeLanguage(alias);
    return primary === normalized || text.includes(normalized);
  });
}

function bestLanguageTrack<T extends LanguageTrack>(tracks: T[], languages: Array<AppLanguage | AudioLanguage>, allowAny: boolean): T | undefined {
  for (const language of languages) {
    const match = tracks.find(track => trackMatches(track, language));
    if (match) return match;
  }
  if (!allowAny) return tracks.find(track => track.isDefault || track.autoSelect);
  return tracks.find(track => track.isDefault || track.autoSelect) ?? tracks[0];
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function RoundControl({ label, accessibilityLabel, onPress, primary = false }: { label: string; accessibilityLabel: string; onPress(): void; primary?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed, focused }) => [styles.roundControl, primary && styles.roundControlPrimary, focused && styles.focused, pressed && styles.pressed]}>
      <Text style={[styles.roundControlText, primary && styles.roundControlTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

function ToolbarControl({ icon, label, onPress, active = false }: { icon: string; label: string; onPress(): void; active?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed, focused }) => [styles.toolbarControl, active && styles.toolbarControlActive, focused && styles.focused, pressed && styles.pressed]}>
      <Text style={styles.toolbarIcon}>{icon}</Text>
      <Text numberOfLines={1} style={styles.toolbarLabel}>{label}</Text>
    </Pressable>
  );
}

export function PlayerModalNuvio({
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
  const initialExternal = externalProviderUrl(item.streamUrl);
  const progressHandler = useRef(onProgress);
  progressHandler.current = onProgress;
  const failedUrlsRef = useRef(new Set<string>());
  const replacingRef = useRef(false);
  const currentUrlRef = useRef(item.streamUrl ?? '');
  const [position, setPosition] = useState(progress?.completed ? 0 : (progress?.positionSeconds ?? 0));
  const [duration, setDuration] = useState(progress?.durationSeconds ?? 0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [sourceReady, setSourceReady] = useState(Boolean(initialExternal));
  const [sourceMessage, setSourceMessage] = useState<string>();
  const [terminalError, setTerminalError] = useState<string>();
  const [sourceAttempt, setSourceAttempt] = useState(0);
  const [fit, setFit] = useState<'contain' | 'cover'>('contain');
  const [rateIndex, setRateIndex] = useState(0);
  const [audioTracks, setAudioTracks] = useState<LanguageTrack[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<LanguageTrack[]>([]);
  const [audioIndex, setAudioIndex] = useState(-1);
  const [subtitleIndex, setSubtitleIndex] = useState(-1);
  const [timelineWidth, setTimelineWidth] = useState(1);
  const [channelPickerOpen, setChannelPickerOpen] = useState(false);
  const channelListRef = useRef<FlatList<LiveChannel>>(null);

  const copy = useMemo(() => state.preferences.appLanguage === 'fr'
    ? { fill: 'Remplir', fit: 'Ajuster', subtitles: 'Sous-titres', audio: 'Audio', sources: 'Sources', channels: 'Chaînes', previous: 'Chaîne précédente', next: 'Chaîne suivante', nextSource: 'Source suivante', trying: (n: number, total: number) => `Source ${n}/${total}…`, failed: 'Aucune source ne peut lire ce contenu.', timeout: 'La source met trop de temps à démarrer.', opening: 'Ouverture…' }
    : state.preferences.appLanguage === 'sq'
      ? { fill: 'Mbush', fit: 'Përshtat', subtitles: 'Titrat', audio: 'Audio', sources: 'Burimet', channels: 'Kanalet', previous: 'Kanali para', next: 'Kanali tjetër', nextSource: 'Burimi tjetër', trying: (n: number, total: number) => `Burimi ${n}/${total}…`, failed: 'Asnjë burim nuk mund ta luajë këtë përmbajtje.', timeout: 'Burimi po vonon shumë.', opening: 'Duke hapur…' }
      : { fill: 'Fill', fit: 'Fit', subtitles: 'Subtitles', audio: 'Audio', sources: 'Sources', channels: 'Channels', previous: 'Previous channel', next: 'Next channel', nextSource: 'Next source', trying: (n: number, total: number) => `Source ${n}/${total}…`, failed: 'No source can play this content.', timeout: 'This source is taking too long to start.', opening: 'Opening…' },
  [state.preferences.appLanguage]);

  const candidateUrls = useMemo(() => [...new Set([
    item.streamUrl,
    ...(item.alternateStreamUrls ?? []),
    ...resolvedStreamsForItem(item.id).map(stream => stream.url),
  ].filter((url): url is string => Boolean(url)))], [item.alternateStreamUrls, item.id, item.streamUrl]);

  const player = useVideoPlayer(initialExternal ? null : (item.streamUrl ?? null), instance => {
    instance.timeUpdateEventInterval = 1;
    if (!initialExternal) {
      if (!progress?.completed && progress?.positionSeconds && progress.positionSeconds > 5) instance.currentTime = progress.positionSeconds;
      instance.play();
    }
  });

  const requestClose = useCallback(() => {
    if (channelPickerOpen) { setChannelPickerOpen(false); return; }
    onClose();
  }, [channelPickerOpen, onClose]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { requestClose(); return true; });
    return () => subscription.remove();
  }, [requestClose]);

  const openExternal = useCallback(async (url: string) => {
    setSourceMessage(copy.opening);
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) throw new Error('Unsupported URL');
      await Linking.openURL(url);
      onClose();
    } catch {
      setSourceMessage(undefined);
      setTerminalError(copy.failed);
    }
  }, [copy.failed, copy.opening, onClose]);

  const switchToNextCandidate = useCallback(async (reason?: string) => {
    if (replacingRef.current) return;
    replacingRef.current = true;
    try {
      while (true) {
        if (currentUrlRef.current) failedUrlsRef.current.add(currentUrlRef.current);
        const nextUrl = candidateUrls.find(url => !failedUrlsRef.current.has(url));
        if (!nextUrl) {
          setSourceReady(false);
          setSourceMessage(undefined);
          setTerminalError(reason || copy.failed);
          return;
        }
        setTerminalError(undefined);
        setSourceReady(false);
        setSourceMessage(copy.trying(candidateUrls.indexOf(nextUrl) + 1, candidateUrls.length));
        const external = externalProviderUrl(nextUrl);
        if (external) {
          currentUrlRef.current = nextUrl;
          replacingRef.current = false;
          await openExternal(external);
          return;
        }
        try {
          await player.replaceAsync(nextUrl);
          currentUrlRef.current = nextUrl;
          if (!isLive && position > 5) player.currentTime = position;
          player.play();
          setIsPlaying(true);
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
  }, [candidateUrls, copy.failed, copy.trying, isLive, openExternal, player, position]);

  const manuallyTryNextSource = useCallback(() => {
    const other = candidateUrls.some(url => url !== currentUrlRef.current && !failedUrlsRef.current.has(url));
    if (!other) failedUrlsRef.current.clear();
    setTerminalError(undefined);
    void switchToNextCandidate();
  }, [candidateUrls, switchToNextCandidate]);

  useEventListener(player, 'sourceLoad', ({ availableAudioTracks, availableSubtitleTracks }) => {
    const audios = availableAudioTracks as LanguageTrack[];
    const subtitles = availableSubtitleTracks as LanguageTrack[];
    setAudioTracks(audios);
    setSubtitleTracks(subtitles);
    if (Platform.OS === 'web' || (Platform.OS === 'ios' && Platform.isTV)) return;

    const preferredAudio = bestLanguageTrack(availableAudioTracks, state.preferences.preferredAudioLanguages, false);
    if (preferredAudio) {
      player.audioTrack = preferredAudio;
      setAudioIndex(availableAudioTracks.indexOf(preferredAudio));
    }
    const subtitlePreferences = [state.preferences.appLanguage, ...state.preferences.preferredAudioLanguages.filter(language => language !== state.preferences.appLanguage)];
    const preferredSubtitle = bestLanguageTrack(availableSubtitleTracks, subtitlePreferences, true);
    if (preferredSubtitle) {
      player.subtitleTrack = preferredSubtitle;
      setSubtitleIndex(availableSubtitleTracks.indexOf(preferredSubtitle));
    }
  });

  useEventListener(player, 'statusChange', ({ status, error }) => {
    if (initialExternal) return;
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
    if (!Number.isFinite(currentTime)) return;
    setPosition(Math.max(0, currentTime));
    if (Number.isFinite(player.duration) && player.duration > 0) {
      setDuration(player.duration);
      if (!isLive) progressHandler.current(currentTime, player.duration);
    }
  });

  useEffect(() => {
    if (!initialExternal) return;
    void openExternal(initialExternal);
  }, [initialExternal, openExternal]);

  useEffect(() => {
    if (initialExternal || sourceReady || terminalError || !currentUrlRef.current) return;
    const timer = setTimeout(() => void switchToNextCandidate(copy.timeout), PLAYBACK_START_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [copy.timeout, initialExternal, sourceAttempt, sourceReady, switchToNextCandidate, terminalError]);

  useEffect(() => () => {
    if (!isLive && !initialExternal && Number.isFinite(player.currentTime) && Number.isFinite(player.duration) && player.duration > 0) {
      progressHandler.current(player.currentTime, player.duration);
    }
  }, [initialExternal, isLive, player]);

  useTVEventHandler(event => {
    if (!Platform.isTV || !isLive || channelPickerOpen) return;
    if (event.eventType === 'select' && channelQueue.length) { setChannelPickerOpen(true); return; }
    if (event.eventType === 'up') { onPreviousChannel?.(); return; }
    if (event.eventType === 'down') onNextChannel?.();
  });

  const togglePlay = () => {
    if (isPlaying) player.pause(); else player.play();
    setIsPlaying(value => !value);
  };

  const skip = (seconds: number) => {
    if (isLive) return;
    const next = Math.max(0, Math.min(duration || Number.MAX_SAFE_INTEGER, player.currentTime + seconds));
    player.currentTime = next;
    setPosition(next);
  };

  const cycleRate = () => {
    const next = (rateIndex + 1) % RATES.length;
    setRateIndex(next);
    player.playbackRate = RATES[next];
  };

  const cycleAudio = () => {
    if (!audioTracks.length) return;
    const next = (audioIndex + 1 + audioTracks.length) % audioTracks.length;
    setAudioIndex(next);
    player.audioTrack = audioTracks[next] as never;
  };

  const cycleSubtitles = () => {
    if (!subtitleTracks.length) return;
    const next = subtitleIndex >= subtitleTracks.length - 1 ? -1 : subtitleIndex + 1;
    setSubtitleIndex(next);
    player.subtitleTrack = (next < 0 ? null : subtitleTracks[next]) as never;
  };

  const seekFromPress = (locationX: number) => {
    if (isLive || duration <= 0 || timelineWidth <= 0) return;
    const next = Math.max(0, Math.min(duration, duration * (locationX / timelineWidth)));
    player.currentTime = next;
    setPosition(next);
  };

  const chooseChannel = (index: number) => {
    if (!onSelectChannel || !channelQueue[index]) return;
    onSelectChannel(index);
    setChannelPickerOpen(false);
  };

  const progressRatio = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;
  const channelPanelStyle = useMemo<ViewStyle>(() => ({ width: layout.isTv ? 470 : layout.isTablet ? '58%' : '88%', maxWidth: 500 }), [layout.isTablet, layout.isTv]);

  return (
    <Modal visible animationType="fade" supportedOrientations={['portrait', 'landscape']} presentationStyle="fullScreen" onRequestClose={requestClose}>
      <View style={styles.root}>
        {!initialExternal ? <VideoView style={styles.video} player={player} nativeControls={false} contentFit={fit} /> : <View style={styles.video} />}

        <SafeAreaView pointerEvents="box-none" style={styles.safeChrome}>
          <View style={styles.topBar}>
            <View style={styles.titleBlock}>
              <Text numberOfLines={1} style={styles.title}>{item.title}</Text>
              <Text numberOfLines={1} style={styles.subtitle}>{item.subtitle ?? (isLive ? 'Live TV' : 'FILMA')}{channelPosition ? ` · ${channelPosition}` : ''}</Text>
            </View>
            {!isLive ? <Pressable accessibilityRole="button" accessibilityLabel={text.favorites} onPress={onToggleFavorite} style={styles.topIcon}><Text style={styles.topIconText}>{favorite ? '♥' : '♡'}</Text></Pressable> : null}
            <Pressable accessibilityRole="button" accessibilityLabel={text.dismiss} onPress={requestClose} style={styles.topIcon}><Text style={styles.closeText}>×</Text></Pressable>
          </View>

          <View style={styles.centerControls}>
            {!isLive ? <RoundControl label="↶\n10" accessibilityLabel="Back 10 seconds" onPress={() => skip(-10)} /> : null}
            <RoundControl label={isPlaying ? 'Ⅱ' : '▶'} accessibilityLabel={isPlaying ? 'Pause' : 'Play'} onPress={togglePlay} primary />
            {!isLive ? <RoundControl label="↷\n10" accessibilityLabel="Forward 10 seconds" onPress={() => skip(10)} /> : null}
          </View>

          <View style={styles.bottomArea}>
            {sourceMessage || terminalError ? <View style={[styles.status, terminalError && styles.statusError]}><Text style={styles.statusText}>{terminalError ?? sourceMessage}</Text></View> : null}

            {!isLive ? (
              <View style={styles.timelineWrap}>
                <Pressable
                  onLayout={event => setTimelineWidth(Math.max(1, event.nativeEvent.layout.width))}
                  onPress={event => seekFromPress(event.nativeEvent.locationX)}
                  style={styles.timeline}
                >
                  <View style={[styles.timelineFill, { width: `${Math.round(progressRatio * 100)}%` }]} />
                  <View style={[styles.timelineThumb, { left: `${Math.round(progressRatio * 100)}%` }]} />
                </Pressable>
                <View style={styles.timeRow}><Text style={styles.timeText}>{formatTime(position)}</Text><Text style={styles.timeText}>{formatTime(duration)}</Text></View>
              </View>
            ) : null}

            <View style={styles.toolbar}>
              <ToolbarControl icon="▣" label={fit === 'contain' ? copy.fill : copy.fit} active={fit === 'cover'} onPress={() => setFit(value => value === 'contain' ? 'cover' : 'contain')} />
              {!isLive ? <ToolbarControl icon="◔" label={`${RATES[rateIndex]}x`} active={rateIndex !== 0} onPress={cycleRate} /> : null}
              {!isLive ? <ToolbarControl icon="CC" label={copy.subtitles} active={subtitleIndex >= 0} onPress={cycleSubtitles} /> : null}
              {!isLive ? <ToolbarControl icon="◉" label={copy.audio} active={audioTracks.length > 1} onPress={cycleAudio} /> : null}
              {candidateUrls.length > 1 ? <ToolbarControl icon="↔" label={copy.sources} onPress={manuallyTryNextSource} /> : null}
              {isLive && channelQueue.length ? <ToolbarControl icon="☰" label={copy.channels} onPress={() => setChannelPickerOpen(true)} /> : null}
              {isLive && onPreviousChannel ? <ToolbarControl icon="‹" label={copy.previous} onPress={onPreviousChannel} /> : null}
              {isLive && onNextChannel ? <ToolbarControl icon="›" label={copy.next} onPress={onNextChannel} /> : null}
            </View>
          </View>
        </SafeAreaView>

        {channelPickerOpen && channelQueue.length ? (
          <View style={styles.channelOverlay}>
            <Pressable style={styles.channelBackdrop} onPress={() => setChannelPickerOpen(false)} />
            <SafeAreaView style={[styles.channelPanel, channelPanelStyle]}>
              <View style={styles.channelHeader}><Text style={styles.channelTitle}>{copy.channels}</Text><Pressable onPress={() => setChannelPickerOpen(false)}><Text style={styles.closeText}>×</Text></Pressable></View>
              <FlatList
                ref={channelListRef}
                data={channelQueue}
                keyExtractor={channel => channel.id}
                renderItem={({ item: channel, index }) => {
                  const current = index === channelIndex;
                  return (
                    <Pressable accessibilityRole="button" accessibilityLabel={channel.name} onPress={() => chooseChannel(index)} style={({ pressed, focused }) => [styles.channelRow, current && styles.channelRowCurrent, focused && styles.focused, pressed && styles.pressed]}>
                      <View style={styles.channelLogo}>{channel.logo ? <Image source={{ uri: channel.logo }} style={styles.channelLogoImage} resizeMode="contain" /> : null}</View>
                      <View style={styles.channelText}><Text numberOfLines={1} style={styles.channelName}>{channel.name}</Text><Text numberOfLines={1} style={styles.channelMeta}>{channel.group ?? channel.country ?? 'Live TV'}</Text></View>
                      <Text style={styles.channelNumber}>{index + 1}</Text>
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
  video: { ...ABSOLUTE_FILL, backgroundColor: '#000' },
  safeChrome: { ...ABSOLUTE_FILL, justifyContent: 'space-between' },
  topBar: { marginHorizontal: Platform.isTV ? 34 : 15, marginTop: Platform.isTV ? 18 : 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleBlock: { flex: 1, minWidth: 0 },
  title: { color: '#fff', fontSize: Platform.isTV ? 25 : 18, fontWeight: '900', letterSpacing: -0.4 },
  subtitle: { color: '#d0d0d2', fontSize: Platform.isTV ? 14 : 11, fontWeight: '600', marginTop: 3 },
  topIcon: { width: Platform.isTV ? 48 : 42, height: Platform.isTV ? 48 : 42, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.46)', alignItems: 'center', justifyContent: 'center' },
  topIconText: { color: '#fff', fontSize: 23, fontWeight: '700' },
  closeText: { color: '#fff', fontSize: Platform.isTV ? 34 : 30, lineHeight: Platform.isTV ? 35 : 31, fontWeight: '300' },
  centerControls: { position: 'absolute', top: '42%', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Platform.isTV ? 88 : 48 },
  roundControl: { width: Platform.isTV ? 68 : 58, height: Platform.isTV ? 68 : 58, borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.44)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  roundControlPrimary: { width: Platform.isTV ? 78 : 66, height: Platform.isTV ? 78 : 66, backgroundColor: 'rgba(255,255,255,0.92)' },
  roundControlText: { color: '#fff', textAlign: 'center', fontSize: Platform.isTV ? 23 : 19, fontWeight: '900', lineHeight: Platform.isTV ? 24 : 20 },
  roundControlTextPrimary: { color: '#0a0a0b', fontSize: Platform.isTV ? 30 : 25 },
  bottomArea: { paddingHorizontal: Platform.isTV ? 34 : 15, paddingBottom: Platform.isTV ? 22 : 10, gap: 10 },
  status: { alignSelf: 'center', maxWidth: 680, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: 'rgba(16,20,28,0.88)' },
  statusError: { backgroundColor: 'rgba(62,13,20,0.9)' },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  timelineWrap: { width: '100%' },
  timeline: { height: 20, justifyContent: 'center' },
  timelineFill: { position: 'absolute', left: 0, height: 7, borderRadius: 99, backgroundColor: '#f4f4f5' },
  timelineThumb: { position: 'absolute', width: 13, height: 13, borderRadius: 7, marginLeft: -6, backgroundColor: '#fff' },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -2 },
  timeText: { color: '#eeeef0', fontSize: 11, fontWeight: '700' },
  toolbar: { alignSelf: 'center', maxWidth: '100%', minHeight: 52, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 28, backgroundColor: 'rgba(4,4,5,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 4 },
  toolbarControl: { minHeight: 40, paddingHorizontal: Platform.isTV ? 15 : 10, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 },
  toolbarControlActive: { backgroundColor: 'rgba(255,255,255,0.14)' },
  toolbarIcon: { color: '#fff', fontSize: Platform.isTV ? 16 : 13, fontWeight: '900' },
  toolbarLabel: { color: '#fff', fontSize: Platform.isTV ? 14 : 11, fontWeight: '800' },
  focused: { borderColor: '#fff', borderWidth: 2, transform: [{ scale: 1.04 }] },
  pressed: { opacity: 0.7 },
  channelOverlay: { ...ABSOLUTE_FILL, zIndex: 50, flexDirection: 'row', justifyContent: 'flex-end' },
  channelBackdrop: { ...ABSOLUTE_FILL, backgroundColor: 'rgba(0,0,0,0.62)' },
  channelPanel: { height: '100%', backgroundColor: 'rgba(10,10,11,0.98)', borderLeftWidth: 1, borderLeftColor: '#2a2a2c' },
  channelHeader: { minHeight: 66, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  channelTitle: { color: '#fff', fontSize: Platform.isTV ? 25 : 20, fontWeight: '900' },
  channelRow: { minHeight: Platform.isTV ? 68 : 56, marginHorizontal: 10, marginBottom: 6, paddingHorizontal: 10, borderRadius: 13, backgroundColor: '#19191a', flexDirection: 'row', alignItems: 'center', gap: 10 },
  channelRowCurrent: { backgroundColor: '#303033' },
  channelLogo: { width: 38, height: 38, borderRadius: 9, backgroundColor: '#0c0c0d', overflow: 'hidden' },
  channelLogoImage: { width: '100%', height: '100%' },
  channelText: { flex: 1 },
  channelName: { color: '#fff', fontSize: 14, fontWeight: '800' },
  channelMeta: { color: '#96989f', fontSize: 10, marginTop: 2 },
  channelNumber: { color: '#a8aab0', fontSize: 12, fontWeight: '800' },
});
