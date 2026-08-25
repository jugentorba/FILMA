import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { demoMovies } from '../data/demo';
import { fetchCatalog, fetchManifest } from '../services/stremio';
import { useFilma } from '../store/FilmaContext';
import type { MediaItem } from '../types';
import { FocusButton } from '../ui/FocusButton';
import { MediaCard } from '../ui/MediaCard';
import { theme } from '../ui/theme';

type Props = {
  onSelect(item: MediaItem): void;
};

type CatalogRow = {
  key: string;
  title: string;
  items: MediaItem[];
};

export function HomeScreen({ onSelect }: Props) {
  const { state } = useFilma();
  const [addonRows, setAddonRows] = useState<CatalogRow[]>([]);
  const [loadingAddons, setLoadingAddons] = useState(false);
  const [addonError, setAddonError] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const addons = state.addons.filter(item => item.enabled);
      if (!addons.length) {
        setAddonRows([]);
        setAddonError(undefined);
        return;
      }

      setLoadingAddons(true);
      setAddonError(undefined);
      const rows: CatalogRow[] = [];

      for (const addon of addons) {
        try {
          const manifest = await fetchManifest(addon.manifestUrl);
          const catalogs = (manifest.catalogs ?? [])
            .filter(catalog => catalog.type === 'movie' || catalog.type === 'series')
            .slice(0, 3);

          for (const catalog of catalogs) {
            try {
              const items = await fetchCatalog(addon.manifestUrl, catalog.type, catalog.id);
              if (items.length) {
                rows.push({
                  key: `${addon.id}:${catalog.type}:${catalog.id}`,
                  title: `${manifest.name} · ${catalog.name ?? catalog.id}`,
                  items,
                });
              }
            } catch {
              // One broken catalog should not hide the rest of the add-on.
            }
          }
        } catch {
          // Continue loading other configured add-ons.
        }
      }

      if (!cancelled) {
        setAddonRows(rows);
        if (!rows.length) setAddonError('Configured add-ons did not return a movie or series catalog.');
        setLoadingAddons(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [state.addons]);

  const allLoadedItems = useMemo(
    () => [...demoMovies, ...addonRows.flatMap(row => row.items)],
    [addonRows],
  );

  const continueWatching = useMemo(
    () => allLoadedItems
      .filter(item => Boolean(state.progress[item.id]?.positionSeconds))
      .sort((a, b) => new Date(state.progress[b.id].updatedAt).getTime() - new Date(state.progress[a.id].updatedAt).getTime()),
    [allLoadedItems, state.progress],
  );

  const hero = continueWatching[0] ?? addonRows[0]?.items[0] ?? demoMovies[0];

  const row = (title: string, data: MediaItem[], keyPrefix = title) => (
    <View style={styles.section} key={keyPrefix}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <FlatList
        horizontal
        data={data}
        keyExtractor={item => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowContent}
        renderItem={({ item }) => (
          <MediaCard
            item={item}
            progress={state.progress[item.id]}
            favorite={Boolean(state.favorites[item.id])}
            onPress={() => onSelect(item)}
          />
        )}
      />
    </View>
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>FILMA</Text>
        <Text style={styles.heroTitle}>{hero.title}</Text>
        <Text style={styles.heroText}>
          Movies open first. Continue on this device or pick up from your saved watch position on another device after sync.
        </Text>
        <View style={styles.heroActions}>
          <FocusButton label={state.progress[hero.id] ? '▶ Continue' : '▶ Play'} active onPress={() => onSelect(hero)} />
        </View>
      </View>

      {continueWatching.length ? row('Continue Watching', continueWatching, 'continue') : null}
      {addonRows.map(catalog => row(catalog.title, catalog.items, catalog.key))}
      {loadingAddons ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Loading configured catalogs…</Text>
        </View>
      ) : null}
      {addonError ? <Text style={styles.addonError}>{addonError}</Text> : null}
      {row('FILMA Playback Tests', demoMovies, 'demo')}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    paddingBottom: 80,
  },
  hero: {
    minHeight: Platform.isTV ? 390 : 320,
    paddingHorizontal: Platform.isTV ? 64 : 20,
    paddingTop: Platform.isTV ? 86 : 54,
    paddingBottom: 42,
    justifyContent: 'center',
    backgroundColor: '#0d1220',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  eyebrow: {
    color: theme.accent,
    fontWeight: '900',
    letterSpacing: 2.5,
    fontSize: 13,
  },
  heroTitle: {
    color: theme.text,
    fontSize: Platform.isTV ? 52 : 34,
    lineHeight: Platform.isTV ? 58 : 40,
    fontWeight: '900',
    marginTop: 12,
  },
  heroText: {
    maxWidth: 700,
    color: theme.muted,
    fontSize: Platform.isTV ? 19 : 15,
    lineHeight: Platform.isTV ? 28 : 22,
    marginTop: 12,
  },
  heroActions: {
    flexDirection: 'row',
    marginTop: 24,
  },
  section: {
    paddingTop: Platform.isTV ? 34 : 28,
  },
  sectionTitle: {
    color: theme.text,
    fontSize: Platform.isTV ? 27 : 21,
    fontWeight: '800',
    paddingHorizontal: Platform.isTV ? 64 : 20,
    marginBottom: 16,
  },
  rowContent: {
    paddingLeft: Platform.isTV ? 64 : 20,
    paddingRight: Platform.isTV ? 40 : 6,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Platform.isTV ? 64 : 20,
    paddingTop: 28,
  },
  loadingText: {
    color: theme.muted,
  },
  addonError: {
    color: '#fda4af',
    paddingHorizontal: Platform.isTV ? 64 : 20,
    paddingTop: 24,
  },
});
