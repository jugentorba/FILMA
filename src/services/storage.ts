import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FilmaState } from '../types';
import { defaultState, normalizeState } from './stateSchema';

const STORAGE_KEY = 'filma.state.v2';
const LEGACY_STORAGE_KEY = 'filma.state.v1';

async function readState(key: string): Promise<FilmaState | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;

  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function loadState(): Promise<FilmaState> {
  const current = await readState(STORAGE_KEY);
  if (current) return current;

  const legacy = await readState(LEGACY_STORAGE_KEY);
  if (legacy) {
    await saveState(legacy);
    return legacy;
  }

  return { ...defaultState };
}

export async function saveState(state: FilmaState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export { defaultState };
