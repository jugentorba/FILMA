import type { AudioLanguage, MediaItem } from '../types';
import { CINEMETA_MANIFEST_URL } from './sourceDiscovery';
import {
  catalogCanLoadWithoutSearch,
  catalogLanguageExtra,
  fetchCatalog,
  fetchManifest,
  fetchMeta,
  FILMA_ARCHIVE_MANIFEST_URL,
  type StremioCatalog,
  type StremioDetailedMeta,
  type StremioManifest,
} from './stremio';

const MANIFEST_TTL_MS = 30 * 60 * 1000;
const CATALOG_TTL_MS = 5 * 60 * 1000;
const META_TTL_MS = 15 * 60 * 1000;

type CacheEntry<T> = { expiresAt: number; value: T };

type BrowseCatalogScore = {
  catalog: StremioCatalog;
  score: number;
  originalIndex: number;
};

const manifestCache = new Map<string, CacheEntry<StremioManifest>>();
const catalogCache = new Map<string, CacheEntry<MediaItem[]>>();
const metaCache = new Map<string, CacheEntry<StremioDetailedMeta>>();
const manifestInflight = new Map<string, Promise<StremioManifest>>();
const catalogInflight = new Map<string, Promise<MediaItem[]>>();
const metaInflight = new Map<string, Promise<StremioDetailedMeta>>();

function cachedValue<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function stableExtras(extras: Record<string, string | number | undefined>): string {
  return Object.entries(extras)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined && entry[1] !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('&');
}

