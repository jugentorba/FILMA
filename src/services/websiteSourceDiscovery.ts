import { validatePlaybackAddon } from './addonValidation';

export type WebsiteMovieSourceDiscovery =
  | { valid: true; manifestUrl: string; name: string }
  | { valid: false; reason: 'invalid-url' | 'no-compatible-feed' };

const DISCOVERY_TIMEOUT_MS = 6_000;
const MAX_DISCOVERY_DOCUMENT_BYTES = 512 * 1024;

function normalizeHttpUrl(input: string): URL | undefined {
  try {
    const parsed = new URL(input.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    parsed.hash = '';
    return parsed;
  } catch {
    return undefined;
  }
}

export function websiteManifestCandidates(input: string): string[] {
  const parsed = normalizeHttpUrl(input);
  if (!parsed) return [];

  const candidates: string[] = [parsed.toString()];
  if (!/manifest\.json$/i.test(parsed.pathname)) {
    const base = new URL(parsed.toString());
    base.search = '';
    base.pathname = `${base.pathname.replace(/\/+$/, '')}/manifest.json`;
    candidates.push(base.toString());
    candidates.push(new URL('/manifest.json', parsed.origin).toString());
  }

  return [...new Set(candidates)];
}

async function fetchTextWithTimeout(url: string): Promise<string | undefined> {
  try {
    const request = fetch(url, {
      headers: {
        Accept: 'text/html,application/json;q=0.9,*/*;q=0.5',
      },
    }).then(async response => {
      if (!response.ok) return undefined;
      const length = Number(response.headers.get('content-length') || 0);
      if (length > MAX_DISCOVERY_DOCUMENT_BYTES) return undefined;
      const text = await response.text();
      return text.length <= MAX_DISCOVERY_DOCUMENT_BYTES ? text : undefined;
    });
    const timeout = new Promise<undefined>(resolve => {
      setTimeout(() => resolve(undefined), DISCOVERY_TIMEOUT_MS);
    });
    return await Promise.race([request, timeout]);
  } catch {
    return undefined;
  }
}

function absoluteManifestUrl(baseUrl: string, candidate: string): string | undefined {
  try {
    const resolved = new URL(candidate, baseUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return undefined;
    if (!/manifest\.json(?:$|[?#])/i.test(resolved.toString())) return undefined;
    return resolved.toString();
  } catch {
    return undefined;
  }
}

export function manifestLinksFromWebsiteDocument(baseUrl: string, document: string): string[] {
  const matches = new Set<string>();
  const patterns = [
    /(?:href|src)\s*=\s*["']([^"']*manifest\.json(?:\?[^"']*)?)["']/gi,
    /["'](?:manifestUrl|stremioManifestUrl)["']\s*:\s*["']([^"']+)["']/gi,
    /(https?:\/\/[^\s"'<>]+\/manifest\.json(?:\?[^\s"'<>]+)?)/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(document)) !== null) {
      const resolved = absoluteManifestUrl(baseUrl, match[1]);
      if (resolved) matches.add(resolved);
    }
  }
  return [...matches];
}

async function validateCandidate(url: string): Promise<{ manifestUrl: string; name: string } | undefined> {
  try {
    const validation = await validatePlaybackAddon(url);
    return validation.valid ? { manifestUrl: url, name: validation.name } : undefined;
  } catch {
    return undefined;
  }
}

export async function discoverWebsiteMovieSource(input: string): Promise<WebsiteMovieSourceDiscovery> {
  const parsed = normalizeHttpUrl(input);
  if (!parsed) return { valid: false, reason: 'invalid-url' };

  const attempted = new Set<string>();
  for (const candidate of websiteManifestCandidates(parsed.toString())) {
    attempted.add(candidate);
    const result = await validateCandidate(candidate);
    if (result) return { valid: true, ...result };
  }

  const document = await fetchTextWithTimeout(parsed.toString());
  if (document) {
    for (const candidate of manifestLinksFromWebsiteDocument(parsed.toString(), document)) {
      if (attempted.has(candidate)) continue;
      attempted.add(candidate);
      const result = await validateCandidate(candidate);
      if (result) return { valid: true, ...result };
    }
  }

  return { valid: false, reason: 'no-compatible-feed' };
}
