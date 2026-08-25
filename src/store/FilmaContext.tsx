import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { CloudSyncAdapter } from '../services/sync';
import { makeSyncEnvelope, mergeStates } from '../services/sync';
import { loadState, saveState } from '../services/storage';
import type { AddonSource, AppMode, FilmaState, MediaItem, MediaResumeSnapshot, PlaylistSource } from '../types';

const DEVICE_KEY = 'filma.device.id';

type FilmaContextValue = {
  ready: boolean;
  deviceId: string;
  state: FilmaState;
  setMode(mode: AppMode): void;
  toggleFavorite(mediaId: string): void;
  updateProgress(item: MediaItem, positionSeconds: number, durationSeconds: number): void;
  addPlaylist(name: string, url: string): void;
  removePlaylist(id: string): void;
  addAddon(name: string, manifestUrl: string): void;
  removeAddon(id: string): void;
  syncWith(adapter: CloudSyncAdapter): Promise<void>;
};

const FilmaContext = createContext<FilmaContextValue | null>(null);

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

function resumeSnapshot(item: MediaItem): MediaResumeSnapshot {
  return {
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    poster: item.poster,
    backdrop: item.backdrop,
    source: item.source,
    genres: item.genres,
    year: item.year,
  };
}

async function loadDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const created = makeId('device');
  await AsyncStorage.setItem(DEVICE_KEY, created);
  return created;
}

export function FilmaProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [deviceId, setDeviceId] = useState('pending');
  const [state, setState] = useState<FilmaState>({
    mode: 'movies',
    progress: {},
    favorites: {},
    playlists: [],
    addons: [],
  });
  const stateRef = useRef(state);

  const commitState = useCallback((updater: (current: FilmaState) => FilmaState) => {
    setState(current => {
      const next = updater(current);
      stateRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    Promise.all([loadState(), loadDeviceId()]).then(([storedState, storedDeviceId]) => {
      stateRef.current = storedState;
      setState(storedState);
      setDeviceId(storedDeviceId);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (ready) void saveState(state);
  }, [ready, state]);

  const setMode = useCallback((mode: AppMode) => {
    commitState(current => ({ ...current, mode }));
  }, [commitState]);

  const toggleFavorite = useCallback((mediaId: string) => {
    commitState(current => {
      const at = now();
      const existing = current.favorites[mediaId];
      return {
        ...current,
        favorites: {
          ...current.favorites,
          [mediaId]: existing && !existing.deletedAt
            ? { ...existing, updatedAt: at, deletedAt: at }
            : {
                mediaId,
                createdAt: existing?.createdAt ?? at,
                updatedAt: at,
              },
        },
      };
    });
  }, [commitState]);

  const updateProgress = useCallback((item: MediaItem, positionSeconds: number, durationSeconds: number) => {
    commitState(current => ({
      ...current,
      progress: {
        ...current.progress,
        [item.id]: {
          mediaId: item.id,
          positionSeconds: Math.max(0, positionSeconds),
          durationSeconds: Math.max(0, durationSeconds),
          updatedAt: now(),
          deviceId,
          item: resumeSnapshot(item),
        },
      },
    }));
  }, [commitState, deviceId]);

  const addPlaylist = useCallback((name: string, url: string) => {
    const at = now();
    const playlist: PlaylistSource = {
      id: makeId('playlist'),
      name,
      url,
      enabled: true,
      createdAt: at,
      updatedAt: at,
    };
    commitState(current => ({ ...current, playlists: [...current.playlists, playlist] }));
  }, [commitState]);

  const removePlaylist = useCallback((id: string) => {
    const at = now();
    commitState(current => ({
      ...current,
      playlists: current.playlists.map(item => item.id === id && !item.deletedAt
        ? { ...item, updatedAt: at, deletedAt: at }
        : item),
    }));
  }, [commitState]);

  const addAddon = useCallback((name: string, manifestUrl: string) => {
    const at = now();
    const addon: AddonSource = {
      id: makeId('addon'),
      name,
      manifestUrl,
      enabled: true,
      createdAt: at,
      updatedAt: at,
    };
    commitState(current => ({ ...current, addons: [...current.addons, addon] }));
  }, [commitState]);

  const removeAddon = useCallback((id: string) => {
    const at = now();
    commitState(current => ({
      ...current,
      addons: current.addons.map(item => item.id === id && !item.deletedAt
        ? { ...item, updatedAt: at, deletedAt: at }
        : item),
    }));
  }, [commitState]);

  const syncWith = useCallback(async (adapter: CloudSyncAdapter) => {
    const remote = await adapter.pull();
    const localAtStart = stateRef.current;
    const merged = remote ? mergeStates(localAtStart, remote.state) : localAtStart;
    await adapter.push(makeSyncEnvelope(merged));

    const latestLocal = stateRef.current;
    const finalState = latestLocal === localAtStart ? merged : mergeStates(latestLocal, merged);
    if (latestLocal !== localAtStart) {
      await adapter.push(makeSyncEnvelope(finalState));
    }

    stateRef.current = finalState;
    setState(finalState);
  }, []);

  const value = useMemo<FilmaContextValue>(() => ({
    ready,
    deviceId,
    state,
    setMode,
    toggleFavorite,
    updateProgress,
    addPlaylist,
    removePlaylist,
    addAddon,
    removeAddon,
    syncWith,
  }), [
    addAddon,
    addPlaylist,
    deviceId,
    ready,
    removeAddon,
    removePlaylist,
    setMode,
    state,
    syncWith,
    toggleFavorite,
    updateProgress,
  ]);

  return <FilmaContext.Provider value={value}>{children}</FilmaContext.Provider>;
}

export function useFilma(): FilmaContextValue {
  const context = useContext(FilmaContext);
  if (!context) throw new Error('useFilma must be used inside FilmaProvider');
  return context;
}
