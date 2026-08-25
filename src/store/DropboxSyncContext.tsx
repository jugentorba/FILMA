import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import {
  beginDropboxTvPairing,
  completeDropboxTvPairing,
  connectDropbox,
  disconnectDropbox,
  getDropboxAccessToken,
  hasDropboxSession,
  isDropboxConfigured,
  type DropboxTvPairing,
} from '../services/dropboxAuth';
import { DropboxSyncAdapter } from '../services/dropboxSync';
import { useFilma } from './FilmaContext';

type SyncStatus = 'checking' | 'disconnected' | 'pairing' | 'connected' | 'syncing' | 'error';

type DropboxSyncContextValue = {
  configured: boolean;
  connected: boolean;
  status: SyncStatus;
  error?: string;
  lastSyncAt?: string;
  needsTvPairing: boolean;
  tvPairingUrl?: string;
  connect(): Promise<void>;
  beginTvPairing(): Promise<void>;
  finishTvPairing(code: string): Promise<void>;
  cancelTvPairing(): void;
  disconnect(): Promise<void>;
  syncNow(): Promise<void>;
};

const DropboxSyncContext = createContext<DropboxSyncContextValue | null>(null);
const AUTO_SYNC_MIN_INTERVAL_MS = 30_000;
const REMOTE_PULL_INTERVAL_MS = 60_000;

