import type { AudioLanguage, MediaItem } from '../types';

export type StremioCatalogExtra = {
  name: string;
  isRequired?: boolean;
  options?: string[];
  optionsLimit?: number;
};

export type StremioCatalog = {
  type: string;
  id: string;
  name?: string;
  extra?: StremioCatalogExtra[];
};

export type StremioManifest = {
  id: string;
  name: string;
  version: string;
  resources?: Array<string | { name: string; types?: string[]; idPrefixes?: string[] }>;
  types?: string[];
  catalogs?: StremioCatalog[];
};

type StremioMeta = {
  id: string;
  type?: string;
  name: string;
  poster?: string;
  background?: string;
  releaseInfo?: string;
  genres?: string[];
  description?: string;
};

export type StremioVideo = {
  id: string;
  title: string;
  released?: string;
  thumbnail?: string;
  season?: number;
  episode?: number;
  overview?: string;
};

export type StremioDetailedMeta = StremioMeta & {
  videos?: StremioVideo[];
};

export type StremioStream = {
  title: string;
  url?: string;
  externalUrl?: string;
};

type ArchiveSearchDoc = {
  identifier?: unknown;
  title?: unknown;
  year?: unknown;
  subject?: unknown;
  language?: unknown;
  description?: unknown;
};

type ArchiveFile = {
  name?: unknown;
  format?: unknown;
  source?: unknown;
  size?: unknown;
  private?: unknown;
};

type ArchiveMetadataPayload = {
  metadata?: Record<string, unknown>;
  files?: ArchiveFile[];
};

const LANGUAGE_ALIASES: Record<AudioLanguage, string[]> = {
  en: ['en', 'eng', 'english', 'anglais', 'anglisht'],
  fr: ['fr', 'fra', 'fre', 'french', 'français', 'francais', 'frengjisht'],
  sq: ['sq', 'sqi', 'alb', 'albanian', 'albanais', 'shqip'],
  it: ['it', 'ita', 'italian', 'italiano', 'italien', 'italisht'],
  es: ['es', 'spa', 'spanish', 'español', 'espanol', 'espagnol', 'spanjisht'],
  de: ['de', 'deu', 'ger', 'german', 'deutsch', 'allemand', 'gjermanisht'],
  tr: ['tr', 'tur', 'turkish', 'türkçe', 'turkce', 'turc', 'turqisht'],
};

const BASE_AUDIO_LANGUAGES: AudioLanguage[] = ['fr', 'sq', 'en'];
const STREMIO_TIMEOUT_MS = 12_000;
const ARCHIVE_TIMEOUT_MS = 15_000;
const ARCHIVE_ID_PREFIX = 'ia:';
const ARCHIVE_CATALOG_ID = 'feature_films';
const ARCHIVE_SEARCH_ENDPOINT = 'https://archive.org/advancedsearch.php';
const ARCHIVE_METADATA_ENDPOINT = 'https://archive.org/metadata';
const ARCHIVE_DOWNLOAD_ENDPOINT = 'https://archive.org/download';

export const FILMA_ARCHIVE_MANIFEST_URL = 'filma://internet-archive/manifest.json';

const FILMA_ARCHIVE_MANIFEST: StremioManifest = {
  id: 'com.filma.archive',
  name: 'FILMA Free',
  version: '1.0.0',
  resources: [
    { name: 'catalog', types: ['movie'] },
    { name: 'meta', types: ['movie'], idPrefixes: [ARCHIVE_ID_PREFIX] },
    { name: 'stream', types: ['movie'], idPrefixes: [ARCHIVE_ID_PREFIX] },
  ],
  types: ['movie'],
  catalogs: [{
    type: 'movie',
    id: ARCHIVE_CATALOG_ID,
    name: 'Free classics',
    extra: [
      { name: 'search' },
      { name: 'language', options: ['English', 'French', 'Albanian', 'Italian', 'Spanish', 'German', 'Turkish'] },
    ],
  }],
};

