export type AppMode = 'movies' | 'live';

export type MediaItem = {
  id: string;
  title: string;
  subtitle?: string;
  poster?: string;
  backdrop?: string;
  streamUrl?: string;
  durationSeconds?: number;
  genres?: string[];
  year?: number;
};

export type WatchProgress = {
  mediaId: string;
  positionSeconds: number;
  durationSeconds: number;
  updatedAt: string;
  deviceId: string;
};

export type Favorite = {
  mediaId: string;
  createdAt: string;
};

export type PlaylistSource = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  lastCheckedAt?: string;
  lastHealthyAt?: string;
  error?: string;
};

export type LiveChannel = {
  id: string;
  name: string;
  url: string;
  logo?: string;
  group?: string;
  tvgId?: string;
};

export type AddonSource = {
  id: string;
  name: string;
  manifestUrl: string;
  enabled: boolean;
};

export type FilmaState = {
  mode: AppMode;
  progress: Record<string, WatchProgress>;
  favorites: Record<string, Favorite>;
  playlists: PlaylistSource[];
  addons: AddonSource[];
};

export type SyncEnvelope = {
  schemaVersion: 1;
  updatedAt: string;
  state: FilmaState;
};
