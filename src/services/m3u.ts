import type { LiveChannel } from '../types';

function attr(line: string, name: string): string | undefined {
  const match = line.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return match?.[1]?.trim() || undefined;
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

    const name = meta?.split(',').slice(1).join(',').trim() || `Channel ${channels.length + 1}`;
    const stableKey = `${attr(meta ?? '', 'tvg-id') ?? ''}|${name}|${line}`;

    channels.push({
      id: encodeURIComponent(stableKey),
      name,
      url: line,
      logo: attr(meta ?? '', 'tvg-logo'),
      group: attr(meta ?? '', 'group-title'),
      tvgId: attr(meta ?? '', 'tvg-id'),
    });
    meta = undefined;
  }

  return channels;
}

export async function fetchPlaylist(url: string): Promise<LiveChannel[]> {
  const response = await fetch(url, { headers: { Accept: 'application/x-mpegURL,text/plain,*/*' } });
  if (!response.ok) throw new Error(`Playlist HTTP ${response.status}`);
  return parseM3U(await response.text());
}

export async function checkSource(url: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const response = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-2048' } });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}
