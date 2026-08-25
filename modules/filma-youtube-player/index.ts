import { requireNativeViewManager } from 'expo-modules-core';
import type { ComponentType } from 'react';
import type { ViewProps } from 'react-native';

export type FilmaYouTubePlayerProps = ViewProps & {
  videoId: string;
};

const FilmaYouTubePlayer = requireNativeViewManager<FilmaYouTubePlayerProps>('FilmaYouTubePlayer') as ComponentType<FilmaYouTubePlayerProps>;

export default FilmaYouTubePlayer;
