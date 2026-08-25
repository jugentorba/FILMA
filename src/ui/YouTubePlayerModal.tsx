import React from 'react';

type Props = {
  videoId: string;
  title: string;
  channelTitle?: string;
  onClose(): void;
};

// tvOS has no supported WebView. FILMA uses YouTube's own URL handoff on
// Apple TV instead of loading an unsupported embedded player implementation.
export function YouTubePlayerModal(_props: Props) {
  return null;
}
