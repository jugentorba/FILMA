import type {
  AddonSource,
  AppPreferences,
  Favorite,
  FilmaState,
  PlaylistSource,
  SyncEnvelope,
  UserProfile,
  WatchProgress,
} from '../types';
import { DEFAULT_PROFILE_ID } from './profiles';

export function makeSyncEnvelope(state: FilmaState): SyncEnvelope {
  return {
    schemaVersion: 3,
    updatedAt: new Date().toISOString(),
    state,
  };
}

function time(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function newest<T extends { updatedAt: string }>(local?: T, remote?: T): T | undefined {
  if (!local) return remote;
  if (!remote) return local;
  return time(local.updatedAt) >= time(remote.updatedAt) ? local : remote;
}

function mergeProgress(
  local: Record<string, WatchProgress>,
  remote: Record<string, WatchProgress>,
): Record<string, WatchProgress> {
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  const result: Record<string, WatchProgress> = {};

  for (const key of keys) {
    const merged = newest(local[key], remote[key]);
    if (merged) result[key] = merged;
  }

  return result;
}

function mergeFavorites(
  local: Record<string, Favorite>,
  remote: Record<string, Favorite>,
): Record<string, Favorite> {
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  const result: Record<string, Favorite> = {};

  for (const key of keys) {
    const merged = newest(local[key], remote[key]);
    if (merged) result[key] = merged;
  }

  return result;
}

function mergeTimestampedArrays<T extends { id: string; updatedAt: string }>(local: T[], remote: T[]): T[] {
  const localById = new Map(local.map(item => [item.id, item]));
  const remoteById = new Map(remote.map(item => [item.id, item]));
  const orderedIds = [
    ...local.map(item => item.id),
    ...remote.map(item => item.id).filter(id => !localById.has(id)),
  ];

  return orderedIds.flatMap(id => {
    const merged = newest(localById.get(id), remoteById.get(id));
    return merged ? [merged] : [];
  });
}

const FALLBACK_PREFERENCES: AppPreferences = {
  appLanguage: 'en',
  preferredAudioLanguages: [],
  interfaceDensity: 'compact',
  updatedAt: '1970-01-01T00:00:00.000Z',
};

export function mergeStates(local: FilmaState, remote: FilmaState): FilmaState {
  const profiles = mergeTimestampedArrays<UserProfile>(local.profiles ?? [], remote.profiles ?? []);
  const requestedProfileId = local.activeProfileId || remote.activeProfileId || DEFAULT_PROFILE_ID;
  const activeProfileId = profiles.some(profile => profile.id === requestedProfileId && !profile.deletedAt)
    ? requestedProfileId
    : profiles.find(profile => !profile.deletedAt)?.id ?? DEFAULT_PROFILE_ID;

  return {
    // Screen and currently selected profile remain local to the device.
    mode: local.mode,
    activeProfileId,
    profiles,
    preferences: newest(local.preferences, remote.preferences) ?? local.preferences ?? remote.preferences ?? FALLBACK_PREFERENCES,
    progress: mergeProgress(local.progress, remote.progress),
    favorites: mergeFavorites(local.favorites, remote.favorites),
    playlists: mergeTimestampedArrays<PlaylistSource>(local.playlists, remote.playlists),
    addons: mergeTimestampedArrays<AddonSource>(local.addons, remote.addons),
  };
}

export interface CloudSyncAdapter {
  pull(): Promise<SyncEnvelope | null>;
  push(envelope: SyncEnvelope): Promise<void>;
}

export async function syncNow(
  adapter: CloudSyncAdapter,
  local: FilmaState,
): Promise<FilmaState> {
  const remote = await adapter.pull();
  const merged = remote ? mergeStates(local, remote.state) : local;
  await adapter.push(makeSyncEnvelope(merged));
  return merged;
}
