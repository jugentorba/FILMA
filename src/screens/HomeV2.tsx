import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ImageBackground,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { audioLanguageLabel, stringsFor } from '../i18n';
import { shouldShowInContinueWatching } from '../services/progress';
import {
  catalogCanLoadWithoutSearch,
  catalogLanguageExtra,
  catalogSupportsSearch,
  fetchCatalog,
  fetchManifest,
  FILMA_ARCHIVE_MANIFEST_URL,
  type StremioCatalog,
  type StremioManifest,
} from '../services/stremio';
import { fetchRtshArchiveMovies, type YouTubeVideo, youtubeConfigured } from '../services/youtube';
import { useFilma } from '../store/FilmaContext';
import type { AddonSource, FilmaState, MediaItem } from '../types';
import { FocusButton } from '../ui/FocusButton';
import { MediaCard } from '../ui/MediaCard';
import { theme } from '../ui/theme';
import { useResponsiveLayout } from '../ui/useResponsiveLayout';

type Props = {
  onSelect(item: MediaItem): void;
  onOpenYouTubeVideo(video: YouTubeVideo): void;
  onOpenSettings(): void;
};

type BrowseMode = 'all' | 'movie' | 'series';

type CatalogRow = {
  key: string;
  providerId: string;
  title: string;
  subtitle: string | undefined;
  mediaType: 'movie' | 'series';
  directlyPlayable: boolean;
  items: MediaItem[];
};

type SearchTarget = {
  key: string;
  manifestUrl: string;
  catalog: StremioCatalog;
};

type HomeCopy = {
  heading: string;
  all: string;
  movies: string;
  series: string;
  freeToPlay: string;
  freeToPlayHelp: string;
  playsHere: string;
  discover: string;
  discoverHelp: string;
  progress: string;
  search: string;
  audio: string;
  sourceProblem: string;
  sourceProblemHelp: string;
  configure: string;
  retry: string;
  noResults: string;
  loading: string;
};

const MAX_ROWS = 12;
const MAX_CATALOGS_PER_PROVIDER = 4;

function copyFor(language: FilmaState['preferences']['appLanguage']): HomeCopy {
  if (language === 'fr') {
    return {
      heading: 'Films & séries', all: 'Tout', movies: 'Films', series: 'Séries',
      freeToPlay: 'Gratuit · Lecture dans FILMA',
      freeToPlayHelp: 'Films gratuits avec des flux directs que FILMA peut lire lui-même.',
      playsHere: 'LECTURE FILMA', discover: 'À découvrir',
      discoverHelp: 'Catalogue films et séries. La lecture utilise tes sources actives.',
      progress: 'regardé', search: 'Rechercher un film ou une série', audio: 'Audio',
      sourceProblem: 'Une partie du catalogue est indisponible',
      sourceProblemHelp: 'FILMA continue avec les sources qui répondent. Tu peux aussi gérer tes sources dans les Réglages.',
      configure: 'Réglages', retry: 'Réessayer', noResults: 'Aucun résultat', loading: 'Chargement du catalogue…',
    };
  }
  if (language === 'sq') {
    return {
      heading: 'Filma & seriale', all: 'Të gjitha', movies: 'Filma', series: 'Seriale',
      freeToPlay: 'Falas · Luhet në FILMA',
      freeToPlayHelp: 'Filma falas me transmetim direkt që FILMA mund t’i luajë vetë.',
      playsHere: 'LUHET NË FILMA', discover: 'Zbulo',
      discoverHelp: 'Katalog filmash dhe serialesh. Luajtja përdor burimet e tua aktive.',
      progress: 'parë', search: 'Kërko film ose serial', audio: 'Audio',
      sourceProblem: 'Një pjesë e katalogut nuk u ngarkua',
      sourceProblemHelp: 'FILMA vazhdon me burimet që punojnë. Burimet mund t’i menaxhosh te Cilësimet.',
      configure: 'Cilësimet', retry: 'Provo përsëri', noResults: 'Nuk u gjet asgjë', loading: 'Duke ngarkuar katalogun…',
    };
  }
  return {
    heading: 'Movies & Series', all: 'All', movies: 'Movies', series: 'Series',
    freeToPlay: 'Free · Plays in FILMA',
    freeToPlayHelp: 'Free films with direct streams that FILMA can play itself.',
    playsHere: 'PLAYS IN FILMA', discover: 'Discover',
    discoverHelp: 'Movie and series catalogue. Playback uses your active providers.',
    progress: 'watched', search: 'Search movies and series', audio: 'Audio',
    sourceProblem: 'Part of the catalogue is unavailable',
    sourceProblemHelp: 'FILMA is continuing with the sources that work. You can manage providers in Settings.',
    configure: 'Settings', retry: 'Retry', noResults: 'No results found', loading: 'Loading catalogue…',
  };
}