async function fetchWithTimeout(url: string, timeoutMs = STREMIO_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function addonBase(manifestUrl: string): string {
  return manifestUrl.replace(/\/manifest\.json(?:\?.*)?$/i, '').replace(/\/$/, '');
}

function releaseYear(releaseInfo?: string): number | undefined {
  const match = releaseInfo?.match(/\b(19|20)\d{2}\b/);
  if (!match) return undefined;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mediaFromMeta(manifestUrl: string, type: string, meta: StremioMeta): MediaItem {
  return {
    id: localMediaId(manifestUrl, type, meta.id),
    title: meta.name,
    poster: meta.poster,
    backdrop: meta.background,
    subtitle: meta.releaseInfo,
    genres: meta.genres,
    year: releaseYear(meta.releaseInfo),
    source: {
      kind: 'stremio',
      manifestUrl,
      mediaType: type,
      mediaId: meta.id,
    },
  };
}

function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}

function aliasAppears(text: string, alias: string): boolean {
  const normalizedAlias = normalizeText(alias);
  if (normalizedAlias.length <= 3) {
    return new RegExp(`(^|[^a-z])${normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i').test(text);
  }
  return text.includes(normalizedAlias);
}

function optionForLanguage(options: string[] | undefined, language: AudioLanguage): string | undefined {
  if (!options?.length) return language;
  const aliases = LANGUAGE_ALIASES[language].map(normalizeText);
  return options.find(option => {
    const normalized = normalizeText(option);
    return aliases.includes(normalized) || aliases.some(alias => normalized.includes(alias));
  });
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) {
    for (const entry of value) {
      const resolved = stringValue(entry);
      if (resolved) return resolved;
    }
  }
  return undefined;
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.flatMap(entry => {
      const text = stringValue(entry);
      return text ? [text] : [];
    }))];
  }
  const text = stringValue(value);
  if (!text) return [];
  return text.split(/\s*;\s*/).map(part => part.trim()).filter(Boolean);
}

function archiveIdentifier(id: string): string | null {
  return id.startsWith(ARCHIVE_ID_PREFIX) && id.length > ARCHIVE_ID_PREFIX.length
    ? id.slice(ARCHIVE_ID_PREFIX.length)
    : null;
}

function archivePoster(identifier: string): string {
  return `https://archive.org/services/img/${encodeURIComponent(identifier)}`;
}

function archiveMetaFromDocument(doc: ArchiveSearchDoc): StremioMeta | null {
  const identifier = stringValue(doc.identifier);
  if (!identifier) return null;
  const title = stringValue(doc.title) ?? identifier;
  const year = stringValue(doc.year);
  const language = stringValue(doc.language);
  const subtitle = [year, language].filter(Boolean).join(' · ') || 'Internet Archive';
  return {
    id: `${ARCHIVE_ID_PREFIX}${identifier}`,
    type: 'movie',
    name: title,
    poster: archivePoster(identifier),
    background: archivePoster(identifier),
    releaseInfo: subtitle,
    genres: stringList(doc.subject).slice(0, 6),
    description: stringValue(doc.description),
  };
}

function archiveSearchValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').trim();
}

function archiveSearchUrl(extras: Record<string, string | number | undefined>): string {
  const clauses = ['collection:feature_films', 'mediatype:movies'];
  const search = typeof extras.search === 'string' ? archiveSearchValue(extras.search) : '';
  const language = typeof extras.language === 'string' ? archiveSearchValue(extras.language) : '';
  if (search) clauses.push(`(title:"${search}" OR description:"${search}")`);
  if (language) clauses.push(`language:"${language}"`);

  return [
    `${ARCHIVE_SEARCH_ENDPOINT}?q=${encodeURIComponent(clauses.join(' AND '))}`,
    'fl%5B%5D=identifier',
    'fl%5B%5D=title',
    'fl%5B%5D=year',
    'fl%5B%5D=subject',
    'fl%5B%5D=language',
    'fl%5B%5D=description',
    'rows=48',
    'page=1',
    'output=json',
    'sort%5B%5D=downloads%20desc',
  ].join('&');
}

async function fetchArchiveCatalog(extras: Record<string, string | number | undefined>): Promise<MediaItem[]> {
  const response = await fetchWithTimeout(archiveSearchUrl(extras), ARCHIVE_TIMEOUT_MS);
  if (!response.ok) throw new Error(`Internet Archive catalog HTTP ${response.status}`);
  const payload = await response.json() as { response?: { docs?: ArchiveSearchDoc[] } };
  return (payload.response?.docs ?? [])
    .map(archiveMetaFromDocument)
    .filter((meta): meta is StremioMeta => meta !== null)
    .map(meta => mediaFromMeta(FILMA_ARCHIVE_MANIFEST_URL, 'movie', meta));
}

function archiveFileScore(file: ArchiveFile): number {
  if (file.private === true) return -1;
  const name = stringValue(file.name);
  if (!name) return -1;
  const lower = name.toLocaleLowerCase();
  const mp4 = lower.endsWith('.mp4');
  const m4v = lower.endsWith('.m4v');
  const webm = lower.endsWith('.webm');
  if (!mp4 && !m4v && !webm) return -1;

  const format = normalizeText(stringValue(file.format) ?? '');
  const source = normalizeText(stringValue(file.source) ?? '');
  const rawSize = Number(stringValue(file.size) ?? 0);
  let score = mp4 ? 400 : m4v ? 330 : 260;
  if (format.includes('h.264') || format.includes('mpeg4') || format.includes('mpeg-4')) score += 130;
  if (source === 'derivative') score += 35;
  if (lower.includes('512kb')) score += 60;
  if (lower.includes('720') || lower.includes('1080')) score += 25;
  if (lower.includes('sample') || lower.includes('trailer')) score -= 500;
  if (rawSize >= 20_000_000 && rawSize <= 1_500_000_000) score += 45;
  if (rawSize > 2_500_000_000) score -= 80;
  return score;
}

export function rankArchivePlayableFiles(files: ArchiveFile[]): ArchiveFile[] {
  return files
    .map((file, index) => ({ file, index, score: archiveFileScore(file) }))
    .filter(entry => entry.score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(entry => entry.file);
}

function archiveDownloadUrl(identifier: string, name: string): string {
  const encodedName = name.split('/').map(part => encodeURIComponent(part)).join('/');
  return `${ARCHIVE_DOWNLOAD_ENDPOINT}/${encodeURIComponent(identifier)}/${encodedName}`;
}

async function fetchArchiveMetadata(identifier: string): Promise<ArchiveMetadataPayload> {
  const response = await fetchWithTimeout(`${ARCHIVE_METADATA_ENDPOINT}/${encodeURIComponent(identifier)}`, ARCHIVE_TIMEOUT_MS);
  if (!response.ok) throw new Error(`Internet Archive metadata HTTP ${response.status}`);
  return response.json() as Promise<ArchiveMetadataPayload>;
}

async function fetchArchiveMeta(id: string): Promise<StremioDetailedMeta> {
  const identifier = archiveIdentifier(id);
  if (!identifier) throw new Error('Invalid Internet Archive media identifier.');
  const payload = await fetchArchiveMetadata(identifier);
  const metadata = payload.metadata ?? {};
  const title = stringValue(metadata.title) ?? identifier;
  const year = stringValue(metadata.year ?? metadata.date);
  const language = stringValue(metadata.language);
  return {
    id,
    type: 'movie',
    name: title,
    poster: archivePoster(identifier),
    background: archivePoster(identifier),
    releaseInfo: [year, language].filter(Boolean).join(' · ') || 'Internet Archive',
    genres: stringList(metadata.subject).slice(0, 8),
    description: stringValue(metadata.description),
  };
}

async function fetchArchiveStreams(id: string): Promise<StremioStream[]> {
  const identifier = archiveIdentifier(id);
  if (!identifier) return [];
  const payload = await fetchArchiveMetadata(identifier);
  const metadata = payload.metadata ?? {};
  const language = stringValue(metadata.language);
  return rankArchivePlayableFiles(payload.files ?? [])
    .slice(0, 6)
    .flatMap((file, index) => {
      const name = stringValue(file.name);
      if (!name) return [];
      const format = stringValue(file.format) ?? name.split('.').pop()?.toUpperCase() ?? 'Video';
      return [{
        title: ['Internet Archive', language, format, `Source ${index + 1}`].filter(Boolean).join(' · '),
        url: archiveDownloadUrl(identifier, name),
      } satisfies StremioStream];
    });
}

export function localMediaId(manifestUrl: string, type: string, mediaId: string): string {
  return `addon:${encodeURIComponent(manifestUrl)}:${type}:${encodeURIComponent(mediaId)}`;
}

export function catalogSupportsSearch(catalog: StremioCatalog): boolean {
  return Boolean(catalog.extra?.some(extra => extra.name.toLocaleLowerCase() === 'search'));
}

export function catalogLanguageExtra(
  catalog: StremioCatalog,
  preferredAudioLanguages: AudioLanguage[],
  referenceYear = new Date().getFullYear(),
): Record<string, string> {
  const resolved: Record<string, string> = {};

  if (preferredAudioLanguages.length) {
    const languageExtra = catalog.extra?.find(extra => {
      const name = extra.name.toLocaleLowerCase().replace(/[_-]/g, '');
      return ['language', 'lang', 'audio', 'audiolanguage'].includes(name);
    });

    if (languageExtra) {
      for (const language of preferredAudioLanguages) {
        const option = optionForLanguage(languageExtra.options, language);
        if (option) {
          resolved[languageExtra.name] = option;
          break;
        }
      }
    }
  }

  if (catalog.id.toLocaleLowerCase() === 'year') {
    const currentYear = String(referenceYear);
    const yearExtra = catalog.extra?.find(extra =>
      Boolean(extra.isRequired)
      && ['genre', 'year'].includes(extra.name.toLocaleLowerCase())
      && Boolean(extra.options?.includes(currentYear)),
    );
    if (yearExtra && resolved[yearExtra.name] === undefined) {
      resolved[yearExtra.name] = currentYear;
    }
  }

  return resolved;
}

export function catalogCanLoadWithoutSearch(
  catalog: StremioCatalog,
  preferredAudioLanguages: AudioLanguage[],
): boolean {
  const languageExtra = catalogLanguageExtra(catalog, preferredAudioLanguages);
  return !(catalog.extra ?? []).some(extra => {
    if (!extra.isRequired) return false;
    const name = extra.name.toLocaleLowerCase();
    if (name === 'search') return true;
    return languageExtra[extra.name] === undefined;
  });
}

export async function fetchManifest(manifestUrl: string): Promise<StremioManifest> {
  if (manifestUrl === FILMA_ARCHIVE_MANIFEST_URL) return FILMA_ARCHIVE_MANIFEST;
  const response = await fetchWithTimeout(manifestUrl);
  if (!response.ok) throw new Error(`Add-on manifest HTTP ${response.status}`);
  return response.json() as Promise<StremioManifest>;
}

export async function fetchCatalog(
  manifestUrl: string,
  type: string,
  catalogId: string,
  extras: Record<string, string | number | undefined> = {},
): Promise<MediaItem[]> {
  if (manifestUrl === FILMA_ARCHIVE_MANIFEST_URL) {
    if (type !== 'movie' || catalogId !== ARCHIVE_CATALOG_ID) return [];
    return fetchArchiveCatalog(extras);
  }

  const extraArgs = Object.entries(extras)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined && entry[1] !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  const suffix = extraArgs ? `/${extraArgs}.json` : '.json';
  const url = `${addonBase(manifestUrl)}/catalog/${encodeURIComponent(type)}/${encodeURIComponent(catalogId)}${suffix}`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
  const payload = (await response.json()) as { metas?: StremioMeta[] };

  return (payload.metas ?? []).map(meta => mediaFromMeta(manifestUrl, type, meta));
}

export async function fetchMeta(
  manifestUrl: string,
  type: string,
  id: string,
): Promise<StremioDetailedMeta> {
  if (manifestUrl === FILMA_ARCHIVE_MANIFEST_URL) {
    if (type !== 'movie') throw new Error('FILMA Free only provides movies.');
    return fetchArchiveMeta(id);
  }

  const url = `${addonBase(manifestUrl)}/meta/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Metadata HTTP ${response.status}`);
  const payload = (await response.json()) as { meta?: StremioDetailedMeta };
  if (!payload.meta) throw new Error('Add-on returned no detailed metadata.');
  return payload.meta;
}

export function mediaItemForEpisode(series: MediaItem, video: StremioVideo): MediaItem {
  if (series.source?.kind !== 'stremio') {
    throw new Error('Episode source is not a Stremio-compatible series.');
  }

  const seasonEpisode = [
    typeof video.season === 'number' ? `S${video.season}` : undefined,
    typeof video.episode === 'number' ? `E${video.episode}` : undefined,
  ].filter(Boolean).join(' ');

  return {
    id: localMediaId(series.source.manifestUrl, series.source.mediaType, video.id),
    title: `${series.title} · ${video.title}`,
    subtitle: seasonEpisode || series.subtitle || 'Episode',
    poster: video.thumbnail || series.poster,
    backdrop: series.backdrop,
    genres: series.genres,
    source: {
      ...series.source,
      videoId: video.id,
    },
  };
}

export async function fetchStreams(
  manifestUrl: string,
  type: string,
  id: string,
): Promise<StremioStream[]> {
  if (manifestUrl === FILMA_ARCHIVE_MANIFEST_URL) {
    if (type !== 'movie') return [];
    return fetchArchiveStreams(id);
  }

  const url = `${addonBase(manifestUrl)}/stream/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Streams HTTP ${response.status}`);
  const payload = (await response.json()) as {
    streams?: Array<{ title?: string; name?: string; url?: string; externalUrl?: string }>;
  };
  return (payload.streams ?? []).map((stream, index) => ({
    title: stream.title || stream.name || `Stream ${index + 1}`,
    url: stream.url,
    externalUrl: stream.externalUrl,
  }));
}

export function rankStreamsByPreferredAudio<T extends { title: string }>(
  streams: T[],
  preferredAudioLanguages: AudioLanguage[],
): T[] {
  const languages = preferredAudioLanguages.length
    ? preferredAudioLanguages
    : BASE_AUDIO_LANGUAGES;

  return streams
    .map((stream, originalIndex) => {
      const normalized = normalizeText(stream.title);
      let score = 0;
      languages.forEach((language, index) => {
        if (LANGUAGE_ALIASES[language].some(alias => aliasAppears(normalized, alias))) {
          score = Math.max(score, 1000 - index * 100);
        }
      });
      return { stream, originalIndex, score };
    })
    .sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex)
    .map(item => item.stream);
}
