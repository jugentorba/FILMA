import { fetchManifest, type StremioManifest } from './stremio';

export type PlaybackManifestValidation =
  | { valid: true; name: string }
  | { valid: false; reason: 'invalid-manifest' | 'no-stream-resource' | 'no-media-resource' | 'unsupported-media-type' };

function mediaResources(manifest: StremioManifest) {
  return (manifest.resources ?? []).filter(resource => {
    const name = typeof resource === 'string' ? resource : resource.name;
    return name === 'catalog' || name === 'meta' || name === 'stream';
  });
}

export function validatePlaybackManifest(manifest: StremioManifest): PlaybackManifestValidation {
  if (!manifest?.id?.trim() || !manifest?.name?.trim() || !manifest?.version?.trim()) {
    return { valid: false, reason: 'invalid-manifest' };
  }

  const resources = mediaResources(manifest);
  if (!resources.length) {
    return { valid: false, reason: 'no-media-resource' };
  }

  const resourceTypes = resources.flatMap(resource =>
    typeof resource === 'string' ? [] : (resource.types ?? []),
  );
  const declaredTypes = new Set(resourceTypes.length ? resourceTypes : (manifest.types ?? []));
  if (declaredTypes.size > 0 && !declaredTypes.has('movie') && !declaredTypes.has('series')) {
    return { valid: false, reason: 'unsupported-media-type' };
  }

  return { valid: true, name: manifest.name.trim() };
}

export async function validatePlaybackAddon(manifestUrl: string): Promise<PlaybackManifestValidation> {
  return validatePlaybackManifest(await fetchManifest(manifestUrl));
}
