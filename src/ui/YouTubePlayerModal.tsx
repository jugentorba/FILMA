import React, { useCallback, useState } from 'react';
import { Linking, Modal, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import FilmaYouTubePlayer, { filmaYouTubePlayerAvailable } from '../../modules/filma-youtube-player';
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
  const [error, setError] = useState<string>();
  const embedded = Platform.OS === 'android' && filmaYouTubePlayerAvailable;

  const copy = state.preferences.appLanguage === 'fr'
    ? {
        unavailable: 'Le lecteur YouTube intégré n’est pas disponible dans cette version. Vous pouvez ouvrir la vidéo dans YouTube.',
        externalError: 'FILMA n’a pas pu ouvrir YouTube.',
        openYoutube: 'Ouvrir YouTube',
        close: 'Fermer',
      }
    : state.preferences.appLanguage === 'sq'
      ? {
          unavailable: 'Luajtësi i integruar i YouTube nuk është i disponueshëm në këtë version. Mund ta hapësh videon në YouTube.',
          externalError: 'FILMA nuk arriti ta hapë YouTube.',
          openYoutube: 'Hap YouTube',
          close: 'Mbyll',
        }
      : {
          unavailable: 'The built-in YouTube player is not available in this build. You can still open the video in YouTube.',
          externalError: 'FILMA could not open YouTube.',
          openYoutube: 'Open YouTube',
          close: 'Close',
        };

  const openExternal = useCallback(async () => {
    setError(undefined);
    if (Platform.OS === 'android') {
      try {
        await Linking.openURL(`vnd.youtube:${encodeURIComponent(videoId)}`);
        return;
      } catch {
        // Fall through to the HTTPS player when the YouTube app is absent.
      }
    }

    try {
      await Linking.openURL(youtubeWatchUrl(videoId));
    } catch {
      setError(copy.externalError);
    }
  }, [copy.externalError, videoId]);

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} presentationStyle="fullScreen">
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <View style={styles.headingText}>
            <Text numberOfLines={1} style={styles.title}>{title}</Text>
            {channelTitle ? <Text numberOfLines={1} style={styles.channel}>{channelTitle}</Text> : null}
          </View>
          <View style={styles.actions}>
            <FocusButton compact label={copy.openYoutube} onPress={() => void openExternal()} />
            <FocusButton compact label={copy.close} active preferredFocus={!embedded} onPress={onClose} />
          </View>
        </View>

        {embedded ? (
          <View style={styles.playerShell}>
            <FilmaYouTubePlayer videoId={videoId} style={styles.player} />
          </View>
        ) : (
          <View style={styles.fallback}>
            <View style={styles.youtubeMark}><Text style={styles.youtubeMarkText}>▶</Text></View>
            <Text style={styles.fallbackText}>{copy.unavailable}</Text>
            <FocusButton label={copy.openYoutube} active onPress={() => void openExternal()} />
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: {
    minHeight: Platform.isTV ? 76 : 58,
    paddingHorizontal: Platform.isTV ? 34 : 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#080b12',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headingText: { flex: 1, minWidth: 0 },
  title: { color: theme.text, fontWeight: '900', fontSize: Platform.isTV ? 20 : 15 },
  channel: { color: theme.muted, fontSize: Platform.isTV ? 13 : 11, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  playerShell: { flex: 1, backgroundColor: '#000' },
  player: { flex: 1, width: '100%', backgroundColor: '#000' },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 20,
  },
  youtubeMark: {
    width: Platform.isTV ? 76 : 58,
    height: Platform.isTV ? 52 : 40,
    borderRadius: 13,
    backgroundColor: '#ff0033',
    alignItems: 'center',
    justifyContent: 'center',
  },
  youtubeMarkText: { color: '#fff', fontSize: Platform.isTV ? 25 : 18, fontWeight: '900' },
  fallbackText: { color: theme.muted, maxWidth: 640, textAlign: 'center', fontSize: Platform.isTV ? 18 : 14, lineHeight: Platform.isTV ? 26 : 20 },
  error: { color: '#fda4af', backgroundColor: '#3b1018', paddingHorizontal: 14, paddingVertical: 10, textAlign: 'center' },
});
