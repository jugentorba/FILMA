import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { CloudSyncAdapter } from '../services/sync';
import { syncNow } from '../services/sync';
import { loadState, saveState } from '../services/storage';
import type { AddonSource, AppMode, FilmaState, PlaylistSource } from '../types';

const DEVICE_KEY = 'filma.device.id';

type FilmaContextValue = {
  ready: boolean;
  deviceId: string;
  state: FilmaState;
  setMode(mode: AppMode): void;
  toggleFavorite(mediaId: string): void;
  updateProgress(mediaId: string, positionSeconds: number, durationSeconds: number): void;
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

  useEffect(() => {
    Promise.all([loadState(), loadDeviceId()]).then(([storedState, storedDeviceId]) => {
      setState(storedState);
      setDeviceId(storedDeviceId);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (ready) void saveState(state);
  }, [ready, state]);

  const setMode = useCallback((mode: AppMode) => {
    setState(current => ({ ...current, mode }));
  }, []);

  const toggleFavorite = useCallback((mediaId: string) => {
    setState(current => {
      const favorites = { ...current.favorites };
      if (favorites[mediaId]) delete favorites[mediaId];
      else favorites[mediaId] = { mediaId, createdAt: new Date().toISOString() };
      return { ...current, favorites };
    });
  }, []);

  const updateProgress = useCallback((mediaId: string, positionSeconds: number, durationSeconds: number) => {
    setState(current => ({
      ...current,
      progress: {
        ...current.progress,
        [mediaId]: {
          mediaId,
          positionSeconds: Math.max(0, positionSeconds),
          durationSeconds: Math.max(0, durationSeconds),
          updatedAt: new Date().toISOString(),
          deviceId,
        },
      },
    }));
  }, [deviceId]);

  const addPlaylist = useCallback((name: string, url: string) => {
    const playlist: PlaylistSource = { id: makeId('playlist'), name, url, enabled: true };
    setState(current => ({ ...current, playlists: [...current.playlists, playlist] }));
  }, []);

  const removePlaylist = useCallback((id: string) => {
    setState(current => ({ ...current, playlists: current.playlists.filter(item => item.id !== id) }));
  }, []);

  const addAddon = useCallback((name: string, manifestUrl: string) => {
    const addon: AddonSource = { id: makeId('addon'), name, manifestUrl, enabled: true };
    setState(current => ({ ...current, addons: [...current.addons, addon] }));
  }, []);

  const removeAddon = useCallback((id: string) => {
    setState(current => ({ ...current, addons: current.addons.filter(item => item.id !== id) }));
  }, []);

  const syncWith = useCallback(async (adapter: CloudSyncAdapter) => {
    const merged = await syncNow(adapter, state);
    setState(merged);
  }, [state]);

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
