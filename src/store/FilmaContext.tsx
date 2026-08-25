import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { deleteXtreamCredentials, saveXtreamCredentials, validateXtreamAccount } from '../services/iptvAuth';
import { deleteLocalPlaylistFile } from '../services/localPlaylist';
import { DEFAULT_PROFILE_ID, favoritesForProfile, profileMediaKey, progressForProfile } from '../services/profiles';
import { CONTINUE_WATCHING_MIN_SECONDS, isPlaybackComplete } from '../services/progress';
import { automaticTvPlaylists, discoverOfficialMovieProviders } from '../services/sourceDiscovery';
import { defaultState } from '../services/stateSchema';
import type { CloudSyncAdapter } from '../services/sync';
import { makeSyncEnvelope, mergeStates } from '../services/sync';
import { loadState, saveState } from '../services/storage';
import type { AddonSource, AppLanguage, AppMode, AppPreferences, AudioLanguage, FilmaState, InterfaceDensity, MediaItem, MediaResumeSnapshot, PlaylistSource } from '../types';

const DEVICE_KEY = 'filma.device.id';
const AUTO_MOVIE_PREFIX = 'auto-stremio:';
const AUTO_TV_PREFIX = 'auto-tv:';

type PreferencePatch = Partial<Pick<AppPreferences, 'appLanguage' | 'preferredAudioLanguages' | 'interfaceDensity'>>;

