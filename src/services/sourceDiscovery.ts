import type { AddonSource, AppLanguage, AudioLanguage, PlaylistSource } from '../types';
import { FILMA_ARCHIVE_MANIFEST_URL } from './stremio';

export const CINEMETA_MANIFEST_URL = 'https://v3-cinemeta.strem.io/manifest.json';
const WATCHHUB_MANIFEST_URL = 'https://watchhub.strem.io/manifest.json';
const IPTV_ORG_COUNTRY_BASE = 'https://iptv-org.github.io/iptv/countries';
const DISCOVERY_TIMESTAMP = '1970-01-01T00:00:00.000Z';

type CountrySource = { code: string; countryName: string; countryGroup: string };

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

export function mergeMovieProviders(configured: AddonSource[], automatic: AddonSource[]): AddonSource[] {
  return dedupeProviders([
    ...configured.filter(provider => provider.enabled && !provider.deletedAt),
    ...automatic.filter(provider => provider.enabled && !provider.deletedAt),
  ]);
}

export async function refreshOfficialMovieProviders(): Promise<DiscoveredMovieProvider[]> {
  return coreProviders();
}

export async function discoverOfficialMovieProviders(): Promise<DiscoveredMovieProvider[]> {
  return coreProviders();
}

export async function discoverAutomaticCatalogProviders(): Promise<AddonSource[]> {
  return coreProviders().filter(provider => provider.providesCatalog || provider.providesMeta);
}

export async function discoverAutomaticStreamProviders(): Promise<AddonSource[]> {
  return coreProviders().filter(provider => provider.providesStream);
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
