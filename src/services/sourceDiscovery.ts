import type { AddonSource, AppLanguage, AudioLanguage, PlaylistSource } from '../types';
import { FILMA_ARCHIVE_MANIFEST_URL, type StremioManifest } from './stremio';

const OFFICIAL_STREMIO_INDEX_URL = 'https://raw.githubusercontent.com/Stremio/stremio-official-addons/master/index.json';
const CINEMETA_MANIFEST_URL = 'https://v3-cinemeta.strem.io/manifest.json';
const WATCHHUB_MANIFEST_URL = 'https://watchhub.strem.io/manifest.json';
const IPTV_ORG_COUNTRY_BASE = 'https://iptv-org.github.io/iptv/countries';
const DISCOVERY_TIMESTAMP = '1970-01-01T00:00:00.000Z';
const OFFICIAL_INDEX_CACHE_MS = 30 * 60 * 1000;
const OFFICIAL_INDEX_RETRY_MS = 2 * 60 * 1000;
const OFFICIAL_INDEX_TIMEOUT_MS = 6_000;

const UNSUPPORTED_AUTOMATIC_PROVIDER_IDS = new Set(['org.stremio.pubdomainmovies', 'org.stremio.local']);

type OfficialAddonIndexEntry = {
  manifest?: StremioManifest;
  transportUrl?: string;
  flags?: { official?: boolean; protected?: boolean };
};

type CachedOfficialProviders = { fetchedAt: number; providers: DiscoveredMovieProvider[] };

export type DiscoveredMovieProvider = AddonSource & {
  automatic: true;
  providesCatalog: boolean;
  providesMeta: boolean;
  providesStream: boolean;
};

type CountrySource = { code: string; countryName: string; countryGroup: string };

const COUNTRY_SOURCES_BY_LANGUAGE: Partial<Record<AudioLanguage, CountrySource[]>> = {
  fr: [{ code: 'fr', countryName: 'France', countryGroup: 'France' }],
  en: [
    { code: 'uk', countryName: 'United Kingdom', countryGroup: 'United Kingdom' },
    { code: 'us', countryName: 'United States', countryGroup: 'United States' },
  ],
  it: [{ code: 'it', countryName: 'Italy', countryGroup: 'Italy' }],
  es: [{ code: 'es', countryName: 'Spain', countryGroup: 'Spain' }],
  de: [{ code: 'de', countryName: 'Germany', countryGroup: 'Germany' }],
  tr: [{ code: 'tr', countryName: 'Turkey', countryGroup: 'Turkey' }],
};

const ALBANIA_GROUP_SOURCES: CountrySource[] = [
  { code: 'al', countryName: 'Albania', countryGroup: 'Albania' },
  { code: 'xk', countryName: 'Kosovo', countryGroup: 'Albania' },
];
const BASE_AUDIO_LANGUAGES: AudioLanguage[] = ['fr', 'sq', 'en'];

let officialProviderCache: CachedOfficialProviders | undefined;
let refreshInFlight: Promise<DiscoveredMovieProvider[]> | undefined;
let lastRefreshAttemptAt = 0;

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
  return new Set((manifest.resources ?? []).map(resource => typeof resource === 'string' ? resource : resource.name));
}

function normalizeManifestUrl(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw || !/^https:\/\//i.test(raw)) return null;
  return /\/manifest\.json(?:\?.*)?$/i.test(raw) ? raw : `${raw.replace(/\/$/, '')}/manifest.json`;
}

function providerRuntimeSupported(manifest: StremioManifest, manifestUrl: string): boolean {
  if (UNSUPPORTED_AUTOMATIC_PROVIDER_IDS.has(manifest.id)) return false;
  return !/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::|\/)/i.test(manifestUrl);
}

