import type { LiveChannel } from '../types';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function attr(line: string, name: string): string | undefined {
  const key = escapeRegExp(name);
  const match = line.match(new RegExp(`${key}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s,]+))`, 'i'));
  return (match?.[1] ?? match?.[2] ?? match?.[3])?.trim() || undefined;
}

function normalized(value?: string): string {
  return (value ?? '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function inferredGroup(name: string, rawGroup?: string): string | undefined {
  if (/\b(sport|sports|supersport)\b/i.test(name)) return 'Sports';
  return rawGroup;
}

export function channelIdentity(channel: LiveChannel): string {
  if (channel.tvgId?.trim()) return `tvg:${normalized(channel.tvgId)}`;
  return `name:${normalized(channel.country)}:${normalized(channel.group)}:${normalized(channel.name)}`;
}

export function mergeLiveChannels(channelLists: LiveChannel[][]): LiveChannel[] {
  const merged = new Map<string, LiveChannel>();

  for (const channel of channelLists.flat()) {
    const identity = channelIdentity(channel);
    const existing = merged.get(identity);
    if (!existing) {
      merged.set(identity, { ...channel, alternateUrls: [...new Set(channel.alternateUrls ?? [])].filter(url => url !== channel.url) });
      continue;
    }

    const urls = [...new Set([
      existing.url,
      ...(existing.alternateUrls ?? []),
      channel.url,
      ...(channel.alternateUrls ?? []),
    ])];
    const primary = !existing.url.startsWith('https://') && channel.url.startsWith('https://')
      ? channel.url
      : existing.url;

    merged.set(identity, {
      ...existing,
      url: primary,
      alternateUrls: urls.filter(url => url !== primary),
      logo: existing.logo ?? channel.logo,
      group: existing.group ?? channel.group,
      tvgId: existing.tvgId ?? channel.tvgId,
      country: existing.country ?? channel.country,
      countryCode: existing.countryCode ?? channel.countryCode,
      sourceName: existing.sourceName ?? channel.sourceName,
    });
  }

  return [...merged.values()];
}

export function parseM3U(text: string): LiveChannel[] {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const channels: LiveChannel[] = [];
  let meta: string | undefined;

  for (const line of lines) {
    if (line.startsWith('#EXTINF:')) {
      meta = line;
      continue;
    }

    if (line.startsWith('#')) continue;
    if (!/^https?:\/\//i.test(line)) {
      meta = undefined;
      continue;
    }

    const commaIndex = meta?.indexOf(',') ?? -1;
    const displayName = commaIndex >= 0 ? meta?.slice(commaIndex + 1).trim() : undefined;
    const name = displayName || `Channel ${channels.length + 1}`;
    const tvgId = attr(meta ?? '', 'tvg-id');
    const rawGroup = attr(meta ?? '', 'group-title');
    const stableKey = `${tvgId ?? ''}|${rawGroup ?? ''}|${name}|${line}`;

    channels.push({
      id: encodeURIComponent(stableKey),
      name,
      url: line,
      logo: attr(meta ?? '', 'tvg-logo'),
      group: inferredGroup(name, rawGroup),
      tvgId,
    });
    meta = undefined;
  }

  return channels;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPlaylist(url: string, timeoutMs = 15_000): Promise<LiveChannel[]> {
  if (url.startsWith('file://')) {
    const FileSystem = await import('expo-file-system/legacy');
    const channels = parseM3U(await FileSystem.readAsStringAsync(url));
    if (!channels.length) throw new Error('Playlist contains no playable HTTP/HLS channels.');
    return channels;
  }

  const response = await fetchWithTimeout(url, {
    headers: { Accept: 'application/x-mpegURL,application/vnd.apple.mpegurl,text/plain,*/*' },
  }, timeoutMs);
  if (!response.ok) throw new Error(`Playlist HTTP ${response.status}`);
  const channels = parseM3U(await response.text());
  if (!channels.length) throw new Error('Playlist contains no playable HTTP/HLS channels.');
  return channels;
}

export async function checkSource(url: string, timeoutMs = 10_000): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-2048' },
    }, timeoutMs);
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error
        ? (error.name === 'AbortError' ? 'Timed out' : error.message)
        : 'Network error',
    };
  }
}
