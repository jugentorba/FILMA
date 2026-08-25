import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import FilmaYouTubePlayer from '../../modules/filma-youtube-player';
import { FocusButton } from './FocusButton';
import { theme } from './theme';

type Props = {
  videoId: string;
  title: string;
  channelTitle?: string;
  onClose(): void;
};

export function YouTubePlayerModal({ videoId, title, channelTitle, onClose }: Props) {
  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose} hardwareAccelerated>
      <View style={styles.root}>
        <View style={styles.header}>
          <View style={styles.heading}>
            <Text numberOfLines={1} style={styles.title}>{title}</Text>
            {channelTitle ? <Text numberOfLines={1} style={styles.channel}>{channelTitle}</Text> : null}
          </View>
          <FocusButton compact label="Close" onPress={onClose} />
        </View>
        <View style={styles.playerShell}>
          <FilmaYouTubePlayer videoId={videoId} style={styles.player} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: {
    minHeight: 76,
    paddingHorizontal: 30,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    backgroundColor: '#080a0f',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  heading: { flex: 1 },
  title: { color: theme.text, fontSize: 20, fontWeight: '900' },
  channel: { color: theme.muted, marginTop: 4, fontSize: 13 },
  playerShell: { flex: 1, backgroundColor: '#000', alignItems: 'stretch', justifyContent: 'center' },
  player: { flex: 1, minHeight: 270, backgroundColor: '#000' },
});
