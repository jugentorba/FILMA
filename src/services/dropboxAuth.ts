import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = 'filma.dropbox.oauth.v1';
const DROPBOX_CLIENT_ID = process.env.EXPO_PUBLIC_DROPBOX_APP_KEY?.trim() ?? '';

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

function assertConfigured(): string {
  if (!DROPBOX_CLIENT_ID) {
    throw new Error('Dropbox is not configured in this FILMA build. Set EXPO_PUBLIC_DROPBOX_APP_KEY before building.');
  }
  return DROPBOX_CLIENT_ID;
}

function redirectUri(): string {
  return AuthSession.makeRedirectUri({ scheme: 'filma', path: 'dropbox-auth' });
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
  const stored: StoredToken = {
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresIn: token.expiresIn,
    issuedAt: token.issuedAt,
    scope: token.scope,
  };
  await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(stored));
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

export async function connectDropbox(): Promise<void> {
  const clientId = assertConfigured();

  // tvOS does not provide the browser-based OAuth experience used on phones.
  // Keep the auth transport out of the TV UI until the pairing-code flow is attached.
  if (Platform.isTV && Platform.OS === 'ios') {
    throw new Error('Apple TV uses FILMA device pairing for Dropbox. Connect Dropbox from a phone first.');
  }

  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri: redirectUri(),
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    scopes: ['files.content.read', 'files.content.write'],
    extraParams: {
      token_access_type: 'offline',
    },
  });

  const result = await request.promptAsync(discovery);
  if (result.type !== 'success') {
    if (result.type === 'cancel' || result.type === 'dismiss') return;
    if (result.type === 'error') {
      throw new Error(result.error?.message ?? 'Dropbox sign-in failed.');
    }
    throw new Error(`Dropbox sign-in ended with ${result.type}.`);
  }

  const code = result.params.code;
  if (!code || !request.codeVerifier) {
    throw new Error('Dropbox did not return a valid authorization code.');
  }

  const token = await AuthSession.exchangeCodeAsync({
    clientId,
    code,
    redirectUri: redirectUri(),
    extraParams: { code_verifier: request.codeVerifier },
  }, discovery);

  await saveToken(token);
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
