import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

const TV_MODE_KEY = 'filma.device.tvMode';

type DeviceModeOverride = 'auto' | 'phone' | 'tv';

type DeviceModeContextValue = {
  tvModeEnabled: boolean;
  isTvMode: boolean;
  setTvModeEnabled(enabled: boolean): void;
};

const DeviceModeContext = createContext<DeviceModeContextValue | null>(null);

export function DeviceModeProvider({ children }: { children: React.ReactNode }) {
  const [override, setOverride] = useState<DeviceModeOverride>('auto');

  useEffect(() => {
    void AsyncStorage.getItem(TV_MODE_KEY).then(value => {
      if (value === '1' || value === 'tv') setOverride('tv');
      else if (value === '0' || value === 'phone') setOverride('phone');
      else setOverride('auto');
    }).catch(() => undefined);
  }, []);

  const setTvModeEnabled = useCallback((enabled: boolean) => {
    const next: DeviceModeOverride = enabled ? 'tv' : 'phone';
    setOverride(next);
    void AsyncStorage.setItem(TV_MODE_KEY, next).catch(() => undefined);
  }, []);

  const isTvMode = override === 'tv'
    ? true
    : override === 'phone'
      ? false
      : Platform.isTV;

  const value = useMemo<DeviceModeContextValue>(() => ({
    tvModeEnabled: isTvMode,
    isTvMode,
    setTvModeEnabled,
  }), [isTvMode, setTvModeEnabled]);

  return <DeviceModeContext.Provider value={value}>{children}</DeviceModeContext.Provider>;
}

export function useDeviceMode(): DeviceModeContextValue {
  const context = useContext(DeviceModeContext);
  if (!context) throw new Error('useDeviceMode must be used inside DeviceModeProvider');
  return context;
}
