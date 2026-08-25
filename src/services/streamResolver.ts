import type { AddonSource, MediaItem } from '../types';
import {
  fetchManifest,
  fetchStreams,
  rankStreamsByPreferredAudio,
  type StremioManifest,
} from './stremio';

type StreamResult = {
  title: string;
  url?: string;
  externalUrl?: string;
  providerName: string;
  providerManifestUrl: string;
};

type ManifestCacheEntry = {
  manifest: StremioManifest;
  fetchedAt: number;
};

const MANIFEST_CACHE_TTL_MS = 5 * 60 * 1000;
const manifestCache = new Map<string, ManifestCacheEntry>();

async function manifestFor(url: string): Promise<StremioManifest> {
  const cached = manifestCache.get(url);
  if (cached && Date.now() - cached.fetchedAt < MANIFEST_CACHE_TTL_MS) return cached.manifest;
  const manifest = await fetchManifest(url);
  manifestCache.set(url, { manifest, fetchedAt: Date.now() });
  return manifest;
}

function streamResource(manifest: StremioManifest) {
  return (manifest.resources ?? []).find(resource =>
    typeof resource === 'string' ? resource === 'stream' : resource.name === 'stream',
  );
}

function providerSupports(manifest: StremioManifest, mediaType: string, id: string): boolean {
  const resource = streamResource(manifest);
  if (!resource) return false;
  if (typeof resource === 'string') return true;
  if (resource.types?.length && !resource.types.includes(mediaType)) return false;
  if (resource.idPrefixes?.length && !resource.idPrefixes.some(prefix => id.startsWith(prefix))) return false;
  return true;
}

function canonicalIdentity(item: MediaItem): { type: string; id: string } | null {
  if (item.source?.kind !== 'stremio') return null;
  return {
    type: item.source.mediaType,
    id: item.source.videoId ?? item.source.mediaId,
  };
}

export async function resolveStreamsAcrossAddons(
  item: MediaItem,
  addons: AddonSource[],
  preferredAudioLanguages: string[],
): Promise<StreamResult[]> {
  const identity = canonicalIdentity(item);
  if (!identity) return [];

  const activeAddons = addons.filter(addon => addon.enabled && !addon.deletedAt);
  const candidates = await Promise.all(activeAddons.map(async addon => {
    try {
      const manifest = await manifestFor(addon.manifestUrl);
      if (!providerSupports(manifest, identity.type, identity.id)) return [];
      const streams = await fetchStreams(addon.manifestUrl, identity.type, identity.id);
      return streams.map(stream => ({
        ...stream,
        providerName: manifest.name || addon.name,
        providerManifestUrl: addon.manifestUrl,
      }));
    } catch {
      return [];
    }
  }));

  const merged = candidates.flat();
  const direct = merged.filter(stream => Boolean(stream.url && /^https?:\/\//i.test(stream.url)));
  const ranked = rankStreamsByPreferredAudio(direct, preferredAudioLanguages as never);

  const seen = new Set<string>();
  return ranked.filter(stream => {
    const key = `${stream.url ?? ''}|${stream.title}|${stream.providerManifestUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
