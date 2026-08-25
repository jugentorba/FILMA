import type { AddonSource, AppLanguage, AudioLanguage, PlaylistSource } from '../types';
import type { StremioManifest } from './stremio';

const OFFICIAL_STREMIO_INDEX_URL = 'https://raw.githubusercontent.com/Stremio/stremio-official-addons/master/index.json';
const CINEMETA_MANIFEST_URL = 'https://v3-cinemeta.strem.io/manifest.json';
const IPTV_ORG_LANGUAGE_BASE = 'https://iptv-org.github.io/iptv/languages';
const DISCOVERY_TIMESTAMP = '1970-01-01T00:00:00.000Z';
const OFFICIAL_INDEX_CACHE_MS = 30 * 60 * 1000;
const OFFICIAL_INDEX_TIMEOUT_MS = 10_000;

type OfficialAddonIndexEntry = {
  manifest?: StremioManifest;
  transportUrl?: string;
  flags?: {
    official?: boolean;
    protected?: boolean;
  };
};

type CachedOfficialProviders = {
  fetchedAt: number;
  providers: DiscoveredMovieProvider[];
};

export type DiscoveredMovieProvider = AddonSource & {
  automatic: true;
  providesCatalog: boolean;
  providesMeta: boolean;
  providesStream: boolean;
};

const IPTV_LANGUAGE_CODES: Record<AudioLanguage, string> = {
  en: 'eng',
  fr: 'fra',
  sq: 'sqi',
  it: 'ita',
  es: 'spa',
  de: 'deu',
  tr: 'tur',
};

const LANGUAGE_NAMES: Record<AudioLanguage, string> = {
  en: 'English',
  fr: 'French',
  sq: 'Albanian',
  it: 'Italian',
  es: 'Spanish',
  de: 'German',
  tr: 'Turkish',
};

const BASE_AUDIO_LANGUAGES: AudioLanguage[] = ['fr', 'sq', 'en'];

let officialProviderCache: CachedOfficialProviders | undefined;

async function fetchOfficialIndex(): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OFFICIAL_INDEX_TIMEOUT_MS);
  try {
    return await fetch(OFFICIAL_STREMIO_INDEX_URL, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function resourceNames(manifest: StremioManifest): Set<string> {
  return new Set((manifest.resources ?? []).map(resource =>
    typeof resource === 'string' ? resource : resource.name,
  ));
}

function normalizeManifestUrl(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw || !/^https:\/\//i.test(raw)) return null;
  if (/\/manifest\.json(?:\?.*)?$/i.test(raw)) return raw;
  return `${raw.replace(/\/$/, '')}/manifest.json`;
}

function providerFromEntry(entry: OfficialAddonIndexEntry): DiscoveredMovieProvider | null {
  if (!entry.flags?.official || !entry.manifest) return null;
  const manifestUrl = normalizeManifestUrl(entry.transportUrl);
  if (!manifestUrl) return null;

  const mediaTypes = new Set(entry.manifest.types ?? []);
  if (!mediaTypes.has('movie') && !mediaTypes.has('series')) return null;

  const resources = resourceNames(entry.manifest);
  const providesCatalog = resources.has('catalog');
  const providesMeta = resources.has('meta');
  const providesStream = resources.has('stream');
  if (!providesCatalog && !providesMeta && !providesStream) return null;

  return {
    id: `auto-stremio:${entry.manifest.id}`,
    name: entry.manifest.name || entry.manifest.id,
    manifestUrl,
    enabled: true,
    createdAt: DISCOVERY_TIMESTAMP,
    updatedAt: DISCOVERY_TIMESTAMP,
    automatic: true,
    providesCatalog,
    providesMeta,
    providesStream,
  };
}

function fallbackCinemeta(): DiscoveredMovieProvider {
  return {
    id: 'auto-stremio:com.linvo.cinemeta',
    name: 'Cinemeta',
    manifestUrl: CINEMETA_MANIFEST_URL,
    enabled: true,
    createdAt: DISCOVERY_TIMESTAMP,
    updatedAt: DISCOVERY_TIMESTAMP,
    automatic: true,
    providesCatalog: true,
    providesMeta: true,
    providesStream: false,
  };
}

function dedupeProviders<T extends AddonSource>(providers: T[]): T[] {
  const seen = new Set<string>();
  return providers.filter(provider => {
    const key = provider.manifestUrl.trim().toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mergeMovieProviders(
  configured: AddonSource[],
  automatic: AddonSource[],
): AddonSource[] {
  return dedupeProviders([
    ...configured.filter(provider => provider.enabled && !provider.deletedAt),
    ...automatic.filter(provider => provider.enabled && !provider.deletedAt),
  ]);
}

export async function discoverOfficialMovieProviders(): Promise<DiscoveredMovieProvider[]> {
  if (officialProviderCache && Date.now() - officialProviderCache.fetchedAt < OFFICIAL_INDEX_CACHE_MS) {
    return officialProviderCache.providers;
  }

  try {
    const response = await fetchOfficialIndex();
    if (!response.ok) throw new Error(`Official add-on index HTTP ${response.status}`);
    const payload = await response.json() as unknown;
    if (!Array.isArray(payload)) throw new Error('Official add-on index had an unexpected format.');

    const providers = dedupeProviders(
      payload
        .map(entry => providerFromEntry(entry as OfficialAddonIndexEntry))
        .filter((provider): provider is DiscoveredMovieProvider => provider !== null),
    );

    const cinemetaIndex = providers.findIndex(provider => provider.id === 'auto-stremio:com.linvo.cinemeta');
    if (cinemetaIndex === -1) {
      providers.unshift(fallbackCinemeta());
    } else if (cinemetaIndex > 0) {
      const [cinemeta] = providers.splice(cinemetaIndex, 1);
      providers.unshift(cinemeta);
    }

    officialProviderCache = { fetchedAt: Date.now(), providers };
    return providers;
  } catch {
    const providers = [fallbackCinemeta()];
    officialProviderCache = { fetchedAt: Date.now(), providers };
    return providers;
  }
}

export async function discoverAutomaticCatalogProviders(): Promise<AddonSource[]> {
  return (await discoverOfficialMovieProviders())
    .filter(provider => provider.providesCatalog || provider.providesMeta);
}

export async function discoverAutomaticStreamProviders(): Promise<AddonSource[]> {
  return (await discoverOfficialMovieProviders())
    .filter(provider => provider.providesStream);
}

export function automaticTvPlaylists(
  preferredAudioLanguages: AudioLanguage[],
  _appLanguage: AppLanguage,
): PlaylistSource[] {
  const requested = preferredAudioLanguages.length
    ? preferredAudioLanguages
    : BASE_AUDIO_LANGUAGES;

  const languages = [...new Set(requested)].slice(0, 3);
  return languages.map(language => {
    const code = IPTV_LANGUAGE_CODES[language];
    return {
      id: `auto-tv:${code}`,
      name: `Public ${LANGUAGE_NAMES[language]} TV`,
      url: `${IPTV_ORG_LANGUAGE_BASE}/${code}.m3u`,
      enabled: true,
      createdAt: DISCOVERY_TIMESTAMP,
      updatedAt: DISCOVERY_TIMESTAMP,
    };
  });
}

export function mergeTvPlaylists(
  configured: PlaylistSource[],
  automatic: PlaylistSource[],
): PlaylistSource[] {
  const seen = new Set<string>();
  return [
    ...configured.filter(source => source.enabled && !source.deletedAt),
    ...automatic,
  ].filter(source => {
    const key = source.url.trim().toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
