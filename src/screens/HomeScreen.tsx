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

type CatalogRow = {
  key: string;
  title: string;
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

function dedupe(items: MediaItem[]): MediaItem[] {
  const unique = new Map<string, MediaItem>();
  for (const item of items) {
    if (!unique.has(item.id)) unique.set(item.id, item);
  }
  return [...unique.values()];
}

function MediaRow({ title, data, state, onSelect }: MediaRowProps) {
  const listRef = useRef<FlatList<MediaItem>>(null);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionCount}>{data.length}</Text>
      </View>
      <FlatList
        ref={listRef}
        horizontal
        data={data}
        keyExtractor={item => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowContent}
        initialNumToRender={Platform.isTV ? 10 : 6}
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
  const [remoteResults, setRemoteResults] = useState<MediaItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string>();
  const [albanianArchiveVideos, setAlbanianArchiveVideos] = useState<YouTubeVideo[]>([]);

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
      const rows: CatalogRow[] = [];
      const targets: SearchTarget[] = [];

      for (const addon of activeAddons) {
        try {
          const manifest = await fetchManifest(addon.manifestUrl);
          const catalogs = (manifest.catalogs ?? []).filter(catalog => catalog.type === 'movie' || catalog.type === 'series');

          catalogs.forEach(catalog => {
            if (catalogSupportsSearch(catalog)) {
              targets.push({ key: `${addon.id}:${catalog.type}:${catalog.id}`, manifestUrl: addon.manifestUrl, catalog });
            }
          });

          const browseCatalogs = catalogs
            .filter(catalog => catalogCanLoadWithoutSearch(catalog, state.preferences.preferredAudioLanguages))
            .slice(0, 4);

          for (const catalog of browseCatalogs) {
            try {
              const items = await fetchCatalog(
                addon.manifestUrl,
                catalog.type,
                catalog.id,
                catalogLanguageExtra(catalog, state.preferences.preferredAudioLanguages),
              );
              if (items.length) {
                rows.push({
                  key: `${addon.id}:${catalog.type}:${catalog.id}`,
                  title: catalog.name || manifest.name,
                  items: dedupe(items),
                });
              }
            } catch {
              // One failed catalog should not hide other working catalogs.
            }
          }
        } catch {
          // Continue loading the remaining enabled sources.
        }
      }

      if (!cancelled) {
        setAddonRows(rows);
        setSearchTargets(targets);
        if (!rows.length) setAddonError(text.sourceLoadError);
        setLoadingAddons(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [activeAddons, reloadVersion, state.preferences.preferredAudioLanguages, text.sourceLoadError]);

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

  const continueWatching = useMemo(
    () => allLoadedItems
      .filter(item => shouldShowInContinueWatching(state.progress[item.id]))
      .sort((a, b) => new Date(state.progress[b.id].updatedAt).getTime() - new Date(state.progress[a.id].updatedAt).getTime()),
    [allLoadedItems, state.progress],
  );

  const favorites = useMemo(
    () => allLoadedItems.filter(item => {
      const favorite = state.favorites[item.id];
      return Boolean(favorite && !favorite.deletedAt);
    }),
    [allLoadedItems, state.favorites],
  );

  const localSearchResults = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return [];
    return allLoadedItems.filter(item => {
      const haystack = [item.title, item.subtitle, ...(item.genres ?? [])].filter(Boolean).join(' ').toLocaleLowerCase();
      return haystack.includes(needle);
    });
  }, [allLoadedItems, query]);

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < 2 || !searchTargets.length) {
      setRemoteResults([]);
      setSearching(false);
      setSearchError(undefined);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      setSearchError(undefined);
      void Promise.all(searchTargets.map(async target => {
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
        const merged = dedupe(results.flat()).slice(0, 80);
        setRemoteResults(merged);
        if (!merged.length && !localSearchResults.length) setSearchError(text.searchSourceError);
        setSearching(false);
      });
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [localSearchResults.length, query, searchTargets, state.preferences.preferredAudioLanguages, text.searchSourceError]);

  const searchResults = useMemo(() => dedupe([...remoteResults, ...localSearchResults]), [remoteResults, localSearchResults]);
  const hero = continueWatching[0] ?? addonRows[0]?.items[0] ?? null;
  const heroCanContinue = hero ? shouldShowInContinueWatching(state.progress[hero.id]) : false;
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
            <Text style={styles.eyebrow}>{text.homeEyebrow}</Text>
            <Text numberOfLines={2} style={styles.heroTitle}>{hero.title}</Text>
            <Text numberOfLines={2} style={styles.heroMeta}>
              {[hero.year, hero.genres?.slice(0, 3).join('  •  ')].filter(Boolean).join('   ') || hero.subtitle || 'FILMA'}
            </Text>
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
          {albanianArchiveItems.length ? (
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
          {addonRows.map(catalog => <MediaRow key={catalog.key} title={catalog.title} data={catalog.items} state={state} onSelect={onSelect} />)}
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
    minHeight: Platform.isTV ? 500 : 390,
    justifyContent: 'flex-end',
    backgroundColor: '#10131d',
  },
  heroImage: { opacity: 0.78 },
  heroShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Platform.isTV ? 'rgba(7,9,15,0.42)' : 'rgba(7,9,15,0.55)',
  },
  heroContent: {
    paddingHorizontal: Platform.isTV ? 64 : 20,
    paddingBottom: Platform.isTV ? 54 : 34,
    paddingTop: Platform.isTV ? 120 : 80,
    maxWidth: Platform.isTV ? 940 : undefined,
  },
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
    fontSize: Platform.isTV ? 58 : 38,
    lineHeight: Platform.isTV ? 64 : 44,
    fontWeight: '900',
    marginTop: 12,
    maxWidth: 820,
  },
  heroMeta: { color: '#d8deea', marginTop: 12, fontSize: Platform.isTV ? 18 : 14, fontWeight: '700' },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 24 },
  emptyTitle: { color: theme.text, fontSize: Platform.isTV ? 48 : 34, lineHeight: Platform.isTV ? 54 : 40, fontWeight: '900', marginTop: 12 },
  emptyText: { color: theme.muted, maxWidth: 720, fontSize: Platform.isTV ? 19 : 16, lineHeight: Platform.isTV ? 28 : 24, marginTop: 12 },
  searchArea: {
    paddingHorizontal: Platform.isTV ? 64 : 20,
    paddingTop: Platform.isTV ? 30 : 22,
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
  section: { paddingTop: Platform.isTV ? 36 : 30 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Platform.isTV ? 64 : 20, marginBottom: 16 },
  sectionTitle: { color: theme.text, fontSize: Platform.isTV ? 27 : 22, fontWeight: '900' },
  sectionCount: { color: theme.muted, fontSize: 13, fontWeight: '800' },
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
