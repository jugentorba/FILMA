import { requireNativeViewManager } from 'expo-modules-core';
import type { ComponentType } from 'react';
import { Platform } from 'react-native';
import type { ViewProps } from 'react-native';

export type FilmaYouTubePlayerProps = ViewProps & {
  videoId: string;
};

function UnsupportedFilmaYouTubePlayer(_props: FilmaYouTubePlayerProps) {
  return null;
}

export let filmaYouTubePlayerAvailable = false;

let FilmaYouTubePlayer: ComponentType<FilmaYouTubePlayerProps> = UnsupportedFilmaYouTubePlayer;
if (Platform.OS === 'android') {
  try {
    FilmaYouTubePlayer = requireNativeViewManager<FilmaYouTubePlayerProps>('FilmaYouTubePlayer') as ComponentType<FilmaYouTubePlayerProps>;
    filmaYouTubePlayerAvailable = true;
  } catch {
    // Expo Go and non-native test environments do not contain FILMA's local
    // Android view manager. Keep the JS fallback usable instead of crashing.
  }
}

export default FilmaYouTubePlayer;
