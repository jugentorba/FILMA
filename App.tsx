import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { HomeScreen } from './src/screens/HomeScreen';
import { LiveTvScreen } from './src/screens/LiveTvScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { FilmaProvider, useFilma } from './src/store/FilmaContext';
import type { MediaItem } from './src/types';
import { FocusButton } from './src/ui/FocusButton';
import { PlayerModal } from './src/ui/PlayerModal';
import { theme } from './src/ui/theme';

type Screen = 'home' | 'live' | 'settings';

function FilmaApp() {
  const { ready, state, setMode, updateProgress, toggleFavorite } = useFilma();
  const [screen, setScreen] = useState<Screen>('home');
  const [selected, setSelected] = useState<MediaItem | null>(null);

  const goMovies = () => {
    setMode('movies');
    setScreen('home');
  };

  const goLive = () => {
    setMode('live');
    setScreen('live');
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

      <View style={styles.content}>
        {screen === 'home' ? <HomeScreen onSelect={setSelected} /> : null}
        {screen === 'live' ? <LiveTvScreen onSelect={setSelected} onOpenSettings={() => setScreen('settings')} /> : null}
        {screen === 'settings' ? <SettingsScreen /> : null}
      </View>

      {selected?.streamUrl ? (
        <PlayerModal
          item={selected}
          progress={state.progress[selected.id]}
          favorite={Boolean(state.favorites[selected.id])}
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
  content: {
    flex: 1,
  },
});
