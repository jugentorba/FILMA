import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, ImageBackground, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { audioLanguageLabel, stringsFor } from '../i18n';
import { shouldShowInContinueWatching } from '../services/progress';
import {
  catalogCanLoadWithoutSearch,
  catalogLanguageExtra,
  catalogSupportsSearch,
  fetchCatalog,
  fetchManifest,
  type StremioCatalog,
} from '../services/stremio';
import { fetchRtshArchiveMovies, type YouTubeVideo, youtubeConfigured } from '../services/youtube';
import { useFilma } from '../store/FilmaContext';
import type { FilmaState, MediaItem } from '../types';
import { FocusButton } from '../ui/FocusButton';
import { MediaCard } from '../ui/MediaCard';
import { theme } from '../ui/theme';

type Props = {
  onSelect(item: MediaItem): void;
  onOpenYouTubeVideo(video: YouTubeVideo): void;
  onOpenSettings(): void;
};

type BrowseMode = 'all' | 'movie' | 'series';

type CatalogRow = {
  key: string;
  title: string;
  mediaType: 'movie' | 'series';
  items: MediaItem[];
};

type SearchTarget = {
  key: string;
  manifestUrl: string;
  catalog: StremioCatalog;
};

type MediaRowProps = {
  title: string;
  data: MediaItem[];
  state: FilmaState;
  onSelect(item: MediaItem): void;
};

const MAX_CATALOG_ROWS = 14;
const CATALOGS_PER_TYPE = 3;

function dedupe(items: MediaItem[]): MediaItem[] {
  const unique = new Map<string, MediaItem>();
  for (const item of items) {
    if (!unique.has(item.id)) unique.set(item.id, item);
  }
  return [...unique.values()];
}

function itemMediaType(item: MediaItem): 'movie' | 'series' | undefined {
  if (item.source?.kind === 'stremio') {
    return item.source.mediaType === 'series' ? 'series' : 'movie';
  }
  if (item.source?.kind === 'youtube') return 'movie';
  return undefined;
}

function matchesBrowseMode(item: MediaItem, mode: BrowseMode): boolean {
  if (mode === 'all') return true;
  return itemMediaType(item) === mode;
}

function pickBrowseCatalogs(catalogs: StremioCatalog[], preferredAudioLanguages: FilmaState['preferences']['preferredAudioLanguages']): StremioCatalog[] {
  const loadable = catalogs.filter(catalog => catalogCanLoadWithoutSearch(catalog, preferredAudioLanguages));
  const movies = loadable.filter(catalog => catalog.type === 'movie').slice(0, CATALOGS_PER_TYPE);
  const series = loadable.filter(catalog => catalog.type === 'series').slice(0, CATALOGS_PER_TYPE);
  const chosen = [...movies, ...series];
  const chosenKeys = new Set(chosen.map(catalog => `${catalog.type}:${catalog.id}`));

  for (const catalog of loadable) {
    if (chosen.length >= CATALOGS_PER_TYPE * 2) break;
    const key = `${catalog.type}:${catalog.id}`;
    if (!chosenKeys.has(key)) {
      chosen.push(catalog);
      chosenKeys.add(key);
    }
  }

  return chosen;
}

function MediaRow({ title, data, state, onSelect }: MediaRowProps) {
  const listRef = useRef<FlatList<MediaItem>>(null);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionCountBadge}>
          <Text style={styles.sectionCount}>{data.length}</Text>
        </View>
      </View>
      <FlatList
        ref={listRef}
        horizontal
        data={data}
        keyExtractor={item => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowContent}
        initialNumToRender={Platform.isTV ? 10 : 6}
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
                if (Platform.isTV) listRef.current?.scrollToIndex({ index, viewPosition: 0.34, animated: true });
              }}
              onPress={() => onSelect(item)}
            />
          );
        }}
      />
    </View>
  );
}