function dedupe(items: MediaItem[]): MediaItem[] {
  const byId = new Map<string, MediaItem>();
  for (const item of items) if (!byId.has(item.id)) byId.set(item.id, item);
  return [...byId.values()];
}

function mediaType(item: MediaItem): 'movie' | 'series' | undefined {
  if (item.source?.kind === 'youtube') return 'movie';
  if (item.source?.kind !== 'stremio') return undefined;
  return item.source.mediaType === 'series' ? 'series' : 'movie';
}

function matchesMode(item: MediaItem, mode: BrowseMode): boolean {
  return mode === 'all' || mediaType(item) === mode;
}

function hasStreamResource(manifest: StremioManifest): boolean {
  return Boolean((manifest.resources ?? []).some(resource =>
    typeof resource === 'string' ? resource === 'stream' : resource.name === 'stream',
  ));
}

function browseCatalogs(catalogs: StremioCatalog[], preferred: FilmaState['preferences']['preferredAudioLanguages']): StremioCatalog[] {
  const loadable = catalogs.filter(catalog => catalogCanLoadWithoutSearch(catalog, preferred));
  const movies = loadable.filter(catalog => catalog.type === 'movie').slice(0, 2);
  const series = loadable.filter(catalog => catalog.type === 'series').slice(0, 2);
  return [...movies, ...series].slice(0, MAX_CATALOGS_PER_PROVIDER);
}

function rowTitle(
  addon: AddonSource,
  manifest: StremioManifest,
  catalog: StremioCatalog,
  copy: HomeCopy,
): { title: string; subtitle?: string } {
  if (addon.manifestUrl === FILMA_ARCHIVE_MANIFEST_URL) {
    return { title: copy.freeToPlay, subtitle: copy.freeToPlayHelp };
  }
  if (addon.id === 'auto-stremio:com.linvo.cinemeta') {
    return {
      title: catalog.type === 'series' ? copy.series : copy.movies,
      subtitle: copy.discoverHelp,
    };
  }
  return {
    title: `${manifest.name || addon.name} · ${catalog.type === 'series' ? copy.series : copy.movies}`,
    subtitle: copy.discoverHelp,
  };
}

function CatalogRowView({ row, state, onSelect }: { row: CatalogRow; state: FilmaState; onSelect(item: MediaItem): void }) {
  const listRef = useRef<FlatList<MediaItem>>(null);
  const layout = useResponsiveLayout();
  return (
    <View style={[styles.section, { paddingTop: layout.isTv ? 28 : layout.isCompactPhone ? 18 : 23 }]}>
      <View style={[styles.sectionHeader, { paddingHorizontal: layout.horizontalPadding }]}>
        <View style={styles.sectionHeadingText}>
          <View style={styles.sectionTitleLine}>
            <Text style={[styles.sectionTitle, { fontSize: layout.isTv ? 24 : layout.isCompactPhone ? 17 : 20 }]}>{row.title}</Text>
            {row.directlyPlayable ? <View style={styles.playablePill}><Text style={styles.playablePillText}>▶</Text></View> : null}
          </View>
          {row.subtitle ? <Text numberOfLines={1} style={styles.sectionSubtitle}>{row.subtitle}</Text> : null}
        </View>
        <Text style={styles.sectionCount}>{row.items.length}</Text>
      </View>
      <FlatList
        ref={listRef}
        horizontal
        data={row.items}
        keyExtractor={item => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingLeft: layout.horizontalPadding, paddingRight: layout.horizontalPadding }}
        initialNumToRender={layout.isTv ? 9 : layout.isTablet ? 7 : 5}
        windowSize={7}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          listRef.current?.scrollToOffset({ offset: Math.max(0, index * averageItemLength), animated: true });
        }}
        renderItem={({ item, index }) => {
          const favorite = state.favorites[item.id];
          return (
            <MediaCard
              item={item}
              progress={state.progress[item.id]}
              favorite={Boolean(favorite && !favorite.deletedAt)}
              onFocus={() => {
                if (Platform.isTV) listRef.current?.scrollToIndex({ index, viewPosition: 0.35, animated: true });
              }}
              onPress={() => onSelect(item)}
            />
          );
        }}
      />
    </View>
  );
}

