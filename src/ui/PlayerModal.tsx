import { useEventListener } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useEffect, useRef } from 'react';
import { Modal, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
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
};

export function PlayerModal({ item, progress, onProgress, onClose, onToggleFavorite, favorite }: Props) {
  const progressHandler = useRef(onProgress);
  progressHandler.current = onProgress;

  const player = useVideoPlayer(item.streamUrl ?? null, instance => {
    instance.timeUpdateEventInterval = 5;
    if (!progress?.completed && progress?.positionSeconds && progress.positionSeconds > 5) {
      instance.currentTime = progress.positionSeconds;
    }
    instance.play();
  });

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (Number.isFinite(currentTime) && Number.isFinite(player.duration) && player.duration > 0) {
      progressHandler.current(currentTime, player.duration);
    }
  });

  useEffect(() => () => {
    if (Number.isFinite(player.currentTime) && Number.isFinite(player.duration) && player.duration > 0) {
      progressHandler.current(player.currentTime, player.duration);
    }
  }, [player]);

  return (
    <Modal visible animationType="fade" supportedOrientations={['landscape', 'portrait']} onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <VideoView
          style={styles.video}
          player={player}
          nativeControls
          contentFit="contain"
          fullscreenOptions={{ enable: true }}
        />
        <View style={styles.topBar}>
          <View style={styles.titleBlock}>
            <Text numberOfLines={1} style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle ?? 'FILMA player'}</Text>
          </View>
          <View style={styles.actions}>
            <FocusButton compact label={favorite ? '♥ Saved' : '♡ Favorite'} active={favorite} onPress={onToggleFavorite} />
            <FocusButton compact label="Close" onPress={onClose} />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  video: {
    flex: 1,
    backgroundColor: '#000',
  },
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
  titleBlock: {
    flex: 1,
    marginRight: 16,
  },
  title: {
    color: theme.text,
    fontSize: Platform.isTV ? 26 : 17,
    fontWeight: '800',
  },
  subtitle: {
    color: theme.muted,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
});
