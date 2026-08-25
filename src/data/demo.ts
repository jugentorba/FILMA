import type { MediaItem } from '../types';

export const demoMovies: MediaItem[] = [
  {
    id: 'demo-big-buck-bunny',
    title: 'Big Buck Bunny',
    subtitle: 'Open movie demo',
    year: 2008,
    genres: ['Animation', 'Comedy'],
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  },
  {
    id: 'demo-elephants-dream',
    title: 'Elephants Dream',
    subtitle: 'Open movie demo',
    year: 2006,
    genres: ['Animation', 'Sci-Fi'],
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  },
  {
    id: 'demo-for-bigger-blazes',
    title: 'For Bigger Blazes',
    subtitle: 'Playback test clip',
    genres: ['Demo'],
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  },
];
