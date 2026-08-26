import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { catalogExtrasForPreferences, dedupeMediaItems, getCatalogCached, getManifestCached } from '../services/mediaDiscovery';
import { catalogSupportsSearch, type StremioCatalog } from '../services/stremio';
import { useFilma } from '../store/FilmaContext';
import type { MediaItem } from '../types';
import { MediaCard } from '../ui/MediaCard';
import { useResponsiveLayout } from '../ui/useResponsiveLayout';

const RECENTS_KEY = 'filma.search.recents.v1';
const MAX_RECENTS = 10;

type Props = {
  onSelect(item: MediaItem): void;
};

type SearchTarget = {
  key: string;
  manifestUrl: string;
  catalog: StremioCatalog;
};

function copyFor(language: 'en' | 'fr' | 'sq') {
  if (language === 'fr') {
    return {
      title: 'Rechercher', placeholder: 'Rechercher des films, séries…', recent: 'Recherches récentes',
      results: 'Résultats', empty: 'Aucun résultat', hint: 'Commencez à écrire pour rechercher dans FILMA.', clear: 'Effacer',
    };
  }
  if (language === 'sq') {
    return {
      title: 'Kërko', placeholder: 'Kërko filma, seriale…', recent: 'Kërkimet e fundit',
      results: 'Rezultatet', empty: 'Nuk u gjet asgjë', hint: 'Fillo të shkruash për të kërkuar në FILMA.', clear: 'Pastro',
    };
  }
  return {
    title: 'Search', placeholder: 'Search movies, series…', recent: 'Recent searches',
    results: 'Results', empty: 'No results found', hint: 'Start typing to search FILMA.', clear: 'Clear',
  };
}

function normalizeRecents(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((value): value is string => typeof value === 'string' && Boolean(value.trim())).slice(0, MAX_RECENTS);
}

