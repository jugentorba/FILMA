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
  name: string;
  poster?: string;
  background?: string;
  releaseInfo?: string;
  genres?: string[];
};

function addonBase(manifestUrl: string): string {
  return manifestUrl.replace(/\/manifest\.json(?:\?.*)?$/i, '').replace(/\/$/, '');
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
    id: meta.id,
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