type FilmaContextValue = {
  ready: boolean;
  deviceId: string;
  state: FilmaState;
  setMode(mode: AppMode): void;
  setActiveProfile(id: string): void;
  addProfile(name: string): void;
  renameProfile(id: string, name: string): void;
  removeProfile(id: string): void;
  updatePreferences(patch: PreferencePatch): void;
  setAppLanguage(language: AppLanguage): void;
  toggleAudioLanguage(language: AudioLanguage): void;
  clearAudioLanguages(): void;
  setInterfaceDensity(density: InterfaceDensity): void;
  toggleFavorite(mediaId: string): void;
  updateProgress(item: MediaItem, positionSeconds: number, durationSeconds: number): void;
  addPlaylist(name: string, url: string): void;
  addLocalPlaylist(name: string, uri: string): void;
  addXtreamPlaylist(name: string, baseUrl: string, username: string, password: string): Promise<void>;
  setPlaylistEnabled(id: string, enabled: boolean): void;
  removePlaylist(id: string): void;
  addAddon(name: string, manifestUrl: string): void;
  setAddonEnabled(id: string, enabled: boolean): void;
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

function freshDefaultState(): FilmaState {
  return {
    ...defaultState,
    profiles: defaultState.profiles.map(profile => ({ ...profile })),
    preferences: { ...defaultState.preferences, preferredAudioLanguages: [...defaultState.preferences.preferredAudioLanguages] },
    progress: {},
    favorites: {},
    playlists: [],
    addons: [],
  };
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

function stripAutomaticSources(input: FilmaState): FilmaState {
  const playlists = input.playlists.filter(source => !source.id.startsWith(AUTO_TV_PREFIX));
  const addons = input.addons.filter(source => !source.id.startsWith(AUTO_MOVIE_PREFIX));
  if (playlists.length === input.playlists.length && addons.length === input.addons.length) return input;
  return { ...input, playlists, addons };
}

function syncableState(input: FilmaState): FilmaState {
  const clean = stripAutomaticSources(input);
  const playlists = clean.playlists.filter(source => source.kind !== 'file');
  return playlists.length === clean.playlists.length ? clean : { ...clean, playlists };
}

function restoreLocalPlaylists(synced: FilmaState, local: FilmaState): FilmaState {
  const localFiles = local.playlists.filter(source => source.kind === 'file');
  if (!localFiles.length) return synced;
  return {
    ...synced,
    playlists: [
      ...synced.playlists.filter(source => source.kind !== 'file'),
      ...localFiles,
    ],
  };
}

function appendRuntimeAddons(configured: AddonSource[], automatic: AddonSource[]): AddonSource[] {
  const urls = new Set(configured.map(source => source.manifestUrl.trim().toLocaleLowerCase()));
  return [
    ...configured,
    ...automatic.filter(source => {
      const key = source.manifestUrl.trim().toLocaleLowerCase();
      if (urls.has(key)) return false;
      urls.add(key);
      return true;
    }),
  ];
}

function appendRuntimePlaylists(configured: PlaylistSource[], automatic: PlaylistSource[]): PlaylistSource[] {
  const urls = new Set(configured.map(source => source.url.trim().toLocaleLowerCase()));
  return [
    ...configured,
    ...automatic.filter(source => {
      const key = source.url.trim().toLocaleLowerCase();
      if (urls.has(key)) return false;
      urls.add(key);
      return true;
    }),
  ];
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
  const [state, setState] = useState<FilmaState>(freshDefaultState);
  const [automaticMovieProviders, setAutomaticMovieProviders] = useState<AddonSource[]>([]);
  const stateRef = useRef(state);

  const commitState = useCallback((updater: (current: FilmaState) => FilmaState) => {
    setState(current => {
      const next = stripAutomaticSources(updater(current));
      stateRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    Promise.all([loadState(), loadDeviceId()]).then(([storedState, storedDeviceId]) => {
      const cleanState = stripAutomaticSources(storedState);
      stateRef.current = cleanState;
      setState(cleanState);
      setDeviceId(storedDeviceId);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (ready) void saveState(state);
  }, [ready, state]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    void discoverOfficialMovieProviders().then(providers => {
      if (cancelled) return;
      const filmaFree = providers.find(provider => provider.id === 'auto-stremio:com.filma.archive');
      const cinemeta = providers.find(provider => provider.id === 'auto-stremio:com.linvo.cinemeta');
      const fallbackCatalog = providers.find(provider => provider.providesCatalog && provider.id !== filmaFree?.id);
      const selected = [filmaFree, cinemeta ?? fallbackCatalog].filter((provider): provider is AddonSource => Boolean(provider));
      setAutomaticMovieProviders(selected);
    }).catch(() => {
      if (!cancelled) setAutomaticMovieProviders([]);
    });

    return () => { cancelled = true; };
  }, [ready]);

  const effectiveState = useMemo<FilmaState>(() => {
    const movieRuntime = automaticMovieProviders;
    const tvRuntime = automaticTvPlaylists(
      state.preferences.preferredAudioLanguages,
      state.preferences.appLanguage,
    );

    return {
      ...state,
      progress: progressForProfile(state.progress, state.activeProfileId),
      favorites: favoritesForProfile(state.favorites, state.activeProfileId),
      addons: appendRuntimeAddons(state.addons, movieRuntime),
      playlists: appendRuntimePlaylists(state.playlists, tvRuntime),
    };
  }, [automaticMovieProviders, state]);

  const setMode = useCallback((mode: AppMode) => {
    commitState(current => ({ ...current, mode }));
  }, [commitState]);

  const setActiveProfile = useCallback((id: string) => {
    commitState(current => current.profiles.some(profile => profile.id === id && !profile.deletedAt)
      ? { ...current, activeProfileId: id }
      : current);
  }, [commitState]);

  const addProfile = useCallback((name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const at = now();
    const id = makeId('profile');
    commitState(current => ({
      ...current,
      activeProfileId: id,
      profiles: [...current.profiles, { id, name: cleanName, createdAt: at, updatedAt: at }],
    }));
  }, [commitState]);

  const renameProfile = useCallback((id: string, name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const at = now();
    commitState(current => ({
      ...current,
      profiles: current.profiles.map(profile => profile.id === id && !profile.deletedAt
        ? { ...profile, name: cleanName, updatedAt: at }
        : profile),
    }));
  }, [commitState]);

  const removeProfile = useCallback((id: string) => {
    const at = now();
    commitState(current => {
      const activeProfiles = current.profiles.filter(profile => !profile.deletedAt);
      if (activeProfiles.length <= 1 || !activeProfiles.some(profile => profile.id === id)) return current;
      const fallbackProfile = activeProfiles.find(profile => profile.id !== id) ?? activeProfiles[0];
      return {
        ...current,
        activeProfileId: current.activeProfileId === id ? fallbackProfile.id : current.activeProfileId,
        profiles: current.profiles.map(profile => profile.id === id && !profile.deletedAt
          ? { ...profile, updatedAt: at, deletedAt: at }
          : profile),
      };
    });
  }, [commitState]);

  const updatePreferences = useCallback((patch: PreferencePatch) => {
    commitState(current => ({
      ...current,
      preferences: {
        ...current.preferences,
        ...patch,
        preferredAudioLanguages: patch.preferredAudioLanguages
          ? [...new Set(patch.preferredAudioLanguages)]
          : current.preferences.preferredAudioLanguages,
        updatedAt: now(),
      },
    }));
  }, [commitState]);

  const setAppLanguage = useCallback((language: AppLanguage) => {
    updatePreferences({ appLanguage: language });
  }, [updatePreferences]);

  const toggleAudioLanguage = useCallback((language: AudioLanguage) => {
    const selected = stateRef.current.preferences.preferredAudioLanguages;
    updatePreferences({
      preferredAudioLanguages: selected.includes(language)
        ? selected.filter(item => item !== language)
        : [...selected, language],
    });
  }, [updatePreferences]);

  const clearAudioLanguages = useCallback(() => {
    updatePreferences({ preferredAudioLanguages: [] });
  }, [updatePreferences]);

  const setInterfaceDensity = useCallback((density: InterfaceDensity) => {
    updatePreferences({ interfaceDensity: density });
  }, [updatePreferences]);

  const toggleFavorite = useCallback((mediaId: string) => {
    commitState(current => {
      const at = now();
      const profileId = current.activeProfileId || DEFAULT_PROFILE_ID;
      const key = profileMediaKey(profileId, mediaId);
      const existing = current.favorites[key];
      return {
        ...current,
        favorites: {
          ...current.favorites,
          [key]: existing && !existing.deletedAt
            ? { ...existing, profileId, updatedAt: at, deletedAt: at }
            : {
                mediaId,
                profileId,
                createdAt: existing?.createdAt ?? at,
                updatedAt: at,
              },
        },
      };
    });
  }, [commitState]);

  const updateProgress = useCallback((item: MediaItem, positionSeconds: number, durationSeconds: number) => {
    commitState(current => {
      const profileId = current.activeProfileId || DEFAULT_PROFILE_ID;
      const key = profileMediaKey(profileId, item.id);
      const position = Math.max(0, positionSeconds);
      const duration = Math.max(0, durationSeconds);
      const existing = current.progress[key];
      const completedNow = isPlaybackComplete(position, duration);
      const preserveCompletedDuringShortRestart = Boolean(
        existing?.completed && position < CONTINUE_WATCHING_MIN_SECONDS && !completedNow,
      );

      return {
        ...current,
        progress: {
          ...current.progress,
          [key]: {
            mediaId: item.id,
            profileId,
            positionSeconds: position,
            durationSeconds: duration,
            updatedAt: now(),
            deviceId,
            completed: completedNow || preserveCompletedDuringShortRestart,
            item: resumeSnapshot(item),
          },
        },
      };
    });
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
      kind: 'm3u',
    };
    commitState(current => ({ ...current, playlists: [...current.playlists, playlist] }));
  }, [commitState]);

  const addLocalPlaylist = useCallback((name: string, uri: string) => {
    const at = now();
    const playlist: PlaylistSource = {
      id: makeId('file-playlist'),
      name,
      url: uri,
      enabled: true,
      createdAt: at,
      updatedAt: at,
      kind: 'file',
    };
    commitState(current => ({ ...current, playlists: [...current.playlists, playlist] }));
  }, [commitState]);

  const addXtreamPlaylist = useCallback(async (name: string, baseUrl: string, username: string, password: string) => {
    const validated = await validateXtreamAccount(baseUrl, username, password);
    const id = makeId('xtream');
    const credentialsKey = await saveXtreamCredentials(id, username, password);
    const at = now();
    const playlist: PlaylistSource = {
      id,
      name,
      url: validated.baseUrl,
      enabled: true,
      createdAt: at,
      updatedAt: at,
      kind: 'xtream',
      credentialsKey,
    };
    commitState(current => ({ ...current, playlists: [...current.playlists, playlist] }));
  }, [commitState]);

  const setPlaylistEnabled = useCallback((id: string, enabled: boolean) => {
    const at = now();
    commitState(current => ({
      ...current,
      playlists: current.playlists.map(item => item.id === id && !item.deletedAt
        ? { ...item, enabled, updatedAt: at }
        : item),
    }));
  }, [commitState]);

  const removePlaylist = useCallback((id: string) => {
    const source = stateRef.current.playlists.find(item => item.id === id && !item.deletedAt);
    if (source?.kind === 'xtream') {
      void deleteXtreamCredentials(source).catch(() => undefined);
    } else if (source?.kind === 'file') {
      void deleteLocalPlaylistFile(source).catch(() => undefined);
    }
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

  const setAddonEnabled = useCallback((id: string, enabled: boolean) => {
    const at = now();
    commitState(current => ({
      ...current,
      addons: current.addons.map(item => item.id === id && !item.deletedAt
        ? { ...item, enabled, updatedAt: at }
        : item),
    }));
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
    const stateAtStart = stateRef.current;
    const localAtStart = syncableState(stateAtStart);
    const remote = await adapter.pull();
    const remoteState = remote ? syncableState(remote.state) : null;
    const merged = remoteState ? mergeStates(localAtStart, remoteState) : localAtStart;
    await adapter.push(makeSyncEnvelope(merged));

    const latestState = stateRef.current;
    const latestSyncable = syncableState(latestState);
    const finalSyncedState = latestState === stateAtStart
      ? merged
      : mergeStates(latestSyncable, merged);
    if (latestState !== stateAtStart) {
      await adapter.push(makeSyncEnvelope(finalSyncedState));
    }

    const finalState = restoreLocalPlaylists(finalSyncedState, latestState);
    stateRef.current = finalState;
    setState(finalState);
  }, []);

  const value = useMemo<FilmaContextValue>(() => ({
    ready,
    deviceId,
    state: effectiveState,
    setMode,
    setActiveProfile,
    addProfile,
    renameProfile,
    removeProfile,
    updatePreferences,
    setAppLanguage,
    toggleAudioLanguage,
    clearAudioLanguages,
    setInterfaceDensity,
    toggleFavorite,
    updateProgress,
    addPlaylist,
    addLocalPlaylist,
    addXtreamPlaylist,
    setPlaylistEnabled,
    removePlaylist,
    addAddon,
    setAddonEnabled,
    removeAddon,
    syncWith,
  }), [
    addAddon,
    addLocalPlaylist,
    addPlaylist,
    addProfile,
    addXtreamPlaylist,
    clearAudioLanguages,
    deviceId,
    effectiveState,
    ready,
    removeAddon,
    removePlaylist,
    removeProfile,
    renameProfile,
    setActiveProfile,
    setAddonEnabled,
    setAppLanguage,
    setInterfaceDensity,
    setMode,
    setPlaylistEnabled,
    syncWith,
    toggleAudioLanguage,
    toggleFavorite,
    updatePreferences,
    updateProgress,
  ]);

  return <FilmaContext.Provider value={value}>{children}</FilmaContext.Provider>;
}

export function useFilma(): FilmaContextValue {
  const context = useContext(FilmaContext);
  if (!context) throw new Error('useFilma must be used inside FilmaProvider');
  return context;
}
