import type { AppLanguage } from '../types';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const API_KEY = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY?.trim();
const RTSH_ARKIV_HANDLE = '@RTSHArkiv';
const YOUTUBE_TIMEOUT_MS = 12_000;
const YOUTUBE_MUSIC_CATEGORY_ID = '10';
const RTSH_CACHE_MS = 30 * 60 * 1000;
const RTSH_PLAYLIST_LIMIT = 6;

export type YouTubeBrowseMode = 'videos' | 'music';

export type YouTubeVideo = {
  id: string;
  title: string;
  channelTitle: string;
  channelId?: string;
  description?: string;
  publishedAt?: string;
  thumbnail?: string;
};

type ThumbnailSet = Record<string, { url?: string }>;

type SearchSnippet = {
  title?: string;
  channelTitle?: string;
  channelId?: string;
  description?: string;
  publishedAt?: string;
  thumbnails?: ThumbnailSet;
};

type SearchItem = {
  id?: { videoId?: string };
  snippet?: SearchSnippet;
};

type VideoItem = {
  id?: string;
  snippet?: SearchSnippet;
};

type ChannelItem = {
  id?: string;
};

type PlaylistItem = {
  id?: string;
  snippet?: {
    title?: string;
    description?: string;
    thumbnails?: ThumbnailSet;
  };
  contentDetails?: {
    itemCount?: number;
  };
};

type PlaylistVideoItem = {
  snippet?: {
    title?: string;
    description?: string;
    publishedAt?: string;
    thumbnails?: ThumbnailSet;
    resourceId?: { videoId?: string };
    videoOwnerChannelTitle?: string;
    videoOwnerChannelId?: string;
  };
  contentDetails?: {
    videoId?: string;
  };
};

type SearchResponse = { items?: SearchItem[]; nextPageToken?: string };
type VideosResponse = { items?: VideoItem[]; nextPageToken?: string };
type ChannelsResponse = { items?: ChannelItem[] };
type PlaylistsResponse = { items?: PlaylistItem[]; nextPageToken?: string };
type PlaylistItemsResponse = { items?: PlaylistVideoItem[]; nextPageToken?: string };

type CachedRtshMovies = {
  fetchedAt: number;
  videos: YouTubeVideo[];
};

let rtshMoviesCache: CachedRtshMovies | undefined;

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function thumbnailFor(thumbnails?: ThumbnailSet): string | undefined {
  return thumbnails?.maxres?.url
    ?? thumbnails?.standard?.url
    ?? thumbnails?.high?.url
    ?? thumbnails?.medium?.url
    ?? thumbnails?.default?.url;
}

function mapSearchItem(item: SearchItem): YouTubeVideo | null {
  const id = item.id?.videoId;
  const snippet = item.snippet;
  if (!id || !snippet?.title) return null;
  return {
    id,
    title: decodeHtml(snippet.title),
    channelTitle: decodeHtml(snippet.channelTitle ?? 'YouTube'),
    channelId: snippet.channelId,
    description: snippet.description ? decodeHtml(snippet.description) : undefined,
    publishedAt: snippet.publishedAt,
    thumbnail: thumbnailFor(snippet.thumbnails),
  };
}

function mapVideoItem(item: VideoItem): YouTubeVideo | null {
  const id = item.id;
  const snippet = item.snippet;
  if (!id || !snippet?.title) return null;
  return {
    id,
    title: decodeHtml(snippet.title),
    channelTitle: decodeHtml(snippet.channelTitle ?? 'YouTube'),
    channelId: snippet.channelId,
    description: snippet.description ? decodeHtml(snippet.description) : undefined,
    publishedAt: snippet.publishedAt,
    thumbnail: thumbnailFor(snippet.thumbnails),
  };
}

function mapPlaylistVideoItem(item: PlaylistVideoItem, fallbackChannelId: string): YouTubeVideo | null {
  const id = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId;
  const snippet = item.snippet;
  if (!id || !snippet?.title || snippet.title === 'Deleted video' || snippet.title === 'Private video') return null;
  return {
    id,
    title: decodeHtml(snippet.title),
    channelTitle: decodeHtml(snippet.videoOwnerChannelTitle ?? 'RTSH Arkiv'),
    channelId: snippet.videoOwnerChannelId ?? fallbackChannelId,
    description: snippet.description ? decodeHtml(snippet.description) : undefined,
    publishedAt: snippet.publishedAt,
    thumbnail: thumbnailFor(snippet.thumbnails),
  };
}

function languageRegion(language: AppLanguage): { language: string; region: string } {
  if (language === 'fr') return { language: 'fr', region: 'FR' };
  if (language === 'sq') return { language: 'sq', region: 'AL' };
  return { language: 'en', region: 'US' };
}

