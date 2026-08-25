import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import {
  beginDropboxPairing,
  completeDropboxPairing,
  disconnectDropbox,
  getDropboxAccessToken,
  hasDropboxSession,
  isDropboxConfigured,
  openDropboxPairing,
  type DropboxPairing,
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
  isTv: boolean;
  pairingUrl?: string;
  connect(): Promise<void>;
  restartPairing(): Promise<void>;
  openPairing(): Promise<void>;
  finishPairing(code: string): Promise<void>;
  cancelPairing(): void;
  disconnect(): Promise<void>;
  syncNow(): Promise<void>;
};

const DropboxSyncContext = createContext<DropboxSyncContextValue | null>(null);
const AUTO_SYNC_MIN_INTERVAL_MS = 30_000;
const REMOTE_PULL_INTERVAL_MS = 60_000;

export function DropboxSyncProvider({ children }: { children: React.ReactNode }) {
  const { ready, state, syncWith } = useFilma();
  const configured = isDropboxConfigured();
  const isTv = Platform.isTV;
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<SyncStatus>('checking');
  const [error, setError] = useState<string>();
  const [lastSyncAt, setLastSyncAt] = useState<string>();
  const [pairing, setPairing] = useState<DropboxPairing>();
  const inFlight = useRef<Promise<void> | null>(null);
  const lastSyncMs = useRef(0);
  const lastSyncedSignature = useRef('');
  const stateSignature = useMemo(() => JSON.stringify(state), [state]);

  const adapter = useMemo(() => new DropboxSyncAdapter({ getAccessToken: getDropboxAccessToken }), []);

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
    return () => { cancelled = true; };
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
        if (/not connected|session expired/i.test(message)) setConnected(false);
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

  const startPairing = useCallback(async (openOnThisDevice: boolean) => {
    if (!configured) {
      setError('This build is missing the Dropbox App Key.');
      setStatus('error');
      return;
    }

    try {
      const next = await beginDropboxPairing();
      setPairing(next);
      setError(undefined);
      setStatus('pairing');
      if (openOnThisDevice) await openDropboxPairing(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not start Dropbox authorization.');
      setStatus('error');
    }
  }, [configured]);

  const connect = useCallback(async () => {
    await startPairing(!isTv);
  }, [isTv, startPairing]);

  const restartPairing = useCallback(async () => {
    await startPairing(!isTv);
  }, [isTv, startPairing]);

  const openPairing = useCallback(async () => {
    if (!pairing) {
      await startPairing(!isTv);
      return;
    }
    try {
      await openDropboxPairing(pairing);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not open Dropbox authorization.');
    }
  }, [isTv, pairing, startPairing]);

  const finishPairing = useCallback(async (code: string) => {
    if (!pairing) {
      setError('Start Dropbox authorization first.');
      setStatus('error');
      return;
    }

    setError(undefined);
    try {
      await completeDropboxPairing(code, pairing);
      setPairing(undefined);
      setConnected(true);
      setStatus('connected');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Dropbox authorization failed.');
      setStatus('pairing');
    }
  }, [pairing]);

  const cancelPairing = useCallback(() => {
    setPairing(undefined);
    setError(undefined);
    setStatus(connected ? 'connected' : 'disconnected');
  }, [connected]);

  useEffect(() => {
    if (connected && status === 'connected' && lastSyncMs.current === 0) void syncNow();
  }, [connected, status, syncNow]);

  const disconnect = useCallback(async () => {
    try {
      await disconnectDropbox();
    } finally {
      setConnected(false);
      setPairing(undefined);
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
    const timer = setTimeout(() => { void syncNow().catch(() => undefined); }, delay);
    return () => clearTimeout(timer);
  }, [connected, ready, stateSignature, status, syncNow]);

  useEffect(() => {
    if (!ready || !connected) return;
    const timer = setInterval(() => { void syncNow().catch(() => undefined); }, REMOTE_PULL_INTERVAL_MS);
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
    isTv,
    pairingUrl: pairing?.authorizeUrl,
    connect,
    restartPairing,
    openPairing,
    finishPairing,
    cancelPairing,
    disconnect,
    syncNow,
  }), [
    cancelPairing,
    configured,
    connect,
    connected,
    disconnect,
    error,
    finishPairing,
    isTv,
    lastSyncAt,
    openPairing,
    pairing?.authorizeUrl,
    restartPairing,
    status,
    syncNow,
  ]);

  return <DropboxSyncContext.Provider value={value}>{children}</DropboxSyncContext.Provider>;
}

export function useDropboxSync(): DropboxSyncContextValue {
  const context = useContext(DropboxSyncContext);
  if (!context) throw new Error('useDropboxSync must be used inside DropboxSyncProvider');
  return context;
}
