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
import {
  catalogExtrasForPreferences,
  clearMediaDiscoveryCache,
  dedupeMediaItems,
  getCatalogCached,
  getManifestCached,
  selectBrowseCatalogs,
} from '../services/mediaDiscovery';
import { shouldShowInContinueWatching } from '../services/progress';
import {
  catalogSupportsSearch,
  FILMA_ARCHIVE_MANIFEST_URL,
  type StremioCatalog,
  type StremioManifest,
} from '../services/stremio';
import { fetchRtshArchiveMovies, type YouTubeVideo, youtubeConfigured } from '../services/youtube';
import { useFilma } from '../store/FilmaContext';
import type { FilmaState, MediaItem } from '../types';
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
  popular: string;
  new: string;
  featured: string;
  freeToPlay: string;
  freeToPlayHelp: string;
  search: string;
  audio: string;
  watched: string;
  sourceProblem: string;
  sourceProblemHelp: string;
  configure: string;
  retry: string;
  noResults: string;
  loading: string;
  updatedByFilma: string;
};

const MAX_ROWS = 14;

function copyFor(language: FilmaState['preferences']['appLanguage']): HomeCopy {
  if (language === 'fr') {
    return {
      heading: 'Films & séries', all: 'Tout', movies: 'Films', series: 'Séries',
      popular: 'Populaires', new: 'Nouveautés', featured: 'À découvrir',
      freeToPlay: 'Gratuit sur FILMA', freeToPlayHelp: 'Lecture directe dans FILMA.',
      search: 'Rechercher un film ou une série', audio: 'Audio', watched: 'regardé',
      sourceProblem: 'Certains contenus n’ont pas été actualisés',
      sourceProblemHelp: 'FILMA continuera automatiquement avec les sources disponibles et réessaiera les autres.',
      configure: 'Réglages', retry: 'Actualiser', noResults: 'Aucun résultat', loading: 'Chargement…',
      updatedByFilma: 'Mis à jour automatiquement par FILMA',
    };
  }
  if (language === 'sq') {
    return {
      heading: 'Filma & seriale', all: 'Të gjitha', movies: 'Filma', series: 'Seriale',
      popular: 'Më të njohura', new: 'Të reja', featured: 'Për ty',
      freeToPlay: 'Falas në FILMA', freeToPlayHelp: 'Luhet direkt në FILMA.',
      search: 'Kërko film ose serial', audio: 'Audio', watched: 'parë',
      sourceProblem: 'Disa përmbajtje nuk u përditësuan',
      sourceProblemHelp: 'FILMA do të vazhdojë me burimet që punojnë dhe do t’i provojë të tjerat përsëri automatikisht.',
      configure: 'Cilësimet', retry: 'Rifresko', noResults: 'Nuk u gjet asgjë', loading: 'Duke ngarkuar…',
      updatedByFilma: 'Përditësohet automatikisht nga FILMA',
    };
  }
  return {
    heading: 'Movies & Series', all: 'All', movies: 'Movies', series: 'Series',
    popular: 'Popular', new: 'New', featured: 'For You',
    freeToPlay: 'Free on FILMA', freeToPlayHelp: 'Plays directly in FILMA.',
    search: 'Search movies and series', audio: 'Audio', watched: 'watched',
    sourceProblem: 'Some content was not refreshed',
    sourceProblemHelp: 'FILMA will keep using the available sources and retry the others automatically.',
    configure: 'Settings', retry: 'Refresh', noResults: 'No results found', loading: 'Loading…',
    updatedByFilma: 'Updated automatically by FILMA',
  };
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

function catalogKindLabel(catalog: StremioCatalog, copy: HomeCopy): string {
  const id = catalog.id.toLocaleLowerCase();
  const name = (catalog.name ?? '').toLocaleLowerCase();
  if (id === 'top' || name.includes('popular')) return copy.popular;
  if (id === 'year' || name === 'new' || name.includes('new')) return copy.new;
  if (id === 'imdbrating' || name.includes('featured') || name.includes('rating')) return copy.featured;
  return catalog.name?.trim() || copy.featured;
}

function rowLabels(
  manifestUrl: string,
  catalog: StremioCatalog,
  copy: HomeCopy,
): { title: string; subtitle?: string } {
  if (manifestUrl === FILMA_ARCHIVE_MANIFEST_URL) {
    return { title: copy.freeToPlay, subtitle: copy.freeToPlayHelp };
  }
  const type = catalog.type === 'series' ? copy.series : copy.movies;
  return { title: `${catalogKindLabel(catalog, copy)} ${type}` };
}

function exactIdDedupe(items: MediaItem[]): MediaItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function CatalogRowView({ row, state, onSelect }: { row: CatalogRow; state: FilmaState; onSelect(item: MediaItem): void }) {
  const listRef = useRef<FlatList<MediaItem>>(null);
  const layout = useResponsiveLayout();
  return (
    <View style={{ paddingTop: layout.isTv ? 30 : layout.isCompactPhone ? 20 : 25 }}>
      <View style={[styles.sectionHeader, { paddingHorizontal: layout.horizontalPadding }]}>
        <Text style={[styles.sectionTitle, { fontSize: layout.isTv ? 25 : layout.isCompactPhone ? 18 : 21 }]}>{row.title}</Text>
        {row.subtitle ? <Text numberOfLines={1} style={styles.sectionSubtitle}>{row.subtitle}</Text> : null}
      </View>
      <FlatList
        ref={listRef}
        horizontal
        data={row.items}
        keyExtractor={item => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingLeft: layout.horizontalPadding, paddingRight: layout.horizontalPadding }}
        initialNumToRender={layout.isTv ? 10 : layout.isTablet ? 7 : 5}
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

function SimpleMediaRow({ title, subtitle, items, state, onSelect }: {
  title: string;
  subtitle?: string;
  items: MediaItem[];
  state: FilmaState;
  onSelect(item: MediaItem): void;
}) {
  return <CatalogRowView row={{ key: title, title, subtitle, mediaType: 'movie', directlyPlayable: false, items }} state={state} onSelect={onSelect} />;
}

export function HomeProviderV3({ onSelect, onOpenYouTubeVideo, onOpenSettings }: Props) {
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
        const manifest = await getManifestCached(addon.manifestUrl);
        const catalogs = (manifest.catalogs ?? []).filter(catalog => catalog.type === 'movie' || catalog.type === 'series');
        const targets = catalogs.filter(catalogSupportsSearch).map(catalog => ({
          key: `${addon.id}:${catalog.type}:${catalog.id}`,
          manifestUrl: addon.manifestUrl,
          catalog,
        } satisfies SearchTarget));
        const selectedCatalogs = addon.manifestUrl === FILMA_ARCHIVE_MANIFEST_URL
          ? selectBrowseCatalogs(catalogs, state.preferences.preferredAudioLanguages, 1)
          : selectBrowseCatalogs(catalogs, state.preferences.preferredAudioLanguages, 3);

        const loadedRows = await Promise.all(selectedCatalogs.map(async catalog => {
          try {
            const items = await getCatalogCached(
              addon.manifestUrl,
              catalog.type,
              catalog.id,
              catalogExtrasForPreferences(catalog, state.preferences.preferredAudioLanguages),
            );
            if (!items.length) return null;
            const labels = rowLabels(addon.manifestUrl, catalog, copy);
            return {
              key: `${addon.id}:${catalog.type}:${catalog.id}`,
              title: labels.title,
              subtitle: labels.subtitle,
              mediaType: catalog.type === 'series' ? 'series' : 'movie',
              directlyPlayable: addon.manifestUrl === FILMA_ARCHIVE_MANIFEST_URL || hasStreamResource(manifest),
              items,
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

  const catalogItems = useMemo(() => dedupeMediaItems([...rtshItems, ...rows.flatMap(row => row.items)]), [rows, rtshItems]);
  const resumeItems = useMemo(() => Object.values(state.progress).flatMap(progress => progress.item ? [progress.item as MediaItem] : []), [state.progress]);
  const visibleItems = useMemo(() => exactIdDedupe([...resumeItems, ...catalogItems]).filter(item => matchesMode(item, mode)), [catalogItems, mode, resumeItems]);
  const visibleRows = useMemo(() => rows.filter(row => mode === 'all' || row.mediaType === mode), [mode, rows]);
  const playableItems = useMemo(() => visibleRows.filter(row => row.directlyPlayable).flatMap(row => row.items), [visibleRows]);

  const continueWatching = useMemo(() => visibleItems
    .filter(item => shouldShowInContinueWatching(state.progress[item.id]))
    .sort((a, b) => new Date(state.progress[b.id].updatedAt).getTime() - new Date(state.progress[a.id].updatedAt).getTime()),
  [state.progress, visibleItems]);

  const favorites = useMemo(() => visibleItems.filter(item => {
    const favorite = state.favorites[item.id];
    return Boolean(favorite && !favorite.deletedAt);
  }), [state.favorites, visibleItems]);

  const hero = continueWatching[0] ?? favorites[0] ?? playableItems[0] ?? visibleItems[0] ?? null;
  const heroProgress = hero ? state.progress[hero.id] : undefined;
  const heroRatio = heroProgress?.durationSeconds ? Math.min(1, Math.max(0, heroProgress.positionSeconds / heroProgress.durationSeconds)) : 0;

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
          return await getCatalogCached(target.manifestUrl, target.catalog.type, target.catalog.id, {
            ...catalogExtrasForPreferences(target.catalog, state.preferences.preferredAudioLanguages),
            search: needle,
          });
        } catch {
          return [] as MediaItem[];
        }
      })).then(results => {
        if (cancelled) return;
        setRemoteResults(dedupeMediaItems(results.flat()).filter(item => matchesMode(item, mode)).slice(0, 100));
        setSearching(false);
      });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mode, query, searchTargets, state.preferences.preferredAudioLanguages]);

  const searchResults = useMemo(() => dedupeMediaItems([...remoteResults, ...localResults]), [localResults, remoteResults]);
  const audioSummary = state.preferences.preferredAudioLanguages.length
    ? state.preferences.preferredAudioLanguages.map(language => audioLanguageLabel(language, state.preferences.appLanguage)).join(' · ')
    : text.anyLanguage;

  const refresh = () => {
    clearMediaDiscoveryCache();
    setReload(value => value + 1);
  };

  const heroHeight = layout.isTv ? 455 : layout.isTablet ? 385 : layout.isCompactPhone ? 300 : 335;
  const heroHorizontalMargin = layout.isTv || layout.isTablet ? layout.horizontalPadding : 0;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: layout.isTv ? 70 : 104 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={[styles.top, { paddingHorizontal: layout.horizontalPadding, paddingTop: layout.isTv ? 26 : 10 }]}>
        <View style={styles.headingRow}>
          <Text style={[styles.heading, { fontSize: layout.isTv ? 35 : layout.isCompactPhone ? 24 : 28 }]}>{copy.heading}</Text>
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
          <View style={styles.audioChip}>
            <Text style={styles.audioLabel}>{copy.audio}</Text>
            <Text numberOfLines={1} style={styles.audioValue}>{audioSummary}</Text>
          </View>
        </View>
      </View>

      {!query.trim() && hero ? (
        <ImageBackground
          source={hero.backdrop ? { uri: hero.backdrop } : hero.poster ? { uri: hero.poster } : undefined}
          style={[
            styles.hero,
            {
              minHeight: heroHeight,
              marginHorizontal: heroHorizontalMargin,
              borderRadius: layout.isTv || layout.isTablet ? 22 : 0,
            },
          ]}
          imageStyle={{ borderRadius: layout.isTv || layout.isTablet ? 22 : 0 }}
        >
          <View style={styles.heroShade} />
          <View style={[styles.heroBody, { padding: layout.isTv ? 36 : layout.isCompactPhone ? 20 : 25 }]}>
            <Text numberOfLines={2} style={[styles.heroTitle, { fontSize: layout.isTv ? 45 : layout.isCompactPhone ? 29 : 34, lineHeight: layout.isTv ? 50 : layout.isCompactPhone ? 33 : 39 }]}>{hero.title}</Text>
            <Text numberOfLines={1} style={styles.heroMeta}>{[hero.year, hero.genres?.slice(0, 2).join(' · ')].filter(Boolean).join('   •   ')}</Text>
            {heroRatio > 0 ? (
              <View style={styles.heroProgressWrap}>
                <View style={styles.heroProgressTrack}><View style={[styles.heroProgressFill, { width: `${Math.round(heroRatio * 100)}%` }]} /></View>
                <Text style={styles.heroProgressText}>{Math.round(heroRatio * 100)}% {copy.watched}</Text>
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
          <SimpleMediaRow title={`${text.searchResults} · ${searchResults.length}`} subtitle={copy.updatedByFilma} items={searchResults} state={state} onSelect={onSelect} />
        ) : !searching ? (
          <View style={[styles.notice, { marginHorizontal: layout.horizontalPadding }]}><Text style={styles.noticeTitle}>{copy.noResults}</Text></View>
        ) : null
      ) : (
        <>
          {continueWatching.length ? <SimpleMediaRow title={text.continueWatching} items={continueWatching} state={state} onSelect={onSelect} /> : null}
          {favorites.length ? <SimpleMediaRow title={text.favorites} items={favorites} state={state} onSelect={onSelect} /> : null}
          {visibleRows.map(row => <CatalogRowView key={row.key} row={row} state={state} onSelect={onSelect} />)}
          {mode !== 'series' && rtshItems.length ? (
            <SimpleMediaRow
              title={state.preferences.appLanguage === 'fr' ? 'Films albanais' : state.preferences.appLanguage === 'sq' ? 'Filma shqiptarë' : 'Albanian Movies'}
              subtitle="RTSH Arkiv"
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
            <FocusButton compact active label={copy.retry} onPress={refresh} />
            <FocusButton compact label={copy.configure} onPress={onOpenSettings} />
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05070b' },
  top: { paddingBottom: 14 },
  headingRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  heading: { color: '#fafbfc', fontWeight: '900', letterSpacing: -0.9 },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  searchRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchRowWide: { alignItems: 'stretch' },
  searchBox: { flex: 1, minHeight: Platform.isTV ? 52 : 44, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, borderRadius: 15, backgroundColor: '#11141a' },
  searchIcon: { color: '#929aab', fontSize: 21, fontWeight: '800' },
  searchInput: { flex: 1, color: '#f6f7f9', fontSize: Platform.isTV ? 17 : 14, paddingVertical: 0 },
  audioChip: { maxWidth: Platform.isTV ? 330 : 132, minHeight: Platform.isTV ? 52 : 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 15, backgroundColor: '#11141a' },
  audioLabel: { color: '#707989', fontSize: 8, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  audioValue: { color: '#dfe3e9', marginTop: 1, fontSize: 10, fontWeight: '800' },
  hero: { overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: '#10131a' },
  heroShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(2,4,8,0.52)' },
  heroBody: { maxWidth: Platform.isTV ? 760 : 620, justifyContent: 'flex-end' },
  heroTitle: { color: '#fff', fontWeight: '900', letterSpacing: -1.1 },
  heroMeta: { color: '#d1d6df', marginTop: 7, fontSize: Platform.isTV ? 14 : 11, fontWeight: '700' },
  heroActions: { flexDirection: 'row', marginTop: 16 },
  heroProgressWrap: { width: '75%', maxWidth: 370, marginTop: 13 },
  heroProgressTrack: { height: 4, overflow: 'hidden', borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.27)' },
  heroProgressFill: { height: '100%', borderRadius: 99, backgroundColor: theme.accent },
  heroProgressText: { color: '#ced5e2', marginTop: 4, fontSize: 9, fontWeight: '800' },
  sectionHeader: { paddingBottom: 10 },
  sectionTitle: { color: '#f5f6f8', fontWeight: '900', letterSpacing: -0.45 },
  sectionSubtitle: { color: '#777f8e', fontSize: 10, marginTop: 2, fontWeight: '600' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingTop: 22 },
  loadingText: { color: '#8791a4', fontWeight: '700', fontSize: 12 },
  notice: { marginTop: 20, borderRadius: 16, backgroundColor: '#11141a', padding: 14, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  noticeTextBlock: { flex: 1, minWidth: 190 },
  noticeTitle: { color: '#eff2f7', fontSize: 14, fontWeight: '900' },
  noticeText: { color: '#8993a5', marginTop: 4, fontSize: 11, lineHeight: 16 },
  noticeActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
