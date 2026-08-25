import { fetchManifest, type StremioManifest } from './stremio';

export type PlaybackManifestValidation =
  | { valid: true; name: string }
  | { valid: false; reason: 'invalid-manifest' | 'no-stream-resource' | 'unsupported-media-type' };

function resourceNames(manifest: StremioManifest): Set<string> {
  return new Set((manifest.resources ?? []).map(resource =>
    typeof resource === 'string' ? resource : resource.name,
  ));
}

export function validatePlaybackManifest(manifest: StremioManifest): PlaybackManifestValidation {
  if (!manifest?.id?.trim() || !manifest?.name?.trim() || !manifest?.version?.trim()) {
    return { valid: false, reason: 'invalid-manifest' };
  }

  if (!resourceNames(manifest).has('stream')) {
    return { valid: false, reason: 'no-stream-resource' };
  }

  const types = new Set(manifest.types ?? []);
  if (types.size > 0 && !types.has('movie') && !types.has('series')) {
    return { valid: false, reason: 'unsupported-media-type' };
  }

  return { valid: true, name: manifest.name.trim() };
}

export async function validatePlaybackAddon(manifestUrl: string): Promise<PlaybackManifestValidation> {
  return validatePlaybackManifest(await fetchManifest(manifestUrl));
}