function providerFromEntry(entry: OfficialAddonIndexEntry): DiscoveredMovieProvider | null {
  if (!entry.flags?.official || !entry.manifest) return null;
  const manifestUrl = normalizeManifestUrl(entry.transportUrl);
  if (!manifestUrl || !providerRuntimeSupported(entry.manifest, manifestUrl)) return null;
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

export function filmaArchiveProvider(): DiscoveredMovieProvider {
  return {
    id: 'auto-stremio:com.filma.archive',
    name: 'FILMA Free',
    manifestUrl: FILMA_ARCHIVE_MANIFEST_URL,
    enabled: true,
    createdAt: DISCOVERY_TIMESTAMP,
    updatedAt: DISCOVERY_TIMESTAMP,
    automatic: true,
    providesCatalog: true,
    providesMeta: true,
    providesStream: true,
  };
}

function fallbackCinemeta(): DiscoveredMovieProvider {
  return {
    id: 'auto-stremio:com.linvo.cinemeta', name: 'Cinemeta', manifestUrl: CINEMETA_MANIFEST_URL,
    enabled: true, createdAt: DISCOVERY_TIMESTAMP, updatedAt: DISCOVERY_TIMESTAMP, automatic: true,
    providesCatalog: true, providesMeta: true, providesStream: false,
  };
}

function fallbackWatchHub(): DiscoveredMovieProvider {
  return {
    id: 'auto-stremio:org.stremio.watchhub', name: 'WatchHub', manifestUrl: WATCHHUB_MANIFEST_URL,
    enabled: true, createdAt: DISCOVERY_TIMESTAMP, updatedAt: DISCOVERY_TIMESTAMP, automatic: true,
    providesCatalog: false, providesMeta: false, providesStream: true,
  };
}

function coreProviders(): DiscoveredMovieProvider[] {
  return [filmaArchiveProvider(), fallbackCinemeta(), fallbackWatchHub()];
}

function ensureCoreProviders(providers: DiscoveredMovieProvider[]): DiscoveredMovieProvider[] {
  const byId = new Map(providers.map(provider => [provider.id, provider] as const));
  byId.set('auto-stremio:com.filma.archive', filmaArchiveProvider());
  if (!byId.has('auto-stremio:com.linvo.cinemeta')) byId.set('auto-stremio:com.linvo.cinemeta', fallbackCinemeta());
  if (!byId.has('auto-stremio:org.stremio.watchhub')) byId.set('auto-stremio:org.stremio.watchhub', fallbackWatchHub());
  const ordered = [
    byId.get('auto-stremio:com.filma.archive')!,
    byId.get('auto-stremio:com.linvo.cinemeta')!,
    byId.get('auto-stremio:org.stremio.watchhub')!,
  ];
  for (const provider of providers) if (!ordered.some(item => item.id === provider.id)) ordered.push(provider);
  return ordered;
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

export function mergeMovieProviders(configured: AddonSource[], automatic: AddonSource[]): AddonSource[] {
  return dedupeProviders([
    ...configured.filter(provider => provider.enabled && !provider.deletedAt),
    ...automatic.filter(provider => provider.enabled && !provider.deletedAt),
  ]);
}

async function refreshOfficialProviders(force = false): Promise<DiscoveredMovieProvider[]> {
  if (refreshInFlight) return refreshInFlight;
  const current = officialProviderCache?.providers ?? coreProviders();
  if (!force && Date.now() - lastRefreshAttemptAt < OFFICIAL_INDEX_RETRY_MS) return current;

  lastRefreshAttemptAt = Date.now();
  refreshInFlight = (async () => {
    try {
      const response = await fetchOfficialIndex();
      if (!response.ok) return current;
      const payload = await response.json() as unknown;
      if (!Array.isArray(payload)) return current;
      const providers = ensureCoreProviders(dedupeProviders(
        payload.map(entry => providerFromEntry(entry as OfficialAddonIndexEntry))
          .filter((provider): provider is DiscoveredMovieProvider => provider !== null),
      ));
      officialProviderCache = { fetchedAt: Date.now(), providers };
      return providers;
    } catch {
      return current;
    } finally {
      refreshInFlight = undefined;
    }
  })();
  return refreshInFlight;
}

export async function refreshOfficialMovieProviders(): Promise<DiscoveredMovieProvider[]> {
  return refreshOfficialProviders(true);
}

export async function discoverOfficialMovieProviders(): Promise<DiscoveredMovieProvider[]> {
  if (!officialProviderCache) {
    officialProviderCache = { fetchedAt: 0, providers: coreProviders() };
    void refreshOfficialProviders();
    return officialProviderCache.providers;
  }
  if (Date.now() - officialProviderCache.fetchedAt >= OFFICIAL_INDEX_CACHE_MS) void refreshOfficialProviders();
  return officialProviderCache.providers;
}

export async function discoverAutomaticCatalogProviders(): Promise<AddonSource[]> {
  return (await discoverOfficialMovieProviders()).filter(provider => provider.providesCatalog || provider.providesMeta);
}

export async function discoverAutomaticStreamProviders(): Promise<AddonSource[]> {
  return (await discoverOfficialMovieProviders()).filter(provider => provider.providesStream);
}

function playlistForCountry(source: CountrySource): PlaylistSource {
  return {
    id: `auto-tv:country:${source.code}`,
    name: `${source.countryName} TV`,
    url: `${IPTV_ORG_COUNTRY_BASE}/${source.code}.m3u`,
    enabled: true,
    createdAt: DISCOVERY_TIMESTAMP,
    updatedAt: DISCOVERY_TIMESTAMP,
    countryCode: source.code,
    countryName: source.countryName,
    countryGroup: source.countryGroup,
  };
}

export function automaticTvPlaylists(preferredAudioLanguages: AudioLanguage[], _appLanguage: AppLanguage): PlaylistSource[] {
  const requested = preferredAudioLanguages.length ? preferredAudioLanguages : BASE_AUDIO_LANGUAGES;
  const countrySources: CountrySource[] = [...ALBANIA_GROUP_SOURCES];
  for (const language of requested) if (language !== 'sq') countrySources.push(...(COUNTRY_SOURCES_BY_LANGUAGE[language] ?? []));
  if (!countrySources.some(source => source.code === 'fr')) countrySources.push({ code: 'fr', countryName: 'France', countryGroup: 'France' });
  const seen = new Set<string>();
  return countrySources.filter(source => {
    if (seen.has(source.code)) return false;
    seen.add(source.code);
    return true;
  }).map(playlistForCountry);
}

export function mergeTvPlaylists(configured: PlaylistSource[], automatic: PlaylistSource[]): PlaylistSource[] {
  const seen = new Set<string>();
  return [...configured.filter(source => source.enabled && !source.deletedAt), ...automatic].filter(source => {
    const key = source.url.trim().toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