export function HomeScreen({ onSelect, onOpenYouTubeVideo, onOpenSettings }: Props) {
  const { state } = useFilma();
  const text = stringsFor(state.preferences.appLanguage);
  const [addonRows, setAddonRows] = useState<CatalogRow[]>([]);
  const [searchTargets, setSearchTargets] = useState<SearchTarget[]>([]);
  const [loadingAddons, setLoadingAddons] = useState(false);
  const [addonError, setAddonError] = useState<string>();
  const [reloadVersion, setReloadVersion] = useState(0);
  const [query, setQuery] = useState('');
  const [browseMode, setBrowseMode] = useState<BrowseMode>('all');
  const [remoteResults, setRemoteResults] = useState<MediaItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string>();
  const [albanianArchiveVideos, setAlbanianArchiveVideos] = useState<YouTubeVideo[]>([]);

  const browseCopy = useMemo(() => {
    if (state.preferences.appLanguage === 'fr') {
      return { all: 'Tout', movies: 'Films', series: 'Séries', explore: 'Explorer', progress: 'regardé' };
    }
    if (state.preferences.appLanguage === 'sq') {
      return { all: 'Të gjitha', movies: 'Filma', series: 'Seriale', explore: 'Shfleto', progress: 'parë' };
    }
    return { all: 'All', movies: 'Movies', series: 'Series', explore: 'Explore', progress: 'watched' };
  }, [state.preferences.appLanguage]);

  const configuredAddons = useMemo(
    () => state.addons.filter(item => !item.deletedAt),
    [state.addons],
  );
  const activeAddons = useMemo(
    () => configuredAddons.filter(item => item.enabled),
    [configuredAddons],
  );
  const allSourcesDisabled = configuredAddons.length > 0 && activeAddons.length === 0;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!activeAddons.length) {
        setAddonRows([]);
        setSearchTargets([]);
        setAddonError(undefined);
        setLoadingAddons(false);
        return;
      }

      setLoadingAddons(true);
      setAddonError(undefined);

      const providerResults = await Promise.all(activeAddons.map(async addon => {
        try {
          const manifest = await fetchManifest(addon.manifestUrl);
          const catalogs = (manifest.catalogs ?? []).filter(catalog => catalog.type === 'movie' || catalog.type === 'series');
          const targets = catalogs
            .filter(catalogSupportsSearch)
            .map(catalog => ({
              key: `${addon.id}:${catalog.type}:${catalog.id}`,
              manifestUrl: addon.manifestUrl,
              catalog,
            } satisfies SearchTarget));

          const browseCatalogs = pickBrowseCatalogs(catalogs, state.preferences.preferredAudioLanguages);
          const rows = await Promise.all(browseCatalogs.map(async catalog => {
            try {
              const items = await fetchCatalog(
                addon.manifestUrl,
                catalog.type,
                catalog.id,
                catalogLanguageExtra(catalog, state.preferences.preferredAudioLanguages),
              );
              if (!items.length) return null;
              const typeLabel = catalog.type === 'series' ? browseCopy.series : browseCopy.movies;
              return {
                key: `${addon.id}:${catalog.type}:${catalog.id}`,
                title: `${catalog.name || manifest.name} · ${typeLabel}`,
                mediaType: catalog.type as 'movie' | 'series',
                items: dedupe(items),
              } satisfies CatalogRow;
            } catch {
              return null;
            }
          }));

          return {
            rows: rows.filter((row): row is CatalogRow => row !== null),
            targets,
          };
        } catch {
          return { rows: [] as CatalogRow[], targets: [] as SearchTarget[] };
        }
      }));

      if (!cancelled) {
        const rows = providerResults.flatMap(result => result.rows).slice(0, MAX_CATALOG_ROWS);
        const targets = providerResults.flatMap(result => result.targets);
        setAddonRows(rows);
        setSearchTargets(targets);
        if (!rows.length) setAddonError(text.sourceLoadError);
        setLoadingAddons(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [activeAddons, browseCopy.movies, browseCopy.series, reloadVersion, state.preferences.preferredAudioLanguages, text.sourceLoadError]);

  useEffect(() => {
    if (!youtubeConfigured()) {
      setAlbanianArchiveVideos([]);
      return;
    }

    let cancelled = false;
    void fetchRtshArchiveMovies()
      .then(videos => {
        if (!cancelled) setAlbanianArchiveVideos(videos);
      })
      .catch(() => {
        if (!cancelled) setAlbanianArchiveVideos([]);
      });

    return () => { cancelled = true; };
  }, [reloadVersion]);

  const albanianArchiveItems = useMemo<MediaItem[]>(() =>
    albanianArchiveVideos.map(video => ({
      id: `youtube:${video.id}`,
      title: video.title,
      subtitle: 'RTSH Arkiv · Shqip',
      poster: video.thumbnail,
      backdrop: video.thumbnail,
      genres: ['Albanian', 'Archive'],
      source: {
        kind: 'youtube',
        videoId: video.id,
        channelTitle: video.channelTitle,
      },
    })),
  [albanianArchiveVideos]);

  const albanianArchiveByItemId = useMemo<Map<string, YouTubeVideo>>(() => new Map(
    albanianArchiveVideos.map(video => [`youtube:${video.id}`, video] as const),
  ), [albanianArchiveVideos]);

  const albanianArchiveTitle = state.preferences.appLanguage === 'fr'
    ? 'Films albanais · RTSH Arkiv'
    : state.preferences.appLanguage === 'sq'
      ? 'Filma shqiptarë · RTSH Arkiv'
      : 'Albanian Movies · RTSH Arkiv';

  const allLoadedItems = useMemo(() => {
    const resumeItems: MediaItem[] = Object.values(state.progress).flatMap(progress => progress.item ? [progress.item] : []);
    return dedupe([...resumeItems, ...albanianArchiveItems, ...addonRows.flatMap(row => row.items)]);
  }, [addonRows, albanianArchiveItems, state.progress]);

  const filteredLoadedItems = useMemo(
    () => allLoadedItems.filter(item => matchesBrowseMode(item, browseMode)),
    [allLoadedItems, browseMode],
  );

  const filteredAddonRows = useMemo(
    () => addonRows.filter(row => browseMode === 'all' || row.mediaType === browseMode),
    [addonRows, browseMode],
  );

  const continueWatching = useMemo(
    () => filteredLoadedItems
      .filter(item => shouldShowInContinueWatching(state.progress[item.id]))
      .sort((a, b) => new Date(state.progress[b.id].updatedAt).getTime() - new Date(state.progress[a.id].updatedAt).getTime()),
    [filteredLoadedItems, state.progress],
  );

  const favorites = useMemo(
    () => filteredLoadedItems.filter(item => {
      const favorite = state.favorites[item.id];
      return Boolean(favorite && !favorite.deletedAt);
    }),
    [filteredLoadedItems, state.favorites],
  );

  const localSearchResults = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return [];
    return filteredLoadedItems.filter(item => {
      const haystack = [item.title, item.subtitle, ...(item.genres ?? [])].filter(Boolean).join(' ').toLocaleLowerCase();
      return haystack.includes(needle);
    });
  }, [filteredLoadedItems, query]);

  useEffect(() => {
    const needle = query.trim();
    const eligibleTargets = searchTargets.filter(target => browseMode === 'all' || target.catalog.type === browseMode);
    if (needle.length < 2 || !eligibleTargets.length) {
      setRemoteResults([]);
      setSearching(false);
      setSearchError(undefined);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      setSearchError(undefined);
      void Promise.all(eligibleTargets.map(async target => {
        try {
          return await fetchCatalog(
            target.manifestUrl,
            target.catalog.type,
            target.catalog.id,
            {
              ...catalogLanguageExtra(target.catalog, state.preferences.preferredAudioLanguages),
              search: needle,
            },
          );
        } catch {
          return [] as MediaItem[];
        }
      })).then(results => {
        if (cancelled) return;
        const merged = dedupe(results.flat())
          .filter(item => matchesBrowseMode(item, browseMode))
          .slice(0, 80);
        setRemoteResults(merged);
        if (!merged.length && !localSearchResults.length) setSearchError(text.searchSourceError);
        setSearching(false);
      });
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [browseMode, localSearchResults.length, query, searchTargets, state.preferences.preferredAudioLanguages, text.searchSourceError]);

  const searchResults = useMemo(() => dedupe([...remoteResults, ...localSearchResults]), [remoteResults, localSearchResults]);
  const hero = continueWatching[0] ?? filteredAddonRows[0]?.items[0] ?? favorites[0] ?? null;
  const heroProgress = hero ? state.progress[hero.id] : undefined;
  const heroCanContinue = hero ? shouldShowInContinueWatching(heroProgress) : false;
  const heroProgressRatio = heroProgress?.durationSeconds
    ? Math.min(1, Math.max(0, heroProgress.positionSeconds / heroProgress.durationSeconds))
    : 0;
  const heroType = hero ? itemMediaType(hero) : undefined;
  const heroTypeLabel = heroType === 'series' ? browseCopy.series : heroType === 'movie' ? browseCopy.movies : 'FILMA';
  const audioSummary = state.preferences.preferredAudioLanguages.length
    ? state.preferences.preferredAudioLanguages.map(language => audioLanguageLabel(language, state.preferences.appLanguage)).join(' · ')
    : text.anyLanguage;

  const emptyTitle = loadingAddons
    ? text.loadingCatalogs
    : allSourcesDisabled
      ? text.sourcesDisabledTitle
      : activeAddons.length
        ? text.sourceNeeded
        : text.homeEmptyTitle;
  const emptyText = loadingAddons
    ? text.loadingCatalogsHelp
    : allSourcesDisabled
      ? text.sourcesDisabledText
      : activeAddons.length
        ? (addonError ?? text.sourceLoadError)
        : text.homeEmptyText;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {hero ? (
        <ImageBackground source={hero.backdrop ? { uri: hero.backdrop } : undefined} style={styles.hero} imageStyle={styles.heroImage}>
          <View style={styles.heroShade} />
          <View style={styles.heroContent}>
            <View style={styles.heroBadgeRow}>
              <View style={styles.heroTypeBadge}><Text style={styles.heroTypeText}>{heroTypeLabel.toUpperCase()}</Text></View>
              <Text style={styles.eyebrow}>{text.homeEyebrow}</Text>
            </View>
            <Text numberOfLines={2} style={styles.heroTitle}>{hero.title}</Text>
            <Text numberOfLines={2} style={styles.heroMeta}>
              {[hero.year, hero.genres?.slice(0, 3).join('  •  ')].filter(Boolean).join('   ') || hero.subtitle || 'FILMA'}
            </Text>
            {heroProgressRatio > 0 ? (
              <View style={styles.heroProgressBlock}>
                <View style={styles.heroProgressTrack}>
                  <View style={[styles.heroProgressFill, { width: `${Math.round(heroProgressRatio * 100)}%` }]} />
                </View>
                <Text style={styles.heroProgressText}>{Math.round(heroProgressRatio * 100)}% {browseCopy.progress}</Text>
              </View>
            ) : null}
            <View style={styles.heroActions}>
              <FocusButton
                label={`▶ ${heroCanContinue ? text.continue : text.play}`}
                active
                preferredFocus
                onPress={() => onSelect(hero)}
              />
            </View>
          </View>
        </ImageBackground>
      ) : (
        <View style={styles.emptyHero}>
          <Text style={styles.eyebrow}>{text.homeEyebrow}</Text>
          {loadingAddons ? <ActivityIndicator style={styles.emptySpinner} /> : null}
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptyText}>{emptyText}</Text>
          {!loadingAddons ? (
            <View style={styles.heroActions}>
              {activeAddons.length ? (
                <>
                  <FocusButton label={text.retry} active preferredFocus onPress={() => setReloadVersion(value => value + 1)} />
                  <FocusButton label={text.settings} onPress={onOpenSettings} />
                </>
              ) : (
                <FocusButton
                  label={allSourcesDisabled ? text.settings : text.addMovieSource}
                  active
                  preferredFocus
                  onPress={onOpenSettings}
                />
              )}
            </View>
          ) : null}
        </View>
      )}

      <View style={styles.exploreArea}>
        <Text style={styles.exploreLabel}>{browseCopy.explore}</Text>
        <View style={styles.browseButtons}>
          <FocusButton compact label={browseCopy.all} active={browseMode === 'all'} onPress={() => setBrowseMode('all')} />
          <FocusButton compact label={browseCopy.movies} active={browseMode === 'movie'} onPress={() => setBrowseMode('movie')} />
          <FocusButton compact label={browseCopy.series} active={browseMode === 'series'} onPress={() => setBrowseMode('series')} />
        </View>
      </View>

      <View style={styles.searchArea}>
        <View style={styles.searchShell}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={text.searchPlaceholder}
            placeholderTextColor={theme.muted}
            style={styles.search}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {searching ? <ActivityIndicator size="small" /> : null}
        </View>
        <View style={styles.audioChip}>
          <Text style={styles.audioChipLabel}>{text.preferredAudio}</Text>
          <Text numberOfLines={1} style={styles.audioChipValue}>{audioSummary}</Text>
        </View>
      </View>

      {query.trim() ? (
        searchResults.length ? (
          <MediaRow title={`${text.searchResults} · ${searchResults.length}`} data={searchResults} state={state} onSelect={onSelect} />
        ) : !searching ? (
          <View style={styles.messageBox}>
            <Text style={styles.messageTitle}>{text.noSearchResults}</Text>
            {searchError ? <Text style={styles.messageText}>{searchError}</Text> : null}
          </View>
        ) : null
      ) : (
        <>
          {continueWatching.length ? <MediaRow title={text.continueWatching} data={continueWatching} state={state} onSelect={onSelect} /> : null}
          {favorites.length ? <MediaRow title={text.favorites} data={favorites} state={state} onSelect={onSelect} /> : null}
          {browseMode !== 'series' && albanianArchiveItems.length ? (
            <MediaRow
              title={albanianArchiveTitle}
              data={albanianArchiveItems}
              state={state}
              onSelect={item => {
                const video = albanianArchiveByItemId.get(item.id);
                if (video) onOpenYouTubeVideo(video);
              }}
            />
          ) : null}
          {filteredAddonRows.map(catalog => <MediaRow key={catalog.key} title={catalog.title} data={catalog.items} state={state} onSelect={onSelect} />)}
        </>
      )}

      {loadingAddons && hero ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>{text.loadingCatalogs}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  content: { paddingBottom: Platform.isTV ? 90 : 118 },
  hero: {
    minHeight: Platform.isTV ? 530 : 410,
    justifyContent: 'flex-end',
    backgroundColor: '#10131d',
  },
  heroImage: { opacity: 0.8 },
  heroShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Platform.isTV ? 'rgba(7,9,15,0.45)' : 'rgba(7,9,15,0.58)',
  },
  heroContent: {
    paddingHorizontal: Platform.isTV ? 64 : 20,
    paddingBottom: Platform.isTV ? 58 : 36,
    paddingTop: Platform.isTV ? 130 : 90,
    maxWidth: Platform.isTV ? 940 : undefined,
  },
  heroBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroTypeBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: 'rgba(5,8,14,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  heroTypeText: { color: '#f6f8fb', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  emptyHero: {
    minHeight: Platform.isTV ? 430 : 340,
    paddingHorizontal: Platform.isTV ? 64 : 22,
    paddingVertical: Platform.isTV ? 70 : 46,
    justifyContent: 'center',
    backgroundColor: '#0c101a',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  emptySpinner: { alignSelf: 'flex-start', marginTop: 22 },
  eyebrow: { color: theme.accent, fontWeight: '900', letterSpacing: 2.4, fontSize: 12 },
  heroTitle: {
    color: theme.text,
    fontSize: Platform.isTV ? 60 : 40,
    lineHeight: Platform.isTV ? 66 : 46,
    fontWeight: '900',
    marginTop: 13,
    maxWidth: 820,
    letterSpacing: -1.2,
  },
  heroMeta: { color: '#d8deea', marginTop: 12, fontSize: Platform.isTV ? 18 : 14, fontWeight: '700' },
  heroProgressBlock: { width: Platform.isTV ? 420 : '82%', maxWidth: 420, marginTop: 18 },
  heroProgressTrack: { height: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.28)', overflow: 'hidden' },
  heroProgressFill: { height: '100%', borderRadius: 999, backgroundColor: theme.accent },
  heroProgressText: { color: '#d6dce7', fontSize: 11, fontWeight: '800', marginTop: 6 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 24 },
  emptyTitle: { color: theme.text, fontSize: Platform.isTV ? 48 : 34, lineHeight: Platform.isTV ? 54 : 40, fontWeight: '900', marginTop: 12 },
  emptyText: { color: theme.muted, maxWidth: 720, fontSize: Platform.isTV ? 19 : 16, lineHeight: Platform.isTV ? 28 : 24, marginTop: 12 },
  exploreArea: {
    paddingHorizontal: Platform.isTV ? 64 : 20,
    paddingTop: Platform.isTV ? 28 : 22,
  },
  exploreLabel: { color: theme.text, fontSize: Platform.isTV ? 22 : 18, fontWeight: '900', marginBottom: 10 },
  browseButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  searchArea: {
    paddingHorizontal: Platform.isTV ? 64 : 20,
    paddingTop: 16,
    flexDirection: Platform.isTV ? 'row' : 'column',
    gap: 12,
    alignItems: Platform.isTV ? 'center' : 'stretch',
  },
  searchShell: {
    flex: 1,
    minHeight: Platform.isTV ? 62 : 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#323b50',
    backgroundColor: '#121724',
  },
  searchIcon: { color: theme.muted, fontSize: 24, fontWeight: '700' },
  search: { flex: 1, color: theme.text, fontSize: Platform.isTV ? 19 : 16, paddingVertical: 0 },
  audioChip: {
    minHeight: 54,
    maxWidth: Platform.isTV ? 360 : undefined,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  audioChipLabel: { color: theme.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.1 },
  audioChipValue: { color: theme.text, marginTop: 3, fontWeight: '800' },
  section: { paddingTop: Platform.isTV ? 34 : 28 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Platform.isTV ? 64 : 20, marginBottom: 14 },
  sectionTitle: { color: theme.text, fontSize: Platform.isTV ? 27 : 22, fontWeight: '900', letterSpacing: -0.3 },
  sectionCountBadge: { minWidth: 28, height: 24, borderRadius: 12, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceRaised },
  sectionCount: { color: theme.muted, fontSize: 12, fontWeight: '900' },
  rowContent: { paddingLeft: Platform.isTV ? 64 : 20, paddingRight: Platform.isTV ? 40 : 8 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Platform.isTV ? 64 : 20, paddingTop: 30 },
  loadingText: { color: theme.muted, fontWeight: '700' },
  messageBox: {
    marginHorizontal: Platform.isTV ? 64 : 20,
    marginTop: 28,
    padding: Platform.isTV ? 24 : 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  messageTitle: { color: theme.text, fontSize: 18, fontWeight: '900' },
  messageText: { color: theme.muted, marginTop: 7, lineHeight: 21 },
});