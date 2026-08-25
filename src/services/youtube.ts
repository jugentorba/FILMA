import type { AppLanguage } from '../types';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const API_KEY = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY?.trim();

export type YouTubeVideo = {
  id: string;
  title: string;
  channelTitle: string;
  channelId?: string;
  description?: string;
  publishedAt?: string;
  thumbnail?: string;
};

type SearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    channelId?: string;
    description?: string;
    publishedAt?: string;
    thumbnails?: Record<string, { url?: string }>;
  };
};

type VideoItem = {
  id?: string;
  snippet?: SearchItem['snippet'];
};

type SearchResponse = { items?: SearchItem[]; nextPageToken?: string };
type VideosResponse = { items?: VideoItem[]; nextPageToken?: string };

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function thumbnailFor(thumbnails?: Record<string, { url?: string }>): string | undefined {
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

function languageRegion(language: AppLanguage): { language: string; region: string } {
  if (language === 'fr') return { language: 'fr', region: 'FR' };
  if (language === 'sq') return { language: 'sq', region: 'AL' };
  return { language: 'en', region: 'US' };
}

async function youtubeGet<T>(path: string, params: Record<string, string>): Promise<T> {
  if (!API_KEY) throw new Error('YouTube API key is not configured in this FILMA build.');
  const query = new URLSearchParams({ ...params, key: API_KEY });
  const response = await fetch(`${YOUTUBE_API_BASE}/${path}?${query.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`YouTube API HTTP ${response.status}${body ? `: ${body.slice(0, 180)}` : ''}`);
  }
  return response.json() as Promise<T>;
}

export function youtubeConfigured(): boolean {
  return Boolean(API_KEY);
}

export async function fetchPopularYouTubeVideos(language: AppLanguage): Promise<YouTubeVideo[]> {
  const locale = languageRegion(language);
  const response = await youtubeGet<VideosResponse>('videos', {
    part: 'snippet',
    chart: 'mostPopular',
    maxResults: '36',
    regionCode: locale.region,
  });
  return (response.items ?? []).flatMap(item => {
    const video = mapVideoItem(item);
    return video ? [video] : [];
  });
}

export async function searchYouTubeVideos(query: string, language: AppLanguage): Promise<YouTubeVideo[]> {
  const needle = query.trim();
  if (!needle) return [];
  const locale = languageRegion(language);
  const response = await youtubeGet<SearchResponse>('search', {
    part: 'snippet',
    type: 'video',
    maxResults: '36',
    q: needle,
    relevanceLanguage: locale.language,
    regionCode: locale.region,
    safeSearch: 'moderate',
  });
  return (response.items ?? []).flatMap(item => {
    const video = mapSearchItem(item);
    return video ? [video] : [];
  });
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}
