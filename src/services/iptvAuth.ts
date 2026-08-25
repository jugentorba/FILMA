import * as SecureStore from 'expo-secure-store';
import type { PlaylistSource } from '../types';

const XTREAM_KEY_PREFIX = 'filma.iptv.xtream.v1.';
const XTREAM_TIMEOUT_MS = 12_000;

type XtreamCredentials = {
  username: string;
  password: string;
};

type XtreamPlayerApiResponse = {
  user_info?: {
    auth?: number | string;
    status?: string;
    username?: string;
  };
  server_info?: {
    url?: string;
    port?: string;
    https_port?: string;
    server_protocol?: string;
  };
};

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(trimmed)) throw new Error('Xtream server must start with http:// or https://.');
  return trimmed;
}

function credentialKey(sourceId: string): string {
  return `${XTREAM_KEY_PREFIX}${sourceId}`;
}

function queryUrl(baseUrl: string, path: string, credentials: XtreamCredentials, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({
    username: credentials.username,
    password: credentials.password,
    ...extra,
  });
  return `${normalizeBaseUrl(baseUrl)}/${path}?${params.toString()}`;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), XTREAM_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json,text/plain,*/*' } });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Xtream server timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function validateXtreamAccount(
  baseUrl: string,
  username: string,
  password: string,
): Promise<{ baseUrl: string; username: string }> {
  const cleanBase = normalizeBaseUrl(baseUrl);
  const cleanUsername = username.trim();
  const cleanPassword = password.trim();
  if (!cleanUsername || !cleanPassword) throw new Error('Xtream username and password are required.');

  const credentials = { username: cleanUsername, password: cleanPassword };
  const response = await fetchWithTimeout(queryUrl(cleanBase, 'player_api.php', credentials));
  if (!response.ok) throw new Error(`Xtream server HTTP ${response.status}.`);

  let payload: XtreamPlayerApiResponse;
  try {
    payload = await response.json() as XtreamPlayerApiResponse;
  } catch {
    throw new Error('Xtream server returned an invalid response.');
  }

  const authenticated = payload.user_info?.auth === 1 || payload.user_info?.auth === '1';
  const status = payload.user_info?.status?.toLocaleLowerCase();
  if (!authenticated || status === 'banned' || status === 'disabled' || status === 'expired') {
    throw new Error('Xtream account was not accepted by the server.');
  }

  return { baseUrl: cleanBase, username: cleanUsername };
}

export async function saveXtreamCredentials(sourceId: string, username: string, password: string): Promise<string> {
  const key = credentialKey(sourceId);
  await SecureStore.setItemAsync(key, JSON.stringify({ username: username.trim(), password: password.trim() } satisfies XtreamCredentials));
  return key;
}

export async function deleteXtreamCredentials(source: PlaylistSource): Promise<void> {
  if (source.kind !== 'xtream') return;
  const key = source.credentialsKey || credentialKey(source.id);
  await SecureStore.deleteItemAsync(key);
}

export async function playlistFetchUrl(source: PlaylistSource): Promise<string> {
  if (source.kind !== 'xtream') return source.url;

  const key = source.credentialsKey || credentialKey(source.id);
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) throw new Error('Xtream credentials are not available on this device. Reconnect this source in Settings.');

  let credentials: XtreamCredentials;
  try {
    const parsed = JSON.parse(raw) as Partial<XtreamCredentials>;
    if (!parsed.username || !parsed.password) throw new Error('missing');
    credentials = { username: parsed.username, password: parsed.password };
  } catch {
    throw new Error('Xtream credentials stored on this device are invalid. Reconnect this source in Settings.');
  }

  return queryUrl(source.url, 'get.php', credentials, {
    type: 'm3u_plus',
    output: 'ts',
  });
}