export function DropboxSyncProvider({ children }: { children: React.ReactNode }) {
  const { ready, state, syncWith } = useFilma();
  const configured = isDropboxConfigured();
  const needsTvPairing = Platform.isTV;
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<SyncStatus>('checking');
  const [error, setError] = useState<string>();
  const [lastSyncAt, setLastSyncAt] = useState<string>();
  const [tvPairing, setTvPairing] = useState<DropboxTvPairing>();
  const inFlight = useRef<Promise<void> | null>(null);
  const lastSyncMs = useRef(0);
  const lastSyncedSignature = useRef('');
  const stateSignature = useMemo(() => JSON.stringify(state), [state]);

  const adapter = useMemo(() => new DropboxSyncAdapter({
    getAccessToken: getDropboxAccessToken,
  }), []);

  useEffect(() => {
    let cancelled = false;
    void hasDropboxSession().then(hasSession => {
      if (cancelled) return;
      setConnected(hasSession);
      setStatus(hasSession ? 'connected' : 'disconnected');
    }).catch(reason => {
      if (cancelled) return;
      setStatus('error');
      setError(reason instanceof Error ? reason.message : 'Could not read Dropbox session.');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const syncNow = useCallback(async () => {
    if (!ready || !connected) return;
    if (inFlight.current) return inFlight.current;

    const signatureAtStart = stateSignature;
    const task = (async () => {
      setStatus('syncing');
      setError(undefined);
      try {
        await syncWith(adapter);
        const now = Date.now();
        lastSyncMs.current = now;
        lastSyncedSignature.current = signatureAtStart;
        setLastSyncAt(new Date(now).toISOString());
        setStatus('connected');
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : 'Dropbox sync failed.';
        setError(message);
        setStatus('error');
        if (/not connected|session expired/i.test(message)) {
          setConnected(false);
        }
        throw reason;
      }
    })();

    inFlight.current = task;
    try {
      await task;
    } finally {
      inFlight.current = null;
    }
  }, [adapter, connected, ready, stateSignature, syncWith]);

  const connect = useCallback(async () => {
    if (!configured) {
      setError('This build is missing EXPO_PUBLIC_DROPBOX_APP_KEY.');
      setStatus('error');
      return;
    }

    if (needsTvPairing) {
      try {
        const pairing = await beginDropboxTvPairing();
        setTvPairing(pairing);
        setError(undefined);
        setStatus('pairing');
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Could not start TV pairing.');
        setStatus('error');
      }
      return;
    }

    setError(undefined);
    try {
      await connectDropbox();
      const hasSession = await hasDropboxSession();
      setConnected(hasSession);
      setStatus(hasSession ? 'connected' : 'disconnected');
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Dropbox sign-in failed.';
      setError(message);
      setStatus('error');
    }
  }, [configured, needsTvPairing]);

  const beginTvPairing = useCallback(async () => {
    if (!configured) {
      setError('This build is missing EXPO_PUBLIC_DROPBOX_APP_KEY.');
      setStatus('error');
      return;
    }
    try {
      setTvPairing(await beginDropboxTvPairing());
      setError(undefined);
      setStatus('pairing');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not start TV pairing.');
      setStatus('error');
    }
  }, [configured]);

  const finishTvPairing = useCallback(async (code: string) => {
    if (!tvPairing) {
      setError('Start Dropbox pairing first.');
      setStatus('error');
      return;
    }

    setError(undefined);
    try {
      await completeDropboxTvPairing(code, tvPairing);
      setTvPairing(undefined);
      setConnected(true);
      setStatus('connected');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Dropbox TV pairing failed.');
      setStatus('pairing');
    }
  }, [tvPairing]);

  const cancelTvPairing = useCallback(() => {
    setTvPairing(undefined);
    setError(undefined);
    setStatus(connected ? 'connected' : 'disconnected');
  }, [connected]);

  useEffect(() => {
    if (connected && status === 'connected' && lastSyncMs.current === 0) {
      void syncNow();
    }
  }, [connected, status, syncNow]);

  const disconnect = useCallback(async () => {
    try {
      await disconnectDropbox();
    } finally {
      setConnected(false);
      setTvPairing(undefined);
      setStatus('disconnected');
      setError(undefined);
      lastSyncMs.current = 0;
      lastSyncedSignature.current = '';
      setLastSyncAt(undefined);
    }
  }, []);

  useEffect(() => {
    if (!ready || !connected || status === 'checking' || stateSignature === lastSyncedSignature.current) return;

    const elapsed = Date.now() - lastSyncMs.current;
    const delay = Math.max(1_500, AUTO_SYNC_MIN_INTERVAL_MS - elapsed);
    const timer = setTimeout(() => {
      void syncNow().catch(() => undefined);
    }, delay);
    return () => clearTimeout(timer);
  }, [connected, ready, stateSignature, status, syncNow]);

  useEffect(() => {
    if (!ready || !connected) return;
    const timer = setInterval(() => {
      void syncNow().catch(() => undefined);
    }, REMOTE_PULL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [connected, ready, syncNow]);

  useEffect(() => {
    if (!ready || !connected) return;
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active' && Date.now() - lastSyncMs.current > AUTO_SYNC_MIN_INTERVAL_MS) {
        void syncNow().catch(() => undefined);
      } else if (next === 'background' && stateSignature !== lastSyncedSignature.current) {
        void syncNow().catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [connected, ready, stateSignature, syncNow]);

  const value = useMemo<DropboxSyncContextValue>(() => ({
    configured,
    connected,
    status,
    error,
    lastSyncAt,
    needsTvPairing,
    tvPairingUrl: tvPairing?.authorizeUrl,
    connect,
    beginTvPairing,
    finishTvPairing,
    cancelTvPairing,
    disconnect,
    syncNow,
  }), [
    beginTvPairing,
    cancelTvPairing,
    configured,
    connect,
    connected,
    disconnect,
    error,
    finishTvPairing,
    lastSyncAt,
    needsTvPairing,
    status,
    syncNow,
    tvPairing?.authorizeUrl,
  ]);

  return <DropboxSyncContext.Provider value={value}>{children}</DropboxSyncContext.Provider>;
}

export function useDropboxSync(): DropboxSyncContextValue {
  const context = useContext(DropboxSyncContext);
  if (!context) throw new Error('useDropboxSync must be used inside DropboxSyncProvider');
  return context;
}
