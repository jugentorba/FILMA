import type { AddonSource, AudioLanguage, MediaItem } from '../types';
import { discoverAutomaticStreamProviders, mergeMovieProviders } from './sourceDiscovery';
import {
  fetchManifest,
  fetchStreams,
  rankStreamsByPreferredAudio,
  type StremioManifest,
} from './stremio';

export type ResolvedStream = {
  title: string;
  url: string;
  providerName: string;
  providerManifestUrl: string;
};

export type StreamResolutionDiagnostics = {
  configuredProviders: number;
  automaticProviders: number;
  enabledProviders: number;
  manifestsLoaded: number;
  streamCapableProviders: number;
  compatibleProviders: number;
  providerResponses: number;
  totalReturnedEntries: number;
  directPlayableEntries: number;
  externalOnlyEntries: number;
  failedProviders: number;
};

export type StreamResolution = {
  streams: ResolvedStream[];
  diagnostics: StreamResolutionDiagnostics;
};

type ManifestCacheEntry = {
  manifest: StremioManifest;
  fetchedAt: number;
};

const MANIFEST_CACHE_TTL_MS = 5 * 60 * 1000;
const manifestCache = new Map<string, ManifestCacheEntry>();
const recentStreamCandidates = new Map<string, ResolvedStream[]>();

export function resolvedStreamsForItem(mediaId: string): ResolvedStream[] {
  return recentStreamCandidates.get(mediaId) ?? [];
}

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

function providerIsStreamCapable(manifest: StremioManifest): boolean {
  return Boolean(streamResource(manifest));
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

function itemProvider(item: MediaItem): AddonSource | null {
  if (item.source?.kind !== 'stremio') return null;
  return {
    id: `item-source:${item.source.manifestUrl}`,
    name: 'Item source',
    manifestUrl: item.source.manifestUrl,
    enabled: true,
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
  };
}

export async function resolveStreamsAcrossAddons(
  item: MediaItem,
  addons: AddonSource[],
  preferredAudioLanguages: AudioLanguage[],
): Promise<StreamResolution> {
  recentStreamCandidates.delete(item.id);

  const configured = addons.filter(addon => addon.enabled && !addon.deletedAt);
  const automatic = await discoverAutomaticStreamProviders().catch(() => [] as AddonSource[]);
  const sourceProvider = itemProvider(item);
  const activeAddons = mergeMovieProviders(
    configured,
    [...automatic, ...(sourceProvider ? [sourceProvider] : [])],
  );

  const diagnostics: StreamResolutionDiagnostics = {
    configuredProviders: configured.length,
    automaticProviders: automatic.length,
    enabledProviders: activeAddons.length,
    manifestsLoaded: 0,
    streamCapableProviders: 0,
    compatibleProviders: 0,
    providerResponses: 0,
    totalReturnedEntries: 0,
    directPlayableEntries: 0,
    externalOnlyEntries: 0,
    failedProviders: 0,
  };

  const identity = canonicalIdentity(item);
  if (!identity) return { streams: [], diagnostics };

  const candidates = await Promise.all(activeAddons.map(async addon => {
    try {
      const manifest = await manifestFor(addon.manifestUrl);
      diagnostics.manifestsLoaded += 1;
      if (!providerIsStreamCapable(manifest)) return [];
      diagnostics.streamCapableProviders += 1;
      if (!providerSupports(manifest, identity.type, identity.id)) return [];
      diagnostics.compatibleProviders += 1;

      const streams = await fetchStreams(addon.manifestUrl, identity.type, identity.id);
      diagnostics.providerResponses += 1;
      diagnostics.totalReturnedEntries += streams.length;
      diagnostics.externalOnlyEntries += streams.filter(stream => !stream.url && Boolean(stream.externalUrl)).length;

      return streams.flatMap(stream => {
        if (!stream.url || !/^https?:\/\//i.test(stream.url)) return [];
        return [{
          title: stream.title,
          url: stream.url,
          providerName: manifest.name || addon.name,
          providerManifestUrl: addon.manifestUrl,
        } satisfies ResolvedStream];
      });
    } catch {
      diagnostics.failedProviders += 1;
      return [];
    }
  }));

  const merged = candidates.flat();
  diagnostics.directPlayableEntries = merged.length;
  const ranked = rankStreamsByPreferredAudio(merged, preferredAudioLanguages);

  const seen = new Set<string>();
  const streams = ranked.filter(stream => {
    const key = `${stream.url}|${stream.title}|${stream.providerManifestUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  recentStreamCandidates.set(item.id, streams);
  return { streams, diagnostics };
}
