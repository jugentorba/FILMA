import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = 'filma.dropbox.oauth.v1';
const DROPBOX_CLIENT_ID = process.env.EXPO_PUBLIC_DROPBOX_APP_KEY?.trim() || '4xn65kgja3fsiui';

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://www.dropbox.com/oauth2/authorize',
  tokenEndpoint: 'https://api.dropboxapi.com/oauth2/token',
};

type StoredToken = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  issuedAt: number;
  scope?: string;
};

export type DropboxPairing = {
  authorizeUrl: string;
  codeVerifier: string;
  createdAt: number;
};

function assertConfigured(): string {
  if (!DROPBOX_CLIENT_ID) throw new Error('Dropbox is not configured in this FILMA build.');
  return DROPBOX_CLIENT_ID;
}

function randomVerifier(): string {
  return Array.from(Crypto.getRandomBytes(48), byte => byte.toString(16).padStart(2, '0')).join('');
}

function base64Url(value: string): string {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function loadStoredToken(): Promise<StoredToken | null> {
  const raw = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredToken>;
    if (!parsed.accessToken || typeof parsed.issuedAt !== 'number') return null;
    return parsed as StoredToken;
  } catch {
    return null;
  }
}

async function saveToken(token: AuthSession.TokenResponse): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify({
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresIn: token.expiresIn,
    issuedAt: token.issuedAt,
    scope: token.scope,
  } satisfies StoredToken));
}

function asTokenResponse(token: StoredToken): AuthSession.TokenResponse {
  return new AuthSession.TokenResponse({
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresIn: token.expiresIn,
    issuedAt: token.issuedAt,
    scope: token.scope,
  });
}

export function isDropboxConfigured(): boolean {
  return Boolean(DROPBOX_CLIENT_ID);
}

export async function hasDropboxSession(): Promise<boolean> {
  return Boolean(await loadStoredToken());
}

// FILMA deliberately uses Dropbox's redirect-less authorization-code + PKCE
// flow. Dropbox displays a one-time code after approval, so mobile and TV can
// authenticate without a backend server and without a redirect URI whitelist.
export async function beginDropboxPairing(): Promise<DropboxPairing> {
  const clientId = assertConfigured();
  const codeVerifier = randomVerifier();
  const challenge = base64Url(await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    codeVerifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  ));

  const authorizeUrl = [
    'https://www.dropbox.com/oauth2/authorize',
    `?client_id=${encodeURIComponent(clientId)}`,
    '&response_type=code',
    `&code_challenge=${encodeURIComponent(challenge)}`,
    '&code_challenge_method=S256',
    '&token_access_type=offline',
    '&scope=files.content.read%20files.content.write',
  ].join('');

  return { authorizeUrl, codeVerifier, createdAt: Date.now() };
}

export async function openDropboxPairing(pairing: DropboxPairing): Promise<void> {
  await WebBrowser.openBrowserAsync(pairing.authorizeUrl, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
  });
}

export async function completeDropboxPairing(code: string, pairing: DropboxPairing): Promise<void> {
  const clientId = assertConfigured();
  const trimmedCode = code.trim();
  if (!trimmedCode) throw new Error('Enter the Dropbox authorization code.');
  if (Date.now() - pairing.createdAt > 10 * 60 * 1000) {
    throw new Error('This authorization request has expired. Start Dropbox connection again.');
  }

  const response = await fetch(discovery.tokenEndpoint!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: [
      `code=${encodeURIComponent(trimmedCode)}`,
      'grant_type=authorization_code',
      `client_id=${encodeURIComponent(clientId)}`,
      `code_verifier=${encodeURIComponent(pairing.codeVerifier)}`,
    ].join('&'),
  });

  const payload = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || `Dropbox authorization failed (HTTP ${response.status}).`);
  }

  await saveToken(new AuthSession.TokenResponse({
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in,
    scope: payload.scope,
    issuedAt: Math.floor(Date.now() / 1000),
  }));
}

export async function getDropboxAccessToken(): Promise<string> {
  const clientId = assertConfigured();
  const stored = await loadStoredToken();
  if (!stored) throw new Error('Dropbox is not connected.');

  const token = asTokenResponse(stored);
  if (token.shouldRefresh()) {
    if (!token.refreshToken) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      throw new Error('Dropbox session expired. Connect Dropbox again.');
    }
    await token.refreshAsync({ clientId }, discovery);
    await saveToken(token);
  }

  return token.accessToken;
}

export async function disconnectDropbox(): Promise<void> {
  const stored = await loadStoredToken();
  if (stored?.accessToken) {
    try {
      await fetch('https://api.dropboxapi.com/2/auth/token/revoke', {
        method: 'POST',
        headers: { Authorization: `Bearer ${stored.accessToken}` },
      });
    } catch {
      // Local sign-out must still work if the device is offline.
    }
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
