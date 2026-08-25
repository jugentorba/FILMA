import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

const TV_MODE_KEY = 'filma.device.tvMode';

type DeviceModeContextValue = {
  tvModeEnabled: boolean;
  isTvMode: boolean;
  setTvModeEnabled(enabled: boolean): void;
};

const DeviceModeContext = createContext<DeviceModeContextValue | null>(null);

export function DeviceModeProvider({ children }: { children: React.ReactNode }) {
  const [tvModeEnabled, setTvModeEnabledState] = useState(false);

  useEffect(() => {
    if (Platform.isTV) return;
    void AsyncStorage.getItem(TV_MODE_KEY).then(value => {
      setTvModeEnabledState(value === '1');
    }).catch(() => undefined);
  }, []);

  const setTvModeEnabled = useCallback((enabled: boolean) => {
    if (Platform.isTV) return;
    setTvModeEnabledState(enabled);
    void AsyncStorage.setItem(TV_MODE_KEY, enabled ? '1' : '0').catch(() => undefined);
  }, []);

  const value = useMemo<DeviceModeContextValue>(() => ({
    tvModeEnabled,
    isTvMode: Platform.isTV || tvModeEnabled,
    setTvModeEnabled,
  }), [setTvModeEnabled, tvModeEnabled]);

  return <DeviceModeContext.Provider value={value}>{children}</DeviceModeContext.Provider>;
}

export function useDeviceMode(): DeviceModeContextValue {
  const context = useContext(DeviceModeContext);
  if (!context) throw new Error('useDeviceMode must be used inside DeviceModeProvider');
  return context;
}
