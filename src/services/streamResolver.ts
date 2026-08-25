import type { AddonSource, AudioLanguage, MediaItem } from '../types';
import { discoverAutomaticStreamProviders, mergeMovieProviders } from './sourceDiscovery';
import { fetchManifest, fetchStreams, rankStreamsByPreferredAudio, type StremioManifest } from './stremio';

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

export type StreamResolution = { streams: ResolvedStream[]; diagnostics: StreamResolutionDiagnostics };
type ManifestCacheEntry = { manifest: StremioManifest; fetchedAt: number };
type ProviderCandidates = { direct: ResolvedStream[]; external: ResolvedStream[] };
type MediaIdentity = { type: string; id: string };

const MANIFEST_CACHE_TTL_MS = 5 * 60 * 1000;
const EXTERNAL_PROVIDER_PREFIX = 'external-provider:';
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
  return (manifest.resources ?? []).find(resource => typeof resource === 'string' ? resource === 'stream' : resource.name === 'stream');
}

function providerSupports(manifest: StremioManifest, mediaType: string, id: string): boolean {
  const resource = streamResource(manifest);
  if (!resource) return false;
  if (typeof resource === 'string') return true;
  if (resource.types?.length && !resource.types.includes(mediaType)) return false;
  if (resource.idPrefixes?.length && !resource.idPrefixes.some(prefix => id.startsWith(prefix))) return false;
  return true;
}

function canonicalIdentity(item: MediaItem): MediaIdentity | null {
  if (item.source?.kind !== 'stremio') return null;
  return { type: item.source.mediaType, id: item.source.videoId ?? item.source.mediaId };
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

function dedupeStreams(streams: ResolvedStream[]): ResolvedStream[] {
  const seen = new Set<string>();
  return streams.filter(stream => {
    const key = `${stream.url}|${stream.title}|${stream.providerManifestUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function emptyDiagnostics(configuredProviders: number): StreamResolutionDiagnostics {
  return {
    configuredProviders,
    automaticProviders: 0,
    enabledProviders: 0,
    manifestsLoaded: 0,
    streamCapableProviders: 0,
    compatibleProviders: 0,
    providerResponses: 0,
    totalReturnedEntries: 0,
    directPlayableEntries: 0,
    externalOnlyEntries: 0,
    failedProviders: 0,
  };
}

async function resolveProviderBatch(providers: AddonSource[], identity: MediaIdentity, diagnostics: StreamResolutionDiagnostics): Promise<ProviderCandidates[]> {
  return Promise.all(providers.map(async addon => {
    try {
      const manifest = await manifestFor(addon.manifestUrl);
      diagnostics.manifestsLoaded += 1;
      if (!streamResource(manifest)) return { direct: [], external: [] };
      diagnostics.streamCapableProviders += 1;
      if (!providerSupports(manifest, identity.type, identity.id)) return { direct: [], external: [] };
      diagnostics.compatibleProviders += 1;
      const streams = await fetchStreams(addon.manifestUrl, identity.type, identity.id);
      diagnostics.providerResponses += 1;
      diagnostics.totalReturnedEntries += streams.length;
      const direct: ResolvedStream[] = [];
      const external: ResolvedStream[] = [];
      for (const stream of streams) {
        if (stream.url && /^https?:\/\//i.test(stream.url)) {
          direct.push({ title: stream.title, url: stream.url, providerName: manifest.name || addon.name, providerManifestUrl: addon.manifestUrl });
        } else if (stream.externalUrl && /^https?:\/\//i.test(stream.externalUrl)) {
          diagnostics.externalOnlyEntries += 1;
          external.push({ title: stream.title, url: `${EXTERNAL_PROVIDER_PREFIX}${encodeURIComponent(stream.externalUrl)}`, providerName: manifest.name || addon.name, providerManifestUrl: addon.manifestUrl });
        }
      }
      return { direct, external };
    } catch {
      diagnostics.failedProviders += 1;
      return { direct: [], external: [] };
    }
  }));
}

function rankedDirect(candidates: ProviderCandidates[], preferred: AudioLanguage[]): ResolvedStream[] {
  return dedupeStreams(rankStreamsByPreferredAudio(candidates.flatMap(candidate => candidate.direct), preferred));
}

function rankedExternal(candidates: ProviderCandidates[], preferred: AudioLanguage[]): ResolvedStream[] {
  return dedupeStreams(rankStreamsByPreferredAudio(candidates.flatMap(candidate => candidate.external), preferred));
}

function providerUrl(provider: AddonSource): string {
  return provider.manifestUrl.trim().toLocaleLowerCase();
}

export async function resolveStreamsAcrossAddons(item: MediaItem, addons: AddonSource[], preferredAudioLanguages: AudioLanguage[]): Promise<StreamResolution> {
  recentStreamCandidates.delete(item.id);
  const configured = addons.filter(addon => addon.enabled && !addon.deletedAt);
  const diagnostics = emptyDiagnostics(configured.length);
  const identity = canonicalIdentity(item);
  if (!identity) return { streams: [], diagnostics };

  const source = itemProvider(item);
  const automaticPromise = discoverAutomaticStreamProviders().catch(() => [] as AddonSource[]);
  const allCandidates: ProviderCandidates[] = [];
  const attemptedUrls = new Set<string>();

  // Stage 1: the provider that supplied this item. This is the fastest path for
  // FILMA Free and for user add-ons that provide both catalog and streams.
  if (source) {
    diagnostics.enabledProviders += 1;
    attemptedUrls.add(providerUrl(source));
    const candidates = await resolveProviderBatch([source], identity, diagnostics);
    allCandidates.push(...candidates);
    const direct = rankedDirect(candidates, preferredAudioLanguages);
    if (direct.length) {
      diagnostics.directPlayableEntries = direct.length;
      recentStreamCandidates.set(item.id, direct);
      return { streams: direct, diagnostics };
    }
  }

  // Stage 2: enabled providers already present in the user's app state.
  const configuredFallbacks = mergeMovieProviders([], configured).filter(provider => !attemptedUrls.has(providerUrl(provider)));
  configuredFallbacks.forEach(provider => attemptedUrls.add(providerUrl(provider)));
  diagnostics.enabledProviders += configuredFallbacks.length;
  if (configuredFallbacks.length) {
    const candidates = await resolveProviderBatch(configuredFallbacks, identity, diagnostics);
    allCandidates.push(...candidates);
    const direct = rankedDirect(candidates, preferredAudioLanguages);
    if (direct.length) {
      diagnostics.directPlayableEntries = direct.length;
      recentStreamCandidates.set(item.id, direct);
      return { streams: direct, diagnostics };
    }
  }

  // Stage 3: network-discovered automatic fallbacks only when the local paths
  // did not produce a direct playable URL.
  const automatic = await automaticPromise;
  diagnostics.automaticProviders = automatic.length;
  const automaticFallbacks = mergeMovieProviders([], automatic).filter(provider => !attemptedUrls.has(providerUrl(provider)));
  diagnostics.enabledProviders += automaticFallbacks.length;
  if (automaticFallbacks.length) {
    const candidates = await resolveProviderBatch(automaticFallbacks, identity, diagnostics);
    allCandidates.push(...candidates);
  }

  const direct = rankedDirect(allCandidates, preferredAudioLanguages);
  diagnostics.directPlayableEntries = direct.length;
  const resolved = direct.length ? direct : rankedExternal(allCandidates, preferredAudioLanguages);
  recentStreamCandidates.set(item.id, resolved);
  return { streams: resolved, diagnostics };
}
