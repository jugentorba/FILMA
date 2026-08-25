import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { HomeScreen } from './src/screens/HomeScreen';
import { LiveTvScreen } from './src/screens/LiveTvScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { fetchStreams } from './src/services/stremio';
import { FilmaProvider, useFilma } from './src/store/FilmaContext';
import type { MediaItem } from './src/types';
import { FocusButton } from './src/ui/FocusButton';
import { PlayerModal } from './src/ui/PlayerModal';
import { StreamPickerModal, type StreamChoice } from './src/ui/StreamPickerModal';
import { theme } from './src/ui/theme';

type Screen = 'home' | 'live' | 'settings';

type PendingStreams = {
  item: MediaItem;
  streams: StreamChoice[];
};

function FilmaApp() {
  const { ready, state, setMode, updateProgress, toggleFavorite } = useFilma();
  const [screen, setScreen] = useState<Screen>('home');
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [pendingStreams, setPendingStreams] = useState<PendingStreams | null>(null);
  const [resolvingTitle, setResolvingTitle] = useState<string>();
  const [playbackError, setPlaybackError] = useState<string>();

  const goMovies = () => {
    setMode('movies');
    setScreen('home');
  };

  const goLive = () => {
    setMode('live');
    setScreen('live');
  };

  const handleSelect = async (item: MediaItem) => {
    setPlaybackError(undefined);

    if (item.streamUrl) {
      setSelected(item);
      return;
    }

    if (item.source?.kind !== 'stremio') {
      setPlaybackError('This item does not provide a playable source.');
      return;
    }

    setResolvingTitle(item.title);
    try {
      const result = await fetchStreams(
        item.source.manifestUrl,
        item.source.mediaType,
        item.source.mediaId,
      );
      const streams: StreamChoice[] = result
        .filter((stream): stream is typeof stream & { url: string } => Boolean(stream.url && /^https?:\/\//i.test(stream.url)))
        .map(stream => ({ title: stream.title, url: stream.url }));

      if (!streams.length) {
        setPlaybackError('The add-on returned no direct HTTP/HLS stream that FILMA can play yet.');
      } else if (streams.length === 1) {
        setSelected({ ...item, streamUrl: streams[0].url });
      } else {
        setPendingStreams({ item, streams });
      }
    } catch (error) {
      setPlaybackError(error instanceof Error ? error.message : 'Could not load streams.');
    } finally {
      setResolvingTitle(undefined);
    }
  };

  const handleProgress = useCallback((positionSeconds: number, durationSeconds: number) => {
    if (selected?.id && !selected.id.startsWith('live:')) {
      updateProgress(selected.id, positionSeconds, durationSeconds);
    }
  }, [selected?.id, updateProgress]);

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
      <View style={styles.nav}>
        <Text style={styles.brand}>FILMA</Text>
        <View style={styles.navButtons}>
          <FocusButton compact label="Movies" active={screen === 'home'} onPress={goMovies} />
          <FocusButton compact label="Live TV" active={screen === 'live'} onPress={goLive} />
          <FocusButton compact label="Settings" active={screen === 'settings'} onPress={() => setScreen('settings')} />
        </View>
      </View>

      {playbackError ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{playbackError}</Text>
          <FocusButton compact label="Dismiss" onPress={() => setPlaybackError(undefined)} />
        </View>
      ) : null}

      {resolvingTitle ? (
        <View style={styles.resolveBar}>
          <ActivityIndicator size="small" />
          <Text style={styles.resolveText}>Finding streams for {resolvingTitle}…</Text>
        </View>
      ) : null}

      <View style={styles.content}>
        {screen === 'home' ? <HomeScreen onSelect={item => void handleSelect(item)} /> : null}
        {screen === 'live' ? <LiveTvScreen onSelect={item => void handleSelect(item)} onOpenSettings={() => setScreen('settings')} /> : null}
        {screen === 'settings' ? <SettingsScreen /> : null}
      </View>

      {pendingStreams ? (
        <StreamPickerModal
          title={pendingStreams.item.title}
          streams={pendingStreams.streams}
          onChoose={stream => {
            setSelected({ ...pendingStreams.item, streamUrl: stream.url });
            setPendingStreams(null);
          }}
          onClose={() => setPendingStreams(null)}
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
    <FilmaProvider>
      <FilmaApp />
    </FilmaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.background,
  },
  loading: {
    flex: 1,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
  nav: {
    minHeight: Platform.isTV ? 78 : 66,
    paddingHorizontal: Platform.isTV ? 48 : 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#090c14',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    zIndex: 10,
  },
  brand: {
    color: theme.text,
    fontWeight: '900',
    fontSize: Platform.isTV ? 30 : 22,
    letterSpacing: 2,
  },
  navButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Platform.isTV ? 12 : 6,
  },
  resolveBar: {
    minHeight: 48,
    paddingHorizontal: Platform.isTV ? 48 : 16,
    backgroundColor: theme.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  resolveText: {
    color: theme.text,
    fontWeight: '700',
  },
  errorBar: {
    minHeight: 58,
    paddingHorizontal: Platform.isTV ? 48 : 16,
    paddingVertical: 8,
    backgroundColor: '#3b1018',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  errorText: {
    flex: 1,
    color: '#fecdd3',
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
});
