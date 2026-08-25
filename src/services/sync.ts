import type { FilmaState, SyncEnvelope, WatchProgress } from '../types';

export function makeSyncEnvelope(state: FilmaState): SyncEnvelope {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    state,
  };
}

function newestProgress(a?: WatchProgress, b?: WatchProgress): WatchProgress | undefined {
  if (!a) return b;
  if (!b) return a;
  return new Date(a.updatedAt).getTime() >= new Date(b.updatedAt).getTime() ? a : b;
}

export function mergeStates(local: FilmaState, remote: FilmaState): FilmaState {
  const progressKeys = new Set([...Object.keys(local.progress), ...Object.keys(remote.progress)]);
  const progress: FilmaState['progress'] = {};

  for (const key of progressKeys) {
    const merged = newestProgress(local.progress[key], remote.progress[key]);
    if (merged) progress[key] = merged;
  }

  return {
    mode: local.mode,
    progress,
    favorites: { ...remote.favorites, ...local.favorites },
    playlists: local.playlists.length ? local.playlists : remote.playlists,
    addons: local.addons.length ? local.addons : remote.addons,
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
