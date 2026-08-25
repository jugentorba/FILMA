import type {
  AddonSource,
  AppLanguage,
  AppMode,
  AppPreferences,
  AudioLanguage,
  Favorite,
  FilmaState,
  MediaResumeSnapshot,
  MediaSource,
  PlaylistSource,
  SyncEnvelope,
  WatchProgress,
} from '../types';

export const LEGACY_TIMESTAMP = '1970-01-01T00:00:00.000Z';

export const defaultPreferences: AppPreferences = {
  appLanguage: 'en',
  preferredAudioLanguages: [],
  updatedAt: LEGACY_TIMESTAMP,
};

export const defaultState: FilmaState = {
  mode: 'movies',
  preferences: defaultPreferences,
  progress: {},
  favorites: {},
  playlists: [],
  addons: [],
};

type UnknownRecord = Record<string, unknown>;

const APP_LANGUAGES = new Set<AppLanguage>(['en', 'fr', 'sq']);
const AUDIO_LANGUAGES = new Set<AudioLanguage>(['en', 'fr', 'sq', 'it', 'es', 'de', 'tr']);

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length ? value : undefined;
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function timestamp(value: unknown, fallback = LEGACY_TIMESTAMP): string {
  const text = stringValue(value);
  return text && Number.isFinite(Date.parse(text)) ? text : fallback;
}

function normalizeMode(value: unknown): AppMode {
  return value === 'live' ? 'live' : 'movies';
}

function normalizePreferences(value: unknown): AppPreferences {
  if (!isRecord(value)) return { ...defaultPreferences };

  const appLanguage = typeof value.appLanguage === 'string' && APP_LANGUAGES.has(value.appLanguage as AppLanguage)
    ? value.appLanguage as AppLanguage
    : 'en';
  const preferredAudioLanguages = Array.isArray(value.preferredAudioLanguages)
    ? [...new Set(value.preferredAudioLanguages.filter((language): language is AudioLanguage =>
      typeof language === 'string' && AUDIO_LANGUAGES.has(language as AudioLanguage)))]
    : [];

  return {
    appLanguage,
    preferredAudioLanguages,
    updatedAt: timestamp(value.updatedAt),
  };
}

function normalizeMediaSource(value: unknown): MediaSource | undefined {
  if (!isRecord(value)) return undefined;
  if (value.kind === 'direct') return { kind: 'direct' };
  if (value.kind !== 'stremio') return undefined;

  const manifestUrl = stringValue(value.manifestUrl);
  const mediaType = stringValue(value.mediaType);
  const mediaId = stringValue(value.mediaId);
  if (!manifestUrl || !mediaType || !mediaId) return undefined;

  const videoId = stringValue(value.videoId);
  return {
    kind: 'stremio',
    manifestUrl,
    mediaType,
    mediaId,
    ...(videoId ? { videoId } : {}),
  };
}

function normalizeResumeItem(value: unknown): MediaResumeSnapshot | undefined {
  if (!isRecord(value)) return undefined;
  const id = stringValue(value.id);
  const title = stringValue(value.title);
  if (!id || !title) return undefined;

  const genres = Array.isArray(value.genres)
    ? value.genres.filter((genre): genre is string => typeof genre === 'string')
    : undefined;
  const source = normalizeMediaSource(value.source);
  const year = typeof value.year === 'number' && Number.isFinite(value.year) ? value.year : undefined;

  return {
    id,
    title,
    ...(stringValue(value.subtitle) ? { subtitle: stringValue(value.subtitle) } : {}),
    ...(stringValue(value.poster) ? { poster: stringValue(value.poster) } : {}),
    ...(stringValue(value.backdrop) ? { backdrop: stringValue(value.backdrop) } : {}),
    ...(source ? { source } : {}),
    ...(genres?.length ? { genres } : {}),
    ...(year !== undefined ? { year } : {}),
  };
}

