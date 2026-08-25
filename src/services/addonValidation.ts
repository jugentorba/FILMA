import { fetchManifest, type StremioManifest } from './stremio';

export type PlaybackManifestValidation =
  | { valid: true; name: string }
  | { valid: false; reason: 'invalid-manifest' | 'no-stream-resource' | 'unsupported-media-type' };

function streamResources(manifest: StremioManifest) {
  return (manifest.resources ?? []).filter(resource =>
    typeof resource === 'string' ? resource === 'stream' : resource.name === 'stream',
  );
}

export function validatePlaybackManifest(manifest: StremioManifest): PlaybackManifestValidation {
  if (!manifest?.id?.trim() || !manifest?.name?.trim() || !manifest?.version?.trim()) {
    return { valid: false, reason: 'invalid-manifest' };
  }

  const streams = streamResources(manifest);
  if (!streams.length) {
    return { valid: false, reason: 'no-stream-resource' };
  }

  const streamTypes = streams.flatMap(resource =>
    typeof resource === 'string' ? [] : (resource.types ?? []),
  );
  const declaredTypes = new Set(streamTypes.length ? streamTypes : (manifest.types ?? []));
  if (declaredTypes.size > 0 && !declaredTypes.has('movie') && !declaredTypes.has('series')) {
    return { valid: false, reason: 'unsupported-media-type' };
  }

  return { valid: true, name: manifest.name.trim() };
}

export async function validatePlaybackAddon(manifestUrl: string): Promise<PlaybackManifestValidation> {
  return validatePlaybackManifest(await fetchManifest(manifestUrl));
}