export function SearchScreen({ onSelect }: Props) {
  const { state } = useFilma();
  const layout = useResponsiveLayout();
  const copy = useMemo(() => copyFor(state.preferences.appLanguage), [state.preferences.appLanguage]);
  const [query, setQuery] = useState('');
  const [targets, setTargets] = useState<SearchTarget[]>([]);
  const [results, setResults] = useState<MediaItem[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);

  const activeAddons = useMemo(() => state.addons.filter(addon => addon.enabled && !addon.deletedAt), [state.addons]);

  useEffect(() => {
    void AsyncStorage.getItem(RECENTS_KEY).then(raw => {
      if (!raw) return;
      try { setRecents(normalizeRecents(JSON.parse(raw))); } catch { setRecents([]); }
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(activeAddons.map(async addon => {
      try {
        const manifest = await getManifestCached(addon.manifestUrl);
        return (manifest.catalogs ?? [])
          .filter(catalog => (catalog.type === 'movie' || catalog.type === 'series') && catalogSupportsSearch(catalog))
          .map(catalog => ({ key: `${addon.id}:${catalog.type}:${catalog.id}`, manifestUrl: addon.manifestUrl, catalog } satisfies SearchTarget));
      } catch {
        return [] as SearchTarget[];
      }
    })).then(groups => { if (!cancelled) setTargets(groups.flat()); });
    return () => { cancelled = true; };
  }, [activeAddons]);

  const remember = (value: string) => {
    const clean = value.trim();
    if (!clean) return;
    setRecents(current => {
      const next = [clean, ...current.filter(item => item.toLocaleLowerCase() !== clean.toLocaleLowerCase())].slice(0, MAX_RECENTS);
      void AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const removeRecent = (value: string) => {
    setRecents(current => {
      const next = current.filter(item => item !== value);
      void AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < 2 || !targets.length) {
      setResults([]);
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
      })).then(groups => {
        if (cancelled) return;
        setResults(dedupeMediaItems(groups.flat()).slice(0, 80));
        setSearching(false);
      });
    }, 280);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, state.preferences.preferredAudioLanguages, targets]);

  const columns = layout.isTv ? 7 : layout.isTablet ? 5 : layout.width >= 430 ? 3 : 2;
  const cardWidth = Math.max(118, Math.floor((layout.width - layout.horizontalPadding * 2 - (columns - 1) * 10) / columns));

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingHorizontal: layout.horizontalPadding, paddingTop: layout.isTv ? 28 : 18 }]}>
        <Text style={[styles.title, { fontSize: layout.isTv ? 42 : layout.isTablet ? 38 : 34 }]}>{copy.title}</Text>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            autoFocus={!layout.isTv}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => remember(query)}
            placeholder={copy.placeholder}
            placeholderTextColor="#8b8d94"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={styles.input}
          />
          {searching ? <ActivityIndicator size="small" /> : query ? (
            <Pressable accessibilityRole="button" onPress={() => setQuery('')} hitSlop={12}><Text style={styles.clear}>×</Text></Pressable>
          ) : null}
        </View>
      </View>

      {!query.trim() ? (
        <View style={[styles.recents, { paddingHorizontal: layout.horizontalPadding }]}>
          <Text style={styles.sectionTitle}>{copy.recent}</Text>
          {recents.length ? recents.map(item => (
            <View key={item} style={styles.recentRow}>
              <Pressable style={styles.recentMain} onPress={() => setQuery(item)}>
                <View style={styles.clock}><Text style={styles.clockText}>↶</Text></View>
                <Text numberOfLines={1} style={styles.recentText}>{item}</Text>
              </Pressable>
              <Pressable accessibilityLabel={`${copy.clear} ${item}`} hitSlop={12} onPress={() => removeRecent(item)}><Text style={styles.remove}>×</Text></Pressable>
            </View>
          )) : <Text style={styles.hint}>{copy.hint}</Text>}
        </View>
      ) : (
        <View style={styles.resultsWrap}>
          <View style={[styles.resultsHeader, { paddingHorizontal: layout.horizontalPadding }]}>
            <Text style={styles.sectionTitle}>{copy.results}</Text>
            {results.length ? <Text style={styles.count}>{results.length}</Text> : null}
          </View>
          {results.length ? (
            <FlatList
              data={results}
              key={`search-${columns}`}
              numColumns={columns}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: layout.horizontalPadding, paddingBottom: 105 }}
              columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
              renderItem={({ item }) => (
                <View style={{ width: cardWidth }}>
                  <MediaCard
                    item={item}
                    progress={state.progress[item.id]}
                    favorite={Boolean(state.favorites[item.id] && !state.favorites[item.id].deletedAt)}
                    onPress={() => { remember(query); onSelect(item); }}
                  />
                </View>
              )}
            />
          ) : !searching ? <Text style={[styles.empty, { paddingHorizontal: layout.horizontalPadding }]}>{copy.empty}</Text> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080808' },
  header: { paddingBottom: 16 },
  title: { color: '#f6f6f7', fontWeight: '900', letterSpacing: -1.2, marginBottom: 15 },
  searchBox: { minHeight: 56, borderRadius: 15, paddingHorizontal: 16, backgroundColor: '#202021', borderWidth: 1, borderColor: '#2c2d2f', flexDirection: 'row', alignItems: 'center', gap: 12 },
  searchIcon: { color: '#9ea1a8', fontSize: 25, fontWeight: '700' },
  input: { flex: 1, color: '#f7f7f8', fontSize: 17, paddingVertical: 0 },
  clear: { color: '#a7aab0', fontSize: 29, lineHeight: 30 },
  recents: { paddingTop: 12, paddingBottom: 110 },
  sectionTitle: { color: '#f3f3f4', fontWeight: '900', fontSize: 20, marginBottom: 13 },
  recentRow: { minHeight: 67, flexDirection: 'row', alignItems: 'center', gap: 12 },
  recentMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 13 },
  clock: { width: 43, height: 43, borderRadius: 99, backgroundColor: '#171718', alignItems: 'center', justifyContent: 'center' },
  clockText: { color: '#a7aab0', fontSize: 24, fontWeight: '800' },
  recentText: { flex: 1, color: '#f1f1f3', fontSize: 18, fontWeight: '500' },
  remove: { color: '#9da1a8', fontSize: 31, fontWeight: '300' },
  hint: { color: '#85878d', fontSize: 14, marginTop: 6 },
  resultsWrap: { flex: 1 },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6 },
  count: { color: '#82858b', fontSize: 12, fontWeight: '800', marginBottom: 13 },
  gridRow: { gap: 10 },
  empty: { color: '#8b8e95', fontSize: 15, paddingTop: 24 },
});
