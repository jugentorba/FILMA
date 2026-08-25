import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { youtubeWatchUrl } from '../services/youtube';
import { useFilma } from '../store/FilmaContext';
import { FocusButton } from './FocusButton';
import { theme } from './theme';

type Props = {
  videoId: string;
  title: string;
  channelTitle?: string;
  onClose(): void;
};

export function YouTubePlayerModal({ videoId, title, channelTitle, onClose }: Props) {
  const { state } = useFilma();
  const [opening, setOpening] = useState(true);
  const [failed, setFailed] = useState(false);
  const firstAttemptRef = useRef(false);

  const copy = state.preferences.appLanguage === 'fr'
    ? {
        opening: 'Ouverture dans YouTube…',
        failed: 'FILMA n’a pas pu ouvrir cette vidéo automatiquement.',
        retry: 'Réessayer',
        browser: 'Ouvrir dans le navigateur',
        close: 'Fermer',
      }
    : state.preferences.appLanguage === 'sq'
      ? {
          opening: 'Po hapet në YouTube…',
          failed: 'FILMA nuk arriti ta hapë automatikisht këtë video.',
          retry: 'Provo përsëri',
          browser: 'Hape në shfletues',
          close: 'Mbyll',
        }
      : {
          opening: 'Opening in YouTube…',
          failed: 'FILMA could not open this video automatically.',
          retry: 'Try again',
          browser: 'Open in browser',
          close: 'Close',
        };

  const openBrowser = useCallback(async () => {
    setOpening(true);
    setFailed(false);
    try {
      await Linking.openURL(youtubeWatchUrl(videoId));
      onClose();
    } catch {
      setFailed(true);
      setOpening(false);
    }
  }, [onClose, videoId]);

  const openPreferred = useCallback(async () => {
    setOpening(true);
    setFailed(false);

    if (Platform.OS === 'android') {
      try {
        await Linking.openURL(`vnd.youtube:${encodeURIComponent(videoId)}`);
        onClose();
        return;
      } catch {
        // The YouTube app may not be installed on this phone/TV. Fall through
        // to the universal HTTPS URL so playback is still reachable.
      }
    }

    await openBrowser();
  }, [onClose, openBrowser, videoId]);

  useEffect(() => {
    if (firstAttemptRef.current) return;
    firstAttemptRef.current = true;
    void openPreferred();
  }, [openPreferred]);

  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <View style={styles.panel}>
          <View style={styles.youtubeMark}><Text style={styles.youtubeMarkText}>▶</Text></View>
          <Text numberOfLines={2} style={styles.title}>{title}</Text>
          {channelTitle ? <Text numberOfLines={1} style={styles.channel}>{channelTitle}</Text> : null}

          {opening && !failed ? (
            <View style={styles.statusRow}>
              <ActivityIndicator />
              <Text style={styles.status}>{copy.opening}</Text>
            </View>
          ) : null}

          {failed ? <Text style={styles.error}>{copy.failed}</Text> : null}

          <View style={styles.actions}>
            {failed ? <FocusButton label={copy.retry} active preferredFocus onPress={() => void openPreferred()} /> : null}
            <FocusButton label={copy.browser} onPress={() => void openBrowser()} />
            <FocusButton label={copy.close} onPress={onClose} />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Platform.isTV ? 70 : 24,
  },
  panel: {
    width: '100%',
    maxWidth: 720,
    borderRadius: Platform.isTV ? 24 : 18,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    padding: Platform.isTV ? 42 : 24,
    alignItems: 'flex-start',
  },
  youtubeMark: {
    width: Platform.isTV ? 64 : 54,
    height: Platform.isTV ? 44 : 38,
    borderRadius: 12,
    backgroundColor: '#ff0033',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  youtubeMarkText: { color: '#fff', fontWeight: '900', fontSize: Platform.isTV ? 22 : 18 },
  title: { color: theme.text, fontWeight: '900', fontSize: Platform.isTV ? 30 : 22 },
  channel: { color: theme.muted, marginTop: 8, fontSize: Platform.isTV ? 17 : 14 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24 },
  status: { color: theme.text, fontWeight: '700' },
  error: { color: '#fda4af', marginTop: 24, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 28 },
});
