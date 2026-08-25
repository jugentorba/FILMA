import type { SyncEnvelope } from '../types';
import type { CloudSyncAdapter } from './sync';
import { normalizeSyncEnvelope } from './stateSchema';

const DROPBOX_CONTENT_API = 'https://content.dropboxapi.com/2/files';

export type DropboxAccessTokenProvider = () => Promise<string>;

export type DropboxSyncOptions = {
  getAccessToken: DropboxAccessTokenProvider;
  path?: string;
};

async function readDropboxError(response: Response): Promise<string> {
  try {
    const body = await response.text();
    return body.slice(0, 500) || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

/**
 * Stores FILMA's small sync envelope as one JSON file in Dropbox.
 *
 * Recommended Dropbox app configuration:
 * - App Folder access, so FILMA only sees its own Dropbox folder.
 * - Scopes: files.content.read + files.content.write.
 * - OAuth authorization-code flow with PKCE on client devices.
 *
 * The adapter never stores or embeds a Dropbox app secret. Authentication is
 * deliberately injected through getAccessToken so phones and TVs can share the
 * same sync transport while using the appropriate sign-in/pairing UI.
 */
export class DropboxSyncAdapter implements CloudSyncAdapter {
  private readonly getAccessToken: DropboxAccessTokenProvider;
  private readonly path: string;

  constructor(options: DropboxSyncOptions) {
    this.getAccessToken = options.getAccessToken;
    this.path = options.path ?? '/filma-sync.json';
  }

  async pull(): Promise<SyncEnvelope | null> {
    const token = await this.getAccessToken();
    const response = await fetch(`${DROPBOX_CONTENT_API}/download`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({ path: this.path }),
      },
    });

    if (response.status === 409) {
      const error = await readDropboxError(response);
      if (error.includes('not_found')) return null;
      throw new Error(`Dropbox download failed: ${error}`);
    }

    if (!response.ok) {
      throw new Error(`Dropbox download failed: ${await readDropboxError(response)}`);
    }

    const raw = await response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Dropbox sync file contains invalid JSON.');
    }

    const envelope = normalizeSyncEnvelope(parsed);
    if (!envelope) {
      throw new Error('Dropbox sync file has an unsupported FILMA format.');
    }

    return envelope;
  }

  async push(envelope: SyncEnvelope): Promise<void> {
    const token = await this.getAccessToken();
    const response = await fetch(`${DROPBOX_CONTENT_API}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: this.path,
          mode: 'overwrite',
          autorename: false,
          mute: true,
        }),
      },
      body: JSON.stringify(envelope),
    });

    if (!response.ok) {
      throw new Error(`Dropbox upload failed: ${await readDropboxError(response)}`);
    }
  }
}
