export type AppMode = 'movies' | 'live';

export type AppLanguage = 'en' | 'fr' | 'sq';
export type AudioLanguage = 'en' | 'fr' | 'sq' | 'it' | 'es' | 'de' | 'tr';

export type AppPreferences = {
  appLanguage: AppLanguage;
  preferredAudioLanguages: AudioLanguage[];
  updatedAt: string;
};

export type MediaSource =
  | { kind: 'direct' }
  | {
      kind: 'stremio';
      manifestUrl: string;
      mediaType: string;
      mediaId: string;
      videoId?: string;
    };

export type MediaItem = {
  id: string;
  title: string;
  subtitle?: string;
  poster?: string;
  backdrop?: string;
  streamUrl?: string;
  source?: MediaSource;
  durationSeconds?: number;
  genres?: string[];
  year?: number;
};

export type MediaResumeSnapshot = {
  id: string;
  title: string;
  subtitle?: string;
  poster?: string;
  backdrop?: string;
  source?: MediaSource;
  genres?: string[];
  year?: number;
};

export type WatchProgress = {
  mediaId: string;
  positionSeconds: number;
  durationSeconds: number;
  updatedAt: string;
  deviceId: string;
  completed?: boolean;
  item?: MediaResumeSnapshot;
};

export type Favorite = {
  mediaId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

export type PlaylistSource = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
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
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

export type FilmaState = {
  mode: AppMode;
  preferences: AppPreferences;
  progress: Record<string, WatchProgress>;
  favorites: Record<string, Favorite>;
  playlists: PlaylistSource[];
  addons: AddonSource[];
};

export type SyncEnvelope = {
  schemaVersion: 2;
  updatedAt: string;
  state: FilmaState;
};
