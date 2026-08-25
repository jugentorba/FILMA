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
  const layout = useResponsiveLayout();

  const sectionStyle = useMemo(() => ({
    paddingTop: layout.isTv ? 28 : layout.isCompactPhone ? 17 : layout.isTablet ? 24 : 21,
  }), [layout.isCompactPhone, layout.isTablet, layout.isTv]);
  const headingStyle = useMemo(() => ({
    paddingHorizontal: layout.horizontalPadding,
    marginBottom: layout.isCompactPhone ? 8 : 11,
  }), [layout.horizontalPadding, layout.isCompactPhone]);
  const titleStyle = useMemo(() => ({
    fontSize: layout.isTv ? 24 : layout.isCompactPhone ? 17 : layout.isTablet ? 21 : 19,
  }), [layout.isCompactPhone, layout.isTablet, layout.isTv]);
  const countStyle = useMemo(() => ({
    minWidth: layout.isCompactPhone ? 23 : 27,
    height: layout.isCompactPhone ? 20 : 23,
    borderRadius: layout.isCompactPhone ? 10 : 12,
  }), [layout.isCompactPhone]);
  const rowStyle = useMemo(() => ({
    paddingLeft: layout.horizontalPadding,
    paddingRight: layout.isTv ? Math.max(24, layout.horizontalPadding / 2) : Math.max(6, layout.horizontalPadding / 2),
  }), [layout.horizontalPadding, layout.isTv]);

  return (
    <View style={[styles.section, sectionStyle]}>
      <View style={[styles.sectionHeading, headingStyle]}>
        <Text style={[styles.sectionTitle, titleStyle]}>{title}</Text>
        <View style={[styles.sectionCountBadge, countStyle]}>
          <Text style={[styles.sectionCount, layout.isCompactPhone && styles.sectionCountCompact]}>{data.length}</Text>
        </View>
      </View>
      <FlatList
        ref={listRef}
        horizontal
        data={data}
        keyExtractor={item => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.rowContent, rowStyle]}
        initialNumToRender={layout.isTv ? 10 : layout.isTablet ? 8 : 6}
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
  const layout = useResponsiveLayout();
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

  const contentStyle = useMemo(() => ({
    paddingBottom: layout.isTv ? 76 : 100,
  }), [layout.isTv]);
  const heroStyle = useMemo(() => ({
    minHeight: layout.isTv ? 470 : layout.isCompactPhone ? 285 : layout.isTablet ? 390 : 335,
  }), [layout.isCompactPhone, layout.isTablet, layout.isTv]);
  const heroContentStyle = useMemo(() => ({
    paddingHorizontal: layout.horizontalPadding,
    paddingBottom: layout.isTv ? 44 : layout.isCompactPhone ? 24 : layout.isTablet ? 34 : 29,
    paddingTop: layout.isTv ? 105 : layout.isCompactPhone ? 62 : layout.isTablet ? 88 : 72,
    maxWidth: layout.isTv ? 860 : layout.isTablet ? 720 : undefined,
  }), [layout.horizontalPadding, layout.isCompactPhone, layout.isTablet, layout.isTv]);
  const heroTitleStyle = useMemo(() => ({
    fontSize: layout.isTv ? 52 : layout.isCompactPhone ? 28 : layout.isTablet ? 40 : 33,
    lineHeight: layout.isTv ? 58 : layout.isCompactPhone ? 33 : layout.isTablet ? 46 : 39,
    marginTop: layout.isCompactPhone ? 8 : 11,
  }), [layout.isCompactPhone, layout.isTablet, layout.isTv]);
  const heroMetaStyle = useMemo(() => ({
    marginTop: layout.isCompactPhone ? 7 : 10,
    fontSize: layout.isTv ? 16 : layout.isCompactPhone ? 11 : layout.isTablet ? 14 : 12,
  }), [layout.isCompactPhone, layout.isTablet, layout.isTv]);
  const emptyHeroStyle = useMemo(() => ({
    minHeight: layout.isTv ? 370 : layout.isCompactPhone ? 245 : layout.isTablet ? 330 : 285,
    paddingHorizontal: layout.horizontalPadding,
    paddingVertical: layout.isTv ? 54 : layout.isCompactPhone ? 30 : 40,
  }), [layout.horizontalPadding, layout.isCompactPhone, layout.isTablet, layout.isTv]);
  const emptyTitleStyle = useMemo(() => ({
    fontSize: layout.isTv ? 42 : layout.isCompactPhone ? 25 : layout.isTablet ? 34 : 29,
    lineHeight: layout.isTv ? 48 : layout.isCompactPhone ? 30 : layout.isTablet ? 40 : 35,
  }), [layout.isCompactPhone, layout.isTablet, layout.isTv]);
  const emptyTextStyle = useMemo(() => ({
    fontSize: layout.isTv ? 17 : layout.isCompactPhone ? 13 : layout.isTablet ? 15 : 14,
    lineHeight: layout.isTv ? 25 : layout.isCompactPhone ? 19 : 22,
  }), [layout.isCompactPhone, layout.isTablet, layout.isTv]);
  const exploreAreaStyle = useMemo(() => ({
    paddingHorizontal: layout.horizontalPadding,
    paddingTop: layout.isTv ? 22 : layout.isCompactPhone ? 15 : 19,
  }), [layout.horizontalPadding, layout.isCompactPhone, layout.isTv]);
  const exploreLabelStyle = useMemo(() => ({
    fontSize: layout.isTv ? 20 : layout.isCompactPhone ? 15 : layout.isTablet ? 18 : 17,
    marginBottom: layout.isCompactPhone ? 7 : 9,
  }), [layout.isCompactPhone, layout.isTablet, layout.isTv]);
  const searchAreaStyle = useMemo(() => ({
    paddingHorizontal: layout.horizontalPadding,
    paddingTop: layout.isCompactPhone ? 10 : 13,
    flexDirection: (layout.isTv || layout.isTablet ? 'row' : 'column') as 'row' | 'column',
    gap: layout.isCompactPhone ? 8 : 10,
    alignItems: (layout.isTv || layout.isTablet ? 'center' : 'stretch') as 'center' | 'stretch',
  }), [layout.horizontalPadding, layout.isCompactPhone, layout.isTablet, layout.isTv]);
  const searchShellStyle = useMemo(() => ({
    minHeight: layout.isTv ? 52 : layout.isCompactPhone ? 40 : layout.isTablet ? 48 : 44,
    gap: layout.isCompactPhone ? 7 : 9,
    paddingHorizontal: layout.isCompactPhone ? 11 : 14,
    borderRadius: layout.isCompactPhone ? 12 : 15,
  }), [layout.isCompactPhone, layout.isTablet, layout.isTv]);
  const searchIconStyle = useMemo(() => ({
    fontSize: layout.isTv ? 22 : layout.isCompactPhone ? 18 : 20,
  }), [layout.isCompactPhone, layout.isTv]);
  const searchTextStyle = useMemo(() => ({
    fontSize: layout.isTv ? 17 : layout.isCompactPhone ? 13 : layout.isTablet ? 15 : 14,
  }), [layout.isCompactPhone, layout.isTablet, layout.isTv]);
  const audioChipStyle = useMemo(() => ({
    minHeight: layout.isTv ? 50 : layout.isCompactPhone ? 40 : layout.isTablet ? 48 : 44,
    maxWidth: layout.isTv ? 330 : layout.isTablet ? 300 : undefined,
    borderRadius: layout.isCompactPhone ? 12 : 15,
    paddingHorizontal: layout.isCompactPhone ? 11 : 14,
  }), [layout.isCompactPhone, layout.isTablet, layout.isTv]);
  const messageBoxStyle = useMemo(() => ({
    marginHorizontal: layout.horizontalPadding,
    marginTop: layout.isCompactPhone ? 18 : 24,
    padding: layout.isTv ? 20 : layout.isCompactPhone ? 13 : 16,
  }), [layout.horizontalPadding, layout.isCompactPhone, layout.isTv]);
  const loadingRowStyle = useMemo(() => ({
    paddingHorizontal: layout.horizontalPadding,
    paddingTop: layout.isCompactPhone ? 20 : 26,
  }), [layout.horizontalPadding, layout.isCompactPhone]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, contentStyle]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {hero ? (
        <ImageBackground source={hero.backdrop ? { uri: hero.backdrop } : undefined} style={[styles.hero, heroStyle]} imageStyle={styles.heroImage}>
          <View style={styles.heroShade} />
          <View style={[styles.heroContent, heroContentStyle]}>
            <View style={styles.heroBadgeRow}>
              <View style={[styles.heroTypeBadge, layout.isCompactPhone && styles.heroTypeBadgeCompact]}><Text style={[styles.heroTypeText, layout.isCompactPhone && styles.heroTypeTextCompact]}>{heroTypeLabel.toUpperCase()}</Text></View>
              <Text style={[styles.eyebrow, layout.isCompactPhone && styles.eyebrowCompact]}>{text.homeEyebrow}</Text>
            </View>
            <Text numberOfLines={2} style={[styles.heroTitle, heroTitleStyle]}>{hero.title}</Text>
            <Text numberOfLines={2} style={[styles.heroMeta, heroMetaStyle]}>
              {[hero.year, hero.genres?.slice(0, 3).join('  •  ')].filter(Boolean).join('   ') || hero.subtitle || 'FILMA'}
            </Text>
            {heroProgressRatio > 0 ? (
              <View style={[styles.heroProgressBlock, layout.isCompactPhone && styles.heroProgressBlockCompact]}>
                <View style={styles.heroProgressTrack}>
                  <View style={[styles.heroProgressFill, { width: `${Math.round(heroProgressRatio * 100)}%` }]} />
                </View>
                <Text style={styles.heroProgressText}>{Math.round(heroProgressRatio * 100)}% {browseCopy.progress}</Text>
              </View>
            ) : null}
            <View style={[styles.heroActions, layout.isCompactPhone && styles.heroActionsCompact]}>
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
        <View style={[styles.emptyHero, emptyHeroStyle]}>
          <Text style={[styles.eyebrow, layout.isCompactPhone && styles.eyebrowCompact]}>{text.homeEyebrow}</Text>
          {loadingAddons ? <ActivityIndicator style={styles.emptySpinner} /> : null}
          <Text style={[styles.emptyTitle, emptyTitleStyle]}>{emptyTitle}</Text>
          <Text style={[styles.emptyText, emptyTextStyle]}>{emptyText}</Text>
          {!loadingAddons ? (
            <View style={[styles.heroActions, layout.isCompactPhone && styles.heroActionsCompact]}>
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

      <View style={[styles.exploreArea, exploreAreaStyle]}>
        <Text style={[styles.exploreLabel, exploreLabelStyle]}>{browseCopy.explore}</Text>
        <View style={[styles.browseButtons, layout.isCompactPhone && styles.browseButtonsCompact]}>
          <FocusButton compact label={browseCopy.all} active={browseMode === 'all'} onPress={() => setBrowseMode('all')} />
          <FocusButton compact label={browseCopy.movies} active={browseMode === 'movie'} onPress={() => setBrowseMode('movie')} />
          <FocusButton compact label={browseCopy.series} active={browseMode === 'series'} onPress={() => setBrowseMode('series')} />
        </View>
      </View>

      <View style={[styles.searchArea, searchAreaStyle]}>
        <View style={[styles.searchShell, searchShellStyle]}>
          <Text style={[styles.searchIcon, searchIconStyle]}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={text.searchPlaceholder}
            placeholderTextColor={theme.muted}
            style={[styles.search, searchTextStyle]}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {searching ? <ActivityIndicator size="small" /> : null}
        </View>
        <View style={[styles.audioChip, audioChipStyle]}>
          <Text style={[styles.audioChipLabel, layout.isCompactPhone && styles.audioChipLabelCompact]}>{text.preferredAudio}</Text>
          <Text numberOfLines={1} style={[styles.audioChipValue, layout.isCompactPhone && styles.audioChipValueCompact]}>{audioSummary}</Text>
        </View>
      </View>

      {query.trim() ? (
        searchResults.length ? (
          <MediaRow title={`${text.searchResults} · ${searchResults.length}`} data={searchResults} state={state} onSelect={onSelect} />
        ) : !searching ? (
          <View style={[styles.messageBox, messageBoxStyle]}>
            <Text style={[styles.messageTitle, layout.isCompactPhone && styles.messageTitleCompact]}>{text.noSearchResults}</Text>
            {searchError ? <Text style={[styles.messageText, layout.isCompactPhone && styles.messageTextCompact]}>{searchError}</Text> : null}
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
        <View style={[styles.loadingRow, loadingRowStyle]}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>{text.loadingCatalogs}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  content: {},
  hero: {
    justifyContent: 'flex-end',
    backgroundColor: '#10131d',
  },
  heroImage: { opacity: 0.8 },
  heroShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Platform.isTV ? 'rgba(7,9,15,0.45)' : 'rgba(7,9,15,0.58)',
  },
  heroContent: {},
  heroBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  heroTypeBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: 'rgba(5,8,14,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  heroTypeBadgeCompact: { paddingHorizontal: 7, paddingVertical: 4 },
  heroTypeText: { color: '#f6f8fb', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heroTypeTextCompact: { fontSize: 8, letterSpacing: 0.7 },
  emptyHero: {
    justifyContent: 'center',
    backgroundColor: '#0c101a',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  emptySpinner: { alignSelf: 'flex-start', marginTop: 18 },
  eyebrow: { color: theme.accent, fontWeight: '900', letterSpacing: 2.2, fontSize: 11 },
  eyebrowCompact: { fontSize: 9, letterSpacing: 1.5 },
  heroTitle: {
    color: theme.text,
    fontWeight: '900',
    maxWidth: 820,
    letterSpacing: -1,
  },
  heroMeta: { color: '#d8deea', fontWeight: '700' },
  heroProgressBlock: { width: Platform.isTV ? 400 : '80%', maxWidth: 400, marginTop: 15 },
  heroProgressBlockCompact: { width: '72%', marginTop: 11 },
  heroProgressTrack: { height: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.28)', overflow: 'hidden' },
  heroProgressFill: { height: '100%', borderRadius: 999, backgroundColor: theme.accent },
  heroProgressText: { color: '#d6dce7', fontSize: 10, fontWeight: '800', marginTop: 5 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 20 },
  heroActionsCompact: { gap: 6, marginTop: 14 },
  emptyTitle: { color: theme.text, fontWeight: '900', marginTop: 10 },
  emptyText: { color: theme.muted, maxWidth: 720, marginTop: 10 },
  exploreArea: {},
  exploreLabel: { color: theme.text, fontWeight: '900' },
  browseButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  browseButtonsCompact: { gap: 5 },
  searchArea: {},
  searchShell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#323b50',
    backgroundColor: '#121724',
  },
  searchIcon: { color: theme.muted, fontWeight: '700' },
  search: { flex: 1, color: theme.text, paddingVertical: 0 },
  audioChip: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    justifyContent: 'center',
  },
  audioChipLabel: { color: theme.muted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  audioChipLabelCompact: { fontSize: 8, letterSpacing: 0.7 },
  audioChipValue: { color: theme.text, marginTop: 3, fontWeight: '800', fontSize: 13 },
  audioChipValueCompact: { fontSize: 11, marginTop: 2 },
  section: {},
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionTitle: { color: theme.text, fontWeight: '900', letterSpacing: -0.2 },
  sectionCountBadge: { paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceRaised },
  sectionCount: { color: theme.muted, fontSize: 11, fontWeight: '900' },
  sectionCountCompact: { fontSize: 9 },
  rowContent: {},
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loadingText: { color: theme.muted, fontWeight: '700' },
  messageBox: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  messageTitle: { color: theme.text, fontSize: 17, fontWeight: '900' },
  messageTitleCompact: { fontSize: 14 },
  messageText: { color: theme.muted, marginTop: 6, lineHeight: 20 },
  messageTextCompact: { fontSize: 12, lineHeight: 17 },
});