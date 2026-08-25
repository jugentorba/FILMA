import type { MediaItem } from '../types';

export type StremioManifest = {
  id: string;
  name: string;
  version: string;
  resources?: Array<string | { name: string; types?: string[]; idPrefixes?: string[] }>;
  types?: string[];
  catalogs?: Array<{ type: string; id: string; name?: string }>;
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

function addonBase(manifestUrl: string): string {
  return manifestUrl.replace(/\/manifest\.json(?:\?.*)?$/i, '').replace(/\/$/, '');
}

export function localMediaId(manifestUrl: string, type: string, mediaId: string): string {
  return `addon:${encodeURIComponent(manifestUrl)}:${type}:${encodeURIComponent(mediaId)}`;
}

export async function fetchManifest(manifestUrl: string): Promise<StremioManifest> {
  const response = await fetch(manifestUrl);
  if (!response.ok) throw new Error(`Add-on manifest HTTP ${response.status}`);
  return response.json() as Promise<StremioManifest>;
}

export async function fetchCatalog(
  manifestUrl: string,
  type: string,
  catalogId: string,
): Promise<MediaItem[]> {
  const url = `${addonBase(manifestUrl)}/catalog/${encodeURIComponent(type)}/${encodeURIComponent(catalogId)}.json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
  const payload = (await response.json()) as { metas?: StremioMeta[] };

  return (payload.metas ?? []).map(meta => ({
    id: localMediaId(manifestUrl, type, meta.id),
    title: meta.name,
    poster: meta.poster,
    backdrop: meta.background,
    subtitle: meta.releaseInfo,
    genres: meta.genres,
    source: {
      kind: 'stremio',
      manifestUrl,
      mediaType: type,
      mediaId: meta.id,
    },
  }));
}

export async function fetchMeta(
  manifestUrl: string,
  type: string,
  id: string,
): Promise<StremioDetailedMeta> {
  const url = `${addonBase(manifestUrl)}/meta/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`;
  const response = await fetch(url);
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
): Promise<Array<{ title: string; url?: string; externalUrl?: string }>> {
  const url = `${addonBase(manifestUrl)}/stream/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`;
  const response = await fetch(url);
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