function SimpleMediaRow({ title, items, state, onSelect }: { title: string; items: MediaItem[]; state: FilmaState; onSelect(item: MediaItem): void }) {
  const row: CatalogRow = {
    key: title,
    providerId: 'local',
    title,
    subtitle: undefined,
    mediaType: 'movie',
    directlyPlayable: false,
    items,
  };
  return <CatalogRowView row={row} state={state} onSelect={onSelect} />;
}

export function HomeScreen({ onSelect, onOpenYouTubeVideo, onOpenSettings }: Props) {
  const { state } = useFilma();
  const layout = useResponsiveLayout();
  const text = stringsFor(state.preferences.appLanguage);
  const copy = useMemo(() => copyFor(state.preferences.appLanguage), [state.preferences.appLanguage]);
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [searchTargets, setSearchTargets] = useState<SearchTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailures, setLoadFailures] = useState(0);
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<BrowseMode>('all');
  const [remoteResults, setRemoteResults] = useState<MediaItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [archiveVideos, setArchiveVideos] = useState<YouTubeVideo[]>([]);

  const activeAddons = useMemo(() => state.addons.filter(addon => addon.enabled && !addon.deletedAt), [state.addons]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadFailures(0);

    void Promise.all(activeAddons.map(async addon => {
      try {
        const manifest = await fetchManifest(addon.manifestUrl);
        const catalogs = (manifest.catalogs ?? []).filter(catalog => catalog.type === 'movie' || catalog.type === 'series');
        const targets = catalogs.filter(catalogSupportsSearch).map(catalog => ({
          key: `${addon.id}:${catalog.type}:${catalog.id}`,
          manifestUrl: addon.manifestUrl,
          catalog,
        } satisfies SearchTarget));
        const selectedCatalogs = browseCatalogs(catalogs, state.preferences.preferredAudioLanguages);
        const loadedRows = await Promise.all(selectedCatalogs.map(async catalog => {
          try {
            const items = await fetchCatalog(
              addon.manifestUrl,
              catalog.type,
              catalog.id,
              catalogLanguageExtra(catalog, state.preferences.preferredAudioLanguages),
            );
            if (!items.length) return null;
            const labels = rowTitle(addon, manifest, catalog, copy);
            return {
              key: `${addon.id}:${catalog.type}:${catalog.id}`,
              providerId: addon.id,
              title: labels.title,
              subtitle: labels.subtitle,
              mediaType: catalog.type === 'series' ? 'series' : 'movie',
              directlyPlayable: addon.manifestUrl === FILMA_ARCHIVE_MANIFEST_URL || hasStreamResource(manifest),
              items: dedupe(items),
            } satisfies CatalogRow;
          } catch {
            return null;
          }
        }));
        return { targets, rows: loadedRows.filter((row): row is CatalogRow => row !== null), failed: 0 };
      } catch {
        return { targets: [] as SearchTarget[], rows: [] as CatalogRow[], failed: 1 };
      }
    })).then(results => {
      if (cancelled) return;
      const mergedRows = results.flatMap(result => result.rows)
        .sort((a, b) => Number(b.directlyPlayable) - Number(a.directlyPlayable))
        .slice(0, MAX_ROWS);
      setRows(mergedRows);
      setSearchTargets(results.flatMap(result => result.targets));
      setLoadFailures(results.reduce((total, result) => total + result.failed, 0));
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [activeAddons, copy, reload, state.preferences.preferredAudioLanguages]);

  useEffect(() => {
    if (!youtubeConfigured()) {
      setArchiveVideos([]);
      return;
    }
    let cancelled = false;
    void fetchRtshArchiveMovies()
      .then(videos => { if (!cancelled) setArchiveVideos(videos); })
      .catch(() => { if (!cancelled) setArchiveVideos([]); });
    return () => { cancelled = true; };
  }, [reload]);

  const rtshItems = useMemo<MediaItem[]>(() => archiveVideos.map(video => ({
    id: `youtube:${video.id}`,
    title: video.title,
    subtitle: 'RTSH Arkiv · Shqip',
    poster: video.thumbnail,
    backdrop: video.thumbnail,
    genres: ['Shqip', 'RTSH Arkiv'],
    source: { kind: 'youtube', videoId: video.id, channelTitle: video.channelTitle },
  })), [archiveVideos]);
  const rtshById = useMemo(() => new Map<string, YouTubeVideo>(archiveVideos.map(video => [`youtube:${video.id}`, video])), [archiveVideos]);

  const loadedItems = useMemo(() => {
    const resumed = Object.values(state.progress).flatMap(progress => progress.item ? [progress.item as MediaItem] : []);
    return dedupe([...resumed, ...rtshItems, ...rows.flatMap(row => row.items)]);
  }, [rows, rtshItems, state.progress]);

  const visibleItems = useMemo(() => loadedItems.filter(item => matchesMode(item, mode)), [loadedItems, mode]);
  const visibleRows = useMemo(() => rows.filter(row => mode === 'all' || row.mediaType === mode), [mode, rows]);
  const playableItems = useMemo(() => visibleRows.filter(row => row.directlyPlayable).flatMap(row => row.items), [visibleRows]);
  const continueWatching = useMemo(() => visibleItems
    .filter(item => shouldShowInContinueWatching(state.progress[item.id]))
    .sort((a, b) => new Date(state.progress[b.id].updatedAt).getTime() - new Date(state.progress[a.id].updatedAt).getTime()), [state.progress, visibleItems]);
  const favorites = useMemo(() => visibleItems.filter(item => {
    const favorite = state.favorites[item.id];
    return Boolean(favorite && !favorite.deletedAt);
  }), [state.favorites, visibleItems]);

  const hero = continueWatching[0] ?? playableItems[0] ?? favorites[0] ?? visibleItems[0] ?? null;
  const heroProgress = hero ? state.progress[hero.id] : undefined;
  const heroRatio = heroProgress?.durationSeconds ? Math.min(1, Math.max(0, heroProgress.positionSeconds / heroProgress.durationSeconds)) : 0;
  const heroPlayable = hero?.source?.kind === 'stremio' && hero.source.manifestUrl === FILMA_ARCHIVE_MANIFEST_URL;

  const localResults = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return [];
    return visibleItems.filter(item => [item.title, item.subtitle, ...(item.genres ?? [])]
      .filter(Boolean).join(' ').toLocaleLowerCase().includes(needle));
  }, [query, visibleItems]);

  useEffect(() => {
    const needle = query.trim();
    const targets = searchTargets.filter(target => mode === 'all' || target.catalog.type === mode);
    if (needle.length < 2 || !targets.length) {
      setRemoteResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      void Promise.all(targets.map(async target => {
        try {
          return await fetchCatalog(target.manifestUrl, target.catalog.type, target.catalog.id, {
            ...catalogLanguageExtra(target.catalog, state.preferences.preferredAudioLanguages),
            search: needle,
          });
        } catch {
          return [] as MediaItem[];
        }
      })).then(results => {
        if (cancelled) return;
        setRemoteResults(dedupe(results.flat()).filter(item => matchesMode(item, mode)).slice(0, 80));
        setSearching(false);
      });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mode, query, searchTargets, state.preferences.preferredAudioLanguages]);

  const searchResults = useMemo(() => dedupe([...remoteResults, ...localResults]), [localResults, remoteResults]);
  const audioSummary = state.preferences.preferredAudioLanguages.length
    ? state.preferences.preferredAudioLanguages.map(language => audioLanguageLabel(language, state.preferences.appLanguage)).join(' · ')
    : text.anyLanguage;

  const heroHeight = layout.isTv ? 430 : layout.isTablet ? 360 : layout.isCompactPhone ? 255 : 290;
  const heroPadding = layout.horizontalPadding;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: layout.isTv ? 70 : 108 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={[styles.top, { paddingHorizontal: layout.horizontalPadding, paddingTop: layout.isTv ? 28 : 13 }]}>
        <View style={styles.headingRow}>
          <Text style={[styles.heading, { fontSize: layout.isTv ? 35 : layout.isCompactPhone ? 23 : 27 }]}>{copy.heading}</Text>
          <View style={styles.modeRow}>
            <FocusButton compact label={copy.all} active={mode === 'all'} onPress={() => setMode('all')} />
            <FocusButton compact label={copy.movies} active={mode === 'movie'} onPress={() => setMode('movie')} />
            <FocusButton compact label={copy.series} active={mode === 'series'} onPress={() => setMode('series')} />
          </View>
        </View>

        <View style={[styles.searchRow, (layout.isTablet || layout.isTv) && styles.searchRowWide]}>
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={copy.search}
              placeholderTextColor={theme.muted}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searching ? <ActivityIndicator size="small" /> : null}
          </View>
          <View style={styles.audioBox}>
            <Text style={styles.audioLabel}>{copy.audio}</Text>
            <Text numberOfLines={1} style={styles.audioValue}>{audioSummary}</Text>
          </View>
        </View>
      </View>

      {!query.trim() && hero ? (
        <ImageBackground
          source={hero.backdrop ? { uri: hero.backdrop } : hero.poster ? { uri: hero.poster } : undefined}
          style={[styles.hero, { minHeight: heroHeight, marginHorizontal: heroPadding }]}
          imageStyle={styles.heroImage}
        >
          <View style={styles.heroShade} />
          <View style={[styles.heroBody, { padding: layout.isTv ? 34 : layout.isCompactPhone ? 18 : 24 }]}>
            <View style={styles.heroBadges}>
              <View style={[styles.heroBadge, heroPlayable && styles.heroBadgePlayable]}>
                <Text style={styles.heroBadgeText}>{heroPlayable ? copy.playsHere : (mediaType(hero) === 'series' ? copy.series : copy.movies).toUpperCase()}</Text>
              </View>
            </View>
            <Text numberOfLines={2} style={[styles.heroTitle, { fontSize: layout.isTv ? 43 : layout.isCompactPhone ? 25 : 31, lineHeight: layout.isTv ? 48 : layout.isCompactPhone ? 29 : 36 }]}>{hero.title}</Text>
            <Text numberOfLines={1} style={styles.heroMeta}>{[hero.year, hero.genres?.slice(0, 2).join(' · '), hero.subtitle].filter(Boolean).join('   •   ')}</Text>
            {heroRatio > 0 ? (
              <View style={styles.heroProgressWrap}>
                <View style={styles.heroProgressTrack}><View style={[styles.heroProgressFill, { width: `${Math.round(heroRatio * 100)}%` }]} /></View>
                <Text style={styles.heroProgressText}>{Math.round(heroRatio * 100)}% {copy.progress}</Text>
              </View>
            ) : null}
            <View style={styles.heroActions}>
              <FocusButton active preferredFocus label={`▶ ${heroProgress && shouldShowInContinueWatching(heroProgress) ? text.continue : text.play}`} onPress={() => onSelect(hero)} />
            </View>
          </View>
        </ImageBackground>
      ) : null}

      {query.trim() ? (
        searchResults.length ? (
          <SimpleMediaRow title={`${text.searchResults} · ${searchResults.length}`} items={searchResults} state={state} onSelect={onSelect} />
        ) : !searching ? (
          <View style={[styles.notice, { marginHorizontal: layout.horizontalPadding }]}>
            <Text style={styles.noticeTitle}>{copy.noResults}</Text>
          </View>
        ) : null
      ) : (
        <>
          {continueWatching.length ? <SimpleMediaRow title={text.continueWatching} items={continueWatching} state={state} onSelect={onSelect} /> : null}
          {favorites.length ? <SimpleMediaRow title={text.favorites} items={favorites} state={state} onSelect={onSelect} /> : null}
          {visibleRows.map(row => <CatalogRowView key={row.key} row={row} state={state} onSelect={onSelect} />)}
          {mode !== 'series' && rtshItems.length ? (
            <SimpleMediaRow
              title={state.preferences.appLanguage === 'fr' ? 'Films albanais · RTSH Arkiv' : state.preferences.appLanguage === 'sq' ? 'Filma shqiptarë · RTSH Arkiv' : 'Albanian Movies · RTSH Arkiv'}
              items={rtshItems}
              state={state}
              onSelect={item => {
                const video = rtshById.get(item.id);
                if (video) onOpenYouTubeVideo(video);
              }}
            />
          ) : null}
        </>
      )}

      {loading ? (
        <View style={[styles.loadingRow, { paddingHorizontal: layout.horizontalPadding }]}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>{copy.loading}</Text>
        </View>
      ) : null}

      {!loading && loadFailures > 0 ? (
        <View style={[styles.notice, { marginHorizontal: layout.horizontalPadding }]}>
          <View style={styles.noticeTextBlock}>
            <Text style={styles.noticeTitle}>{copy.sourceProblem}</Text>
            <Text style={styles.noticeText}>{copy.sourceProblemHelp}</Text>
          </View>
          <View style={styles.noticeActions}>
            <FocusButton compact active label={copy.retry} onPress={() => setReload(value => value + 1)} />
            <FocusButton compact label={copy.configure} onPress={onOpenSettings} />
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07090f' },
  top: { paddingBottom: 14 },
  headingRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  heading: { color: '#f7f8fb', fontWeight: '900', letterSpacing: -0.8 },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  searchRow: { marginTop: 12, gap: 8 },
  searchRowWide: { flexDirection: 'row', alignItems: 'stretch' },
  searchBox: { flex: 1, minHeight: Platform.isTV ? 52 : 44, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, borderRadius: 14, borderWidth: 1, borderColor: '#242b3a', backgroundColor: '#10141e' },
  searchIcon: { color: '#939cad', fontSize: 21, fontWeight: '800' },
  searchInput: { flex: 1, color: '#f5f7fb', fontSize: Platform.isTV ? 17 : 14, paddingVertical: 0 },
  audioBox: { minHeight: Platform.isTV ? 52 : 44, minWidth: Platform.isTV ? 290 : 0, maxWidth: Platform.isTV ? 360 : undefined, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 14, borderWidth: 1, borderColor: '#242b3a', backgroundColor: '#10141e' },
  audioLabel: { color: '#7f899b', fontSize: 9, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  audioValue: { color: '#eef1f6', marginTop: 2, fontSize: 12, fontWeight: '800' },
  hero: { overflow: 'hidden', borderRadius: Platform.isTV ? 22 : 17, justifyContent: 'flex-end', backgroundColor: '#111622', borderWidth: 1, borderColor: '#20283a' },
  heroImage: { borderRadius: Platform.isTV ? 22 : 17, opacity: 0.78 },
  heroShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(3,5,10,0.57)' },
  heroBody: { maxWidth: Platform.isTV ? 760 : 620 },
  heroBadges: { flexDirection: 'row', gap: 7 },
  heroBadge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: 'rgba(12,16,25,0.88)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  heroBadgePlayable: { backgroundColor: 'rgba(26,92,66,0.91)', borderColor: 'rgba(99,241,175,0.45)' },
  heroBadgeText: { color: '#f7f8fb', fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  heroTitle: { color: '#ffffff', marginTop: 11, fontWeight: '900', letterSpacing: -1 },
  heroMeta: { color: '#d4dae5', marginTop: 7, fontSize: Platform.isTV ? 14 : 11, fontWeight: '700' },
  heroActions: { flexDirection: 'row', marginTop: 16 },
  heroProgressWrap: { width: '75%', maxWidth: 370, marginTop: 13 },
  heroProgressTrack: { height: 4, overflow: 'hidden', borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.27)' },
  heroProgressFill: { height: '100%', borderRadius: 99, backgroundColor: theme.accent },
  heroProgressText: { color: '#ced5e2', marginTop: 4, fontSize: 9, fontWeight: '800' },
  section: {},
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 9 },
  sectionHeadingText: { flex: 1 },
  sectionTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { color: '#f4f6fa', fontWeight: '900', letterSpacing: -0.4 },
  sectionSubtitle: { color: '#7e8799', fontSize: 10, marginTop: 2, fontWeight: '600' },
  sectionCount: { color: '#687286', fontWeight: '900', fontSize: 10, paddingBottom: 2 },
  playablePill: { width: 21, height: 21, borderRadius: 99, backgroundColor: '#173d31', alignItems: 'center', justifyContent: 'center' },
  playablePillText: { color: '#69e7ad', fontSize: 9, fontWeight: '900' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingTop: 22 },
  loadingText: { color: '#8791a4', fontWeight: '700', fontSize: 12 },
  notice: { marginTop: 20, borderRadius: 14, borderWidth: 1, borderColor: '#2a3141', backgroundColor: '#10141e', padding: 13, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  noticeTextBlock: { flex: 1, minWidth: 190 },
  noticeTitle: { color: '#eff2f7', fontSize: 14, fontWeight: '900' },
  noticeText: { color: '#8993a5', marginTop: 4, fontSize: 11, lineHeight: 16 },
  noticeActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
