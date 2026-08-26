import type { AddonSource, AppLanguage, AudioLanguage, PlaylistSource } from '../types';
import { FILMA_ARCHIVE_MANIFEST_URL } from './stremio';

export const CINEMETA_MANIFEST_URL = 'https://v3-cinemeta.strem.io/manifest.json';
const WATCHHUB_MANIFEST_URL = 'https://watchhub.strem.io/manifest.json';
const OFFICIAL_ADDONS_INDEX_URL = 'https://raw.githubusercontent.com/Stremio/stremio-official-addons/master/index.json';
const IPTV_ORG_COUNTRY_BASE = 'https://iptv-org.github.io/iptv/countries';
const DISCOVERY_TIMESTAMP = '1970-01-01T00:00:00.000Z';
const OFFICIAL_PROVIDER_TTL_MS = 30 * 60 * 1000;
const OFFICIAL_PROVIDER_TIMEOUT_MS = 8_000;

const UNSUPPORTED_AUTOMATIC_PROVIDER_IDS = new Set([
  'org.stremio.pubdomainmovies',
  'org.stremio.local',
]);

type CountrySource = { code: string; countryName: string; countryGroup: string };
type OfficialIndexResource = string | { name?: string; types?: string[]; idPrefixes?: string[] };
type OfficialIndexManifest = {
  id?: string;
  name?: string;
  resources?: OfficialIndexResource[];
  types?: string[];
  catalogs?: Array<{ type?: string }>;
};
type OfficialIndexEntry = {
  manifest?: OfficialIndexManifest;
  transportUrl?: string;
  flags?: { official?: boolean; protected?: boolean };
};
type ProviderCache = { expiresAt: number; providers: DiscoveredMovieProvider[] };

export type DiscoveredMovieProvider = AddonSource & {
  automatic: true;
  providesCatalog: boolean;
  providesMeta: boolean;
  providesStream: boolean;
};

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
let providerCache: ProviderCache | null = null;

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

function cinemetaProvider(): DiscoveredMovieProvider {
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

function watchHubProvider(): DiscoveredMovieProvider {
  return {
    id: 'auto-stremio:org.stremio.watchhub',
    name: 'WatchHub',
    manifestUrl: WATCHHUB_MANIFEST_URL,
    enabled: true,
    createdAt: DISCOVERY_TIMESTAMP,
    updatedAt: DISCOVERY_TIMESTAMP,
    automatic: true,
    providesCatalog: false,
    providesMeta: false,
    providesStream: true,
  };
}

function coreProviders(): DiscoveredMovieProvider[] {
  return [filmaArchiveProvider(), cinemetaProvider(), watchHubProvider()];
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

function resourceNames(manifest: OfficialIndexManifest): Set<string> {
  return new Set((manifest.resources ?? []).flatMap(resource => {
    const name = typeof resource === 'string' ? resource : resource.name;
    return name ? [name] : [];
  }));
}

function declaredMediaTypes(manifest: OfficialIndexManifest): Set<string> {
  const fromResources = (manifest.resources ?? []).flatMap(resource =>
    typeof resource === 'string' ? [] : (resource.types ?? []),
  );
  const fromCatalogs = (manifest.catalogs ?? []).flatMap(catalog => catalog.type ? [catalog.type] : []);
  return new Set([...(manifest.types ?? []), ...fromResources, ...fromCatalogs]);
}

function safeAutomaticTransportUrl(value: string | undefined): value is string {
  if (!value || !/^https:\/\//i.test(value)) return false;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLocaleLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
    return /manifest\.json$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function officialMovieProvidersFromIndex(entries: unknown): DiscoveredMovieProvider[] {
  if (!Array.isArray(entries)) return [];
  const providers: DiscoveredMovieProvider[] = [];

  for (const rawEntry of entries) {
    if (!rawEntry || typeof rawEntry !== 'object') continue;
    const entry = rawEntry as OfficialIndexEntry;
    const manifest = entry.manifest;
    const id = manifest?.id?.trim();
    const name = manifest?.name?.trim();
    if (!manifest || !id || !name || !safeAutomaticTransportUrl(entry.transportUrl)) continue;
    if (entry.flags?.official === false || UNSUPPORTED_AUTOMATIC_PROVIDER_IDS.has(id)) continue;

    const resources = resourceNames(manifest);
    const providesCatalog = resources.has('catalog');
    const providesMeta = resources.has('meta');
    const providesStream = resources.has('stream');
    if (!providesCatalog && !providesMeta && !providesStream) continue;

    const types = declaredMediaTypes(manifest);
    if (!types.has('movie') && !types.has('series')) continue;

    providers.push({
      id: `auto-stremio:${id}`,
      name,
      manifestUrl: entry.transportUrl,
      enabled: true,
      createdAt: DISCOVERY_TIMESTAMP,
      updatedAt: DISCOVERY_TIMESTAMP,
      automatic: true,
      providesCatalog,
      providesMeta,
      providesStream,
    });
  }

  return dedupeProviders(providers);
}

function cachedProviders(): DiscoveredMovieProvider[] | undefined {
  if (!providerCache) return undefined;
  if (providerCache.expiresAt <= Date.now()) {
    providerCache = null;
    return undefined;
  }
  return providerCache.providers;
}

async function fetchOfficialProviderIndex(): Promise<DiscoveredMovieProvider[]> {
  const request = fetch(OFFICIAL_ADDONS_INDEX_URL, { headers: { Accept: 'application/json' } }).then(async response => {
    if (!response.ok) throw new Error(`Provider index HTTP ${response.status}`);
    return officialMovieProvidersFromIndex(await response.json());
  });
  const timeout = new Promise<DiscoveredMovieProvider[]>((_, reject) => {
    setTimeout(() => reject(new Error('Provider discovery timed out.')), OFFICIAL_PROVIDER_TIMEOUT_MS);
  });
  const discovered = await Promise.race([request, timeout]);
  return dedupeProviders([...coreProviders(), ...discovered]);
}

async function loadOfficialMovieProviders(force = false): Promise<DiscoveredMovieProvider[]> {
  if (!force) {
    const cached = cachedProviders();
    if (cached) return cached;
  }

  try {
    const providers = await fetchOfficialProviderIndex();
    providerCache = { expiresAt: Date.now() + OFFICIAL_PROVIDER_TTL_MS, providers };
    return providers;
  } catch {
    return providerCache?.providers ?? coreProviders();
  }
}

export function mergeMovieProviders(configured: AddonSource[], automatic: AddonSource[]): AddonSource[] {
  return dedupeProviders([
    ...configured.filter(provider => provider.enabled && !provider.deletedAt),
    ...automatic.filter(provider => provider.enabled && !provider.deletedAt),
  ]);
}

export async function refreshOfficialMovieProviders(): Promise<DiscoveredMovieProvider[]> {
  return loadOfficialMovieProviders(true);
}

export async function discoverOfficialMovieProviders(): Promise<DiscoveredMovieProvider[]> {
  const cached = cachedProviders();
  if (cached) return cached;
  void loadOfficialMovieProviders(true).catch(() => undefined);
  return coreProviders();
}

export async function discoverAutomaticCatalogProviders(): Promise<AddonSource[]> {
  const providers = await loadOfficialMovieProviders(false);
  return providers.filter(provider => provider.providesCatalog || provider.providesMeta);
}

export async function discoverAutomaticStreamProviders(): Promise<AddonSource[]> {
  const providers = await loadOfficialMovieProviders(false);
  return providers.filter(provider => provider.providesStream);
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
