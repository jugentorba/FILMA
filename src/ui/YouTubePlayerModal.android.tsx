import React from 'react';
import { Modal, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import FilmaYouTubePlayer from '../../modules/filma-youtube-player';
import { stringsFor } from '../i18n';
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
  const text = stringsFor(state.preferences.appLanguage);

  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <View style={styles.titleWrap}>
            <Text numberOfLines={1} style={styles.title}>{title}</Text>
            {channelTitle ? <Text numberOfLines={1} style={styles.channel}>{channelTitle}</Text> : null}
          </View>
          <FocusButton compact label={text.dismiss} onPress={onClose} />
        </View>
        <View style={styles.playerWrap}>
          <FilmaYouTubePlayer videoId={videoId} style={styles.player} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: {
    minHeight: Platform.isTV ? 82 : 64,
    paddingHorizontal: Platform.isTV ? 42 : 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#080b12',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  titleWrap: { flex: 1 },
  title: { color: theme.text, fontSize: Platform.isTV ? 22 : 17, fontWeight: '900' },
  channel: { color: theme.muted, fontSize: Platform.isTV ? 14 : 12, marginTop: 4 },
  playerWrap: { flex: 1, backgroundColor: '#000', minHeight: 260 },
  player: { flex: 1, backgroundColor: '#000' },
});
