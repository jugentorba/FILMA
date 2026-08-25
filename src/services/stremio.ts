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

async function fetchWithTimeout(url: string, timeoutMs = STREMIO_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Stremio request timed out after ${Math.round(timeoutMs / 1000)}s.`);
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