function normalizedTitle(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function itemType(item: MediaItem): string {
  if (item.source?.kind === 'stremio') return item.source.mediaType;
  if (item.source?.kind === 'youtube') return 'movie';
  return 'media';
}

function imdbIdentity(item: MediaItem): string | undefined {
  if (item.source?.kind !== 'stremio') return undefined;
  const raw = item.source.videoId ?? item.source.mediaId;
  const match = raw.match(/^(tt\d+(?::\d+:\d+)?)/i);
  return match?.[1]?.toLocaleLowerCase();
}

export function canonicalSeriesMetaId(mediaId: string): string | undefined {
  const match = mediaId.match(/^(tt\d+)(?::\d+:\d+)?/i);
  return match?.[1]?.toLocaleLowerCase();
}

async function fetchMetaWithSeriesFallback(
  manifestUrl: string,
  type: string,
  mediaId: string,
): Promise<StremioDetailedMeta> {
  let primaryMeta: StremioDetailedMeta | undefined;
  let primaryError: unknown;

  try {
    primaryMeta = await fetchMeta(manifestUrl, type, mediaId);
    if (type !== 'series' || (primaryMeta.videos?.length ?? 0) > 0) return primaryMeta;
  } catch (error) {
    primaryError = error;
    if (type !== 'series') throw error;
  }

  const canonicalId = canonicalSeriesMetaId(mediaId);
  const alreadyCanonical = manifestUrl.trim().toLocaleLowerCase() === CINEMETA_MANIFEST_URL.toLocaleLowerCase();
  if (!canonicalId || alreadyCanonical) {
    if (primaryMeta) return primaryMeta;
    throw primaryError instanceof Error ? primaryError : new Error('Series metadata is unavailable.');
  }

  try {
    const fallbackMeta = await fetchMeta(CINEMETA_MANIFEST_URL, 'series', canonicalId);
    if ((fallbackMeta.videos?.length ?? 0) > 0) return fallbackMeta;
    if (primaryMeta) return primaryMeta;
    return fallbackMeta;
  } catch (fallbackError) {
    if (primaryMeta) return primaryMeta;
    if (primaryError instanceof Error) throw primaryError;
    throw fallbackError;
  }
}

export function canonicalMediaKey(item: MediaItem): string {
  const imdb = imdbIdentity(item);
  if (imdb) return `${itemType(item)}:imdb:${imdb}`;
  if (item.source?.kind === 'youtube') return `youtube:${item.source.videoId}`;

  const title = normalizedTitle(item.title);
  if (title && item.year) return `${itemType(item)}:title:${title}:${item.year}`;

  if (item.source?.kind === 'stremio') {
    const raw = item.source.videoId ?? item.source.mediaId;
    return `${itemType(item)}:source:${item.source.manifestUrl}:${raw}`;
  }
  return item.id;
}

function itemQuality(item: MediaItem): number {
  let score = 0;
  if (item.streamUrl) score += 1000;
  if (item.source?.kind === 'stremio' && item.source.manifestUrl === FILMA_ARCHIVE_MANIFEST_URL) score += 800;
  if (imdbIdentity(item)) score += 120;
  if (item.backdrop) score += 35;
  if (item.poster) score += 30;
  if (item.year) score += 15;
  score += Math.min(20, item.genres?.length ?? 0);
  return score;
}

export function dedupeMediaItems(items: MediaItem[]): MediaItem[] {
  const orderedKeys: string[] = [];
  const byKey = new Map<string, MediaItem>();

  for (const item of items) {
    const key = canonicalMediaKey(item);
    const existing = byKey.get(key);
    if (!existing) {
      orderedKeys.push(key);
      byKey.set(key, item);
      continue;
    }
    if (itemQuality(item) > itemQuality(existing)) byKey.set(key, item);
  }

  return orderedKeys.flatMap(key => {
    const item = byKey.get(key);
    return item ? [item] : [];
  });
}

function catalogPriority(catalog: StremioCatalog): number {
  const id = catalog.id.toLocaleLowerCase();
  const name = (catalog.name ?? '').toLocaleLowerCase();
  if (id === 'top' || name.includes('popular')) return 0;
  if (id === 'year' || name === 'new' || name.includes('new')) return 1;
  if (id === 'imdbrating' || name.includes('featured') || name.includes('rating')) return 2;
  return 10;
}

export function selectBrowseCatalogs(
  catalogs: StremioCatalog[],
  preferredAudioLanguages: AudioLanguage[],
  perType = 3,
): StremioCatalog[] {
  const loadable = catalogs.filter(catalog =>
    (catalog.type === 'movie' || catalog.type === 'series')
    && catalogCanLoadWithoutSearch(catalog, preferredAudioLanguages),
  );

  const selectType = (type: 'movie' | 'series') => loadable
    .map((catalog, originalIndex) => ({ catalog, score: catalogPriority(catalog), originalIndex } satisfies BrowseCatalogScore))
    .filter(entry => entry.catalog.type === type)
    .sort((a, b) => a.score - b.score || a.originalIndex - b.originalIndex)
    .slice(0, perType)
    .map(entry => entry.catalog);

  return [...selectType('movie'), ...selectType('series')];
}

export async function getManifestCached(manifestUrl: string, force = false): Promise<StremioManifest> {
  if (!force) {
    const cached = cachedValue(manifestCache, manifestUrl);
    if (cached) return cached;
    const inflight = manifestInflight.get(manifestUrl);
    if (inflight) return inflight;
  }

  const request = fetchManifest(manifestUrl).then(manifest => {
    manifestCache.set(manifestUrl, { expiresAt: Date.now() + MANIFEST_TTL_MS, value: manifest });
    return manifest;
  }).finally(() => {
    manifestInflight.delete(manifestUrl);
  });
  manifestInflight.set(manifestUrl, request);
  return request;
}

export async function getCatalogCached(
  manifestUrl: string,
  type: string,
  catalogId: string,
  extras: Record<string, string | number | undefined> = {},
  force = false,
): Promise<MediaItem[]> {
  const key = `${manifestUrl}|${type}|${catalogId}|${stableExtras(extras)}`;
  if (!force) {
    const cached = cachedValue(catalogCache, key);
    if (cached) return cached;
    const inflight = catalogInflight.get(key);
    if (inflight) return inflight;
  }

  const request = fetchCatalog(manifestUrl, type, catalogId, extras).then(items => {
    const deduped = dedupeMediaItems(items);
    catalogCache.set(key, { expiresAt: Date.now() + CATALOG_TTL_MS, value: deduped });
    return deduped;
  }).finally(() => {
    catalogInflight.delete(key);
  });
  catalogInflight.set(key, request);
  return request;
}

export async function getMetaCached(
  manifestUrl: string,
  type: string,
  mediaId: string,
  force = false,
): Promise<StremioDetailedMeta> {
  const key = `${manifestUrl}|${type}|${mediaId}`;
  if (!force) {
    const cached = cachedValue(metaCache, key);
    if (cached) return cached;
    const inflight = metaInflight.get(key);
    if (inflight) return inflight;
  }

  const request = fetchMetaWithSeriesFallback(manifestUrl, type, mediaId).then(meta => {
    metaCache.set(key, { expiresAt: Date.now() + META_TTL_MS, value: meta });
    return meta;
  }).finally(() => {
    metaInflight.delete(key);
  });
  metaInflight.set(key, request);
  return request;
}

export function catalogExtrasForPreferences(
  catalog: StremioCatalog,
  preferredAudioLanguages: AudioLanguage[],
): Record<string, string> {
  return catalogLanguageExtra(catalog, preferredAudioLanguages);
}

export function clearMediaDiscoveryCache(): void {
  manifestCache.clear();
  catalogCache.clear();
  metaCache.clear();
}