function normalizeProgress(value: unknown): Record<string, WatchProgress> {
  if (!isRecord(value)) return {};
  const result: Record<string, WatchProgress> = {};

  for (const [key, raw] of Object.entries(value)) {
    if (!isRecord(raw)) continue;
    const mediaId = stringValue(raw.mediaId) ?? key;
    const item = normalizeResumeItem(raw.item);
    result[key] = {
      mediaId,
      positionSeconds: Math.max(0, finiteNumber(raw.positionSeconds)),
      durationSeconds: Math.max(0, finiteNumber(raw.durationSeconds)),
      updatedAt: timestamp(raw.updatedAt),
      deviceId: stringValue(raw.deviceId) ?? 'legacy',
      ...(raw.completed === true ? { completed: true } : {}),
      ...(item ? { item } : {}),
    };
  }

  return result;
}

function normalizeFavorites(value: unknown): Record<string, Favorite> {
  if (!isRecord(value)) return {};
  const result: Record<string, Favorite> = {};

  for (const [key, raw] of Object.entries(value)) {
    if (!isRecord(raw)) continue;
    const mediaId = stringValue(raw.mediaId) ?? key;
    const createdAt = timestamp(raw.createdAt);
    const deletedAt = stringValue(raw.deletedAt);
    result[key] = {
      mediaId,
      createdAt,
      updatedAt: timestamp(raw.updatedAt, deletedAt ? timestamp(deletedAt, createdAt) : createdAt),
      ...(deletedAt ? { deletedAt: timestamp(deletedAt, createdAt) } : {}),
    };
  }

  return result;
}

function normalizePlaylist(raw: unknown): PlaylistSource | null {
  if (!isRecord(raw)) return null;
  const id = stringValue(raw.id);
  const url = stringValue(raw.url);
  if (!id || !url) return null;

  const createdAt = timestamp(raw.createdAt);
  const deletedAt = stringValue(raw.deletedAt);
  return {
    id,
    name: stringValue(raw.name) ?? 'My playlist',
    url,
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
    createdAt,
    updatedAt: timestamp(raw.updatedAt, deletedAt ? timestamp(deletedAt, createdAt) : createdAt),
    ...(deletedAt ? { deletedAt: timestamp(deletedAt, createdAt) } : {}),
    ...(stringValue(raw.lastCheckedAt) ? { lastCheckedAt: timestamp(raw.lastCheckedAt) } : {}),
    ...(stringValue(raw.lastHealthyAt) ? { lastHealthyAt: timestamp(raw.lastHealthyAt) } : {}),
    ...(stringValue(raw.error) ? { error: stringValue(raw.error) } : {}),
  };
}

function normalizeAddon(raw: unknown): AddonSource | null {
  if (!isRecord(raw)) return null;
  const id = stringValue(raw.id);
  const manifestUrl = stringValue(raw.manifestUrl);
  if (!id || !manifestUrl) return null;

  const createdAt = timestamp(raw.createdAt);
  const deletedAt = stringValue(raw.deletedAt);
  return {
    id,
    name: stringValue(raw.name) ?? 'My add-on',
    manifestUrl,
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
    createdAt,
    updatedAt: timestamp(raw.updatedAt, deletedAt ? timestamp(deletedAt, createdAt) : createdAt),
    ...(deletedAt ? { deletedAt: timestamp(deletedAt, createdAt) } : {}),
  };
}

function normalizeArray<T>(value: unknown, normalize: (raw: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalize).filter((item): item is T => item !== null);
}

export function normalizeState(value: unknown): FilmaState {
  if (!isRecord(value)) return { ...defaultState, preferences: { ...defaultPreferences } };
  return {
    mode: normalizeMode(value.mode),
    preferences: normalizePreferences(value.preferences),
    progress: normalizeProgress(value.progress),
    favorites: normalizeFavorites(value.favorites),
    playlists: normalizeArray(value.playlists, normalizePlaylist),
    addons: normalizeArray(value.addons, normalizeAddon),
  };
}

export function normalizeSyncEnvelope(value: unknown): SyncEnvelope | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== 1 && value.schemaVersion !== 2) return null;
  if (!isRecord(value.state)) return null;

  return {
    schemaVersion: 2,
    updatedAt: timestamp(value.updatedAt),
    state: normalizeState(value.state),
  };
}
