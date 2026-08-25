import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FilmaState } from '../types';

const STORAGE_KEY = 'filma.state.v1';

export const defaultState: FilmaState = {
  mode: 'movies',
  progress: {},
  favorites: {},
  playlists: [],
  addons: [],
};

export async function loadState(): Promise<FilmaState> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultState;

  try {
    const parsed = JSON.parse(raw) as Partial<FilmaState>;
    return {
      ...defaultState,
      ...parsed,
      progress: parsed.progress ?? {},
      favorites: parsed.favorites ?? {},
      playlists: parsed.playlists ?? [],
      addons: parsed.addons ?? [],
    };
  } catch {
    return defaultState;
  }
}

export async function saveState(state: FilmaState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