async function youtubeGet<T>(path: string, params: Record<string, string>): Promise<T> {
  if (!API_KEY) throw new Error('YouTube API key is not configured in this FILMA build.');
  const query = new URLSearchParams({ ...params, key: API_KEY });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), YOUTUBE_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${YOUTUBE_API_BASE}/${path}?${query.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`YouTube request timed out after ${Math.round(YOUTUBE_TIMEOUT_MS / 1000)}s.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`YouTube API HTTP ${response.status}${body ? `: ${body.slice(0, 180)}` : ''}`);
  }
  return response.json() as Promise<T>;
}

export function youtubeConfigured(): boolean {
  return Boolean(API_KEY);
}

export async function fetchPopularYouTubeVideos(
  language: AppLanguage,
  mode: YouTubeBrowseMode = 'videos',
): Promise<YouTubeVideo[]> {
  const locale = languageRegion(language);
  const params: Record<string, string> = {
    part: 'snippet',
    chart: 'mostPopular',
    maxResults: '36',
    regionCode: locale.region,
  };
  if (mode === 'music') params.videoCategoryId = YOUTUBE_MUSIC_CATEGORY_ID;

  const response = await youtubeGet<VideosResponse>('videos', params);
  return (response.items ?? []).flatMap(item => {
    const video = mapVideoItem(item);
    return video ? [video] : [];
  });
}

export async function searchYouTubeVideos(
  query: string,
  language: AppLanguage,
  mode: YouTubeBrowseMode = 'videos',
): Promise<YouTubeVideo[]> {
  const needle = query.trim();
  if (!needle) return [];
  const locale = languageRegion(language);
  const params: Record<string, string> = {
    part: 'snippet',
    type: 'video',
    maxResults: '36',
    q: needle,
    relevanceLanguage: locale.language,
    regionCode: locale.region,
    safeSearch: 'moderate',
  };
  if (mode === 'music') params.videoCategoryId = YOUTUBE_MUSIC_CATEGORY_ID;

  const response = await youtubeGet<SearchResponse>('search', params);
  return (response.items ?? []).flatMap(item => {
    const video = mapSearchItem(item);
    return video ? [video] : [];
  });
}

function normalizedTitle(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

export function isRtshFilmPlaylistTitle(title: string): boolean {
  const normalized = normalizedTitle(title);
  return /\bfilm(?:a|at|e|i|ave)?\b/.test(normalized)
    || normalized.includes('kinostudio')
    || normalized.includes('kinema');
}

function rtshPlaylistPriority(item: PlaylistItem): number {
  const title = normalizedTitle(item.snippet?.title ?? '');
  if (/\bfilma?\s+shqip/.test(title)) return 0;
  if (title.includes('film') && title.includes('vjet')) return 1;
  if (title.includes('film')) return 2;
  if (title.includes('kinostudio')) return 3;
  if (title.includes('kinema')) return 4;
  return 99;
}

function dedupeVideos(videos: YouTubeVideo[]): YouTubeVideo[] {
  const seen = new Set<string>();
  return videos.filter(video => {
    if (seen.has(video.id)) return false;
    seen.add(video.id);
    return true;
  });
}

async function resolveRtshArchiveChannelId(): Promise<string | null> {
  const channels = await youtubeGet<ChannelsResponse>('channels', {
    part: 'id',
    forHandle: RTSH_ARKIV_HANDLE,
    maxResults: '1',
  });
  return channels.items?.[0]?.id ?? null;
}

async function fetchRtshFilmPlaylists(channelId: string): Promise<PlaylistItem[]> {
  const response = await youtubeGet<PlaylistsResponse>('playlists', {
    part: 'snippet,contentDetails',
    channelId,
    maxResults: '50',
  });

  return (response.items ?? [])
    .filter(item => Boolean(item.id && item.snippet?.title && isRtshFilmPlaylistTitle(item.snippet.title)))
    .sort((a, b) => rtshPlaylistPriority(a) - rtshPlaylistPriority(b))
    .slice(0, RTSH_PLAYLIST_LIMIT);
}

async function fetchPlaylistVideos(playlistId: string, channelId: string): Promise<YouTubeVideo[]> {
  const response = await youtubeGet<PlaylistItemsResponse>('playlistItems', {
    part: 'snippet,contentDetails',
    playlistId,
    maxResults: '50',
  });
  return (response.items ?? []).flatMap(item => {
    const video = mapPlaylistVideoItem(item, channelId);
    return video ? [video] : [];
  });
}

async function fallbackRtshMovieSearch(channelId: string): Promise<YouTubeVideo[]> {
  const response = await youtubeGet<SearchResponse>('search', {
    part: 'snippet',
    type: 'video',
    channelId,
    maxResults: '50',
    q: 'film shqiptar',
    order: 'viewCount',
    relevanceLanguage: 'sq',
    safeSearch: 'moderate',
  });

  return (response.items ?? []).flatMap(item => {
    const video = mapSearchItem(item);
    return video && video.channelId === channelId ? [video] : [];
  });
}

export async function fetchRtshArchiveMovies(): Promise<YouTubeVideo[]> {
  if (rtshMoviesCache && Date.now() - rtshMoviesCache.fetchedAt < RTSH_CACHE_MS) {
    return rtshMoviesCache.videos;
  }

  const channelId = await resolveRtshArchiveChannelId();
  if (!channelId) return [];

  let videos: YouTubeVideo[] = [];
  try {
    const playlists = await fetchRtshFilmPlaylists(channelId);
    if (playlists.length) {
      const results = await Promise.all(playlists.map(playlist => fetchPlaylistVideos(playlist.id!, channelId)));
      videos = dedupeVideos(results.flat()).slice(0, 120);
    }
  } catch {
    // The official channel search below remains a reliable fallback if playlist
    // metadata is temporarily unavailable or YouTube changes playlist visibility.
  }

  if (videos.length < 12) {
    const fallback = await fallbackRtshMovieSearch(channelId);
    videos = dedupeVideos([...videos, ...fallback]).slice(0, 120);
  }

  rtshMoviesCache = { fetchedAt: Date.now(), videos };
  return videos;
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}
