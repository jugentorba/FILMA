import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, ImageBackground, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { catalogExtrasForPreferences, clearMediaDiscoveryCache, dedupeMediaItems, getCatalogCached, getManifestCached, selectBrowseCatalogs } from '../services/mediaDiscovery';
import { shouldShowInContinueWatching } from '../services/progress';
import { FILMA_ARCHIVE_MANIFEST_URL, type StremioCatalog } from '../services/stremio';
import { fetchRtshArchiveMovies, type YouTubeVideo, youtubeConfigured } from '../services/youtube';
import { useFilma } from '../store/FilmaContext';
import type { FilmaState, MediaItem, WatchProgress } from '../types';
import { MediaCard } from '../ui/MediaCard';
import { useResponsiveLayout } from '../ui/useResponsiveLayout';

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

type Copy = {
  details: string;
  continue: string;
  popular: string;
  new: string;
  featured: string;
  movies: string;
  series: string;
  free: string;
  albanian: string;
  loading: string;
  retry: string;
  noContent: string;
  remaining: string;
};

function copyFor(language: FilmaState['preferences']['appLanguage']): Copy {
  if (language === 'fr') return { details: 'Voir les détails', continue: 'Continuer à regarder', popular: 'Populaires', new: 'Nouveautés', featured: 'À découvrir', movies: 'Films', series: 'Séries', free: 'Gratuit sur FILMA', albanian: 'Films albanais', loading: 'Chargement…', retry: 'Actualiser', noContent: 'Le catalogue est momentanément indisponible.', remaining: 'min restantes' };
  if (language === 'sq') return { details: 'Shiko detajet', continue: 'Vazhdo shikimin', popular: 'Më të njohura', new: 'Të reja', featured: 'Për ty', movies: 'Filma', series: 'Seriale', free: 'Falas në FILMA', albanian: 'Filma shqiptarë', loading: 'Duke ngarkuar…', retry: 'Rifresko', noContent: 'Katalogu nuk është i disponueshëm për momentin.', remaining: 'min të mbetura' };
  return { details: 'View details', continue: 'Continue Watching', popular: 'Popular', new: 'New', featured: 'For You', movies: 'Movies', series: 'Series', free: 'Free on FILMA', albanian: 'Albanian Movies', loading: 'Loading…', retry: 'Refresh', noContent: 'The catalogue is temporarily unavailable.', remaining: 'min remaining' };
}

function catalogKind(catalog: StremioCatalog, copy: Copy): string {
  const id = catalog.id.toLocaleLowerCase();
  const name = (catalog.name ?? '').toLocaleLowerCase();
  if (id === 'top' || name.includes('popular')) return copy.popular;
  if (id === 'year' || name === 'new' || name.includes('new')) return copy.new;
  if (id === 'imdbrating' || name.includes('featured') || name.includes('rating')) return copy.featured;
  return catalog.name?.trim() || copy.featured;
}

function rowTitle(manifestUrl: string, catalog: StremioCatalog, copy: Copy): string {
  if (manifestUrl === FILMA_ARCHIVE_MANIFEST_URL) return copy.free;
  return `${catalogKind(catalog, copy)} · ${catalog.type === 'series' ? copy.series : copy.movies}`;
}

function ContinueCard({ item, progress, copy, onPress }: { item: MediaItem; progress: WatchProgress; copy: Copy; onPress(): void }) {
  const width = Platform.isTV ? 360 : 245;
  const ratio = progress.durationSeconds ? Math.min(1, Math.max(0, progress.positionSeconds / progress.durationSeconds)) : 0;
  const remainingMinutes = progress.durationSeconds > progress.positionSeconds
    ? Math.max(1, Math.round((progress.durationSeconds - progress.positionSeconds) / 60))
    : 0;
  const art = item.backdrop || item.poster;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.continueCard, { width }, pressed && styles.pressed]}>
      <ImageBackground source={art ? { uri: art } : undefined} style={styles.continueArt} imageStyle={styles.continueImage}>
        <View style={styles.continueShade} />
        {remainingMinutes ? <View style={styles.remainingBadge}><Text style={styles.remainingText}>{remainingMinutes} {copy.remaining}</Text></View> : null}
        <View style={styles.continueTextWrap}>
          <Text numberOfLines={1} style={styles.continueTitle}>{item.title}</Text>
          {item.subtitle ? <Text numberOfLines={1} style={styles.continueSubtitle}>{item.subtitle}</Text> : null}
        </View>
        <View style={styles.continueProgress}><View style={[styles.continueProgressFill, { width: `${Math.round(ratio * 100)}%` }]} /></View>
      </ImageBackground>
    </Pressable>
  );
}

function PosterRow({ title, items, onSelect }: { title: string; items: MediaItem[]; onSelect(item: MediaItem): void }) {
  const { state } = useFilma();
  const layout = useResponsiveLayout();
  const listRef = useRef<FlatList<MediaItem>>(null);
  if (!items.length) return null;
  return (
    <View style={styles.section}>
      <View style={[styles.sectionHeading, { paddingHorizontal: layout.horizontalPadding }]}>
        <Text style={[styles.sectionTitle, { fontSize: layout.isTv ? 25 : 21 }]}>{title}</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
      <FlatList
        ref={listRef}
        horizontal
        data={items}
        keyExtractor={item => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: layout.horizontalPadding }}
        renderItem={({ item, index }) => (
          <MediaCard
            item={item}
            progress={state.progress[item.id]}
            favorite={Boolean(state.favorites[item.id] && !state.favorites[item.id].deletedAt)}
            onFocus={() => { if (Platform.isTV) listRef.current?.scrollToIndex({ index, viewPosition: 0.35, animated: true }); }}
            onPress={() => onSelect(item)}
          />
        )}
      />
    </View>
  );
}

export function HomeNuvioScreen({ onSelect, onOpenYouTubeVideo }: Props) {
  const { state } = useFilma();
  const layout = useResponsiveLayout();
  const copy = useMemo(() => copyFor(state.preferences.appLanguage), [state.preferences.appLanguage]);
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [archiveVideos, setArchiveVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);

  const addons = useMemo(() => state.addons.filter(addon => addon.enabled && !addon.deletedAt), [state.addons]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all(addons.map(async addon => {
      try {
        const manifest = await getManifestCached(addon.manifestUrl);
        const catalogs = (manifest.catalogs ?? []).filter(catalog => catalog.type === 'movie' || catalog.type === 'series');
        const chosen = addon.manifestUrl === FILMA_ARCHIVE_MANIFEST_URL
          ? selectBrowseCatalogs(catalogs, state.preferences.preferredAudioLanguages, 1)
          : selectBrowseCatalogs(catalogs, state.preferences.preferredAudioLanguages, 3);
        return (await Promise.all(chosen.map(async catalog => {
          try {
            const items = await getCatalogCached(addon.manifestUrl, catalog.type, catalog.id, catalogExtrasForPreferences(catalog, state.preferences.preferredAudioLanguages));
            return items.length ? { key: `${addon.id}:${catalog.type}:${catalog.id}`, title: rowTitle(addon.manifestUrl, catalog, copy), items } satisfies CatalogRow : null;
          } catch { return null; }
        }))).filter((row): row is CatalogRow => row !== null);
      } catch { return [] as CatalogRow[]; }
    })).then(groups => {
      if (cancelled) return;
      setRows(groups.flat().slice(0, 14));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [addons, copy, reload, state.preferences.preferredAudioLanguages]);

  useEffect(() => {
    if (!youtubeConfigured()) { setArchiveVideos([]); return; }
    let cancelled = false;
    void fetchRtshArchiveMovies().then(videos => { if (!cancelled) setArchiveVideos(videos); }).catch(() => { if (!cancelled) setArchiveVideos([]); });
    return () => { cancelled = true; };
  }, [reload]);

  const continueWatching = useMemo(() => Object.values(state.progress)
    .filter(progress => Boolean(progress.item) && shouldShowInContinueWatching(progress))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()), [state.progress]);

  const favorites = useMemo(() => {
    const catalogue = dedupeMediaItems(rows.flatMap(row => row.items));
    return catalogue.filter(item => Boolean(state.favorites[item.id] && !state.favorites[item.id].deletedAt));
  }, [rows, state.favorites]);

  const heroCandidates = useMemo(() => {
    const fromProgress = continueWatching.flatMap(progress => progress.item ? [progress.item as MediaItem] : []);
    const fromRows = rows.flatMap(row => row.items).slice(0, 12);
    return dedupeMediaItems([...favorites.slice(0, 3), ...fromProgress.slice(0, 3), ...fromRows]).slice(0, 8);
  }, [continueWatching, favorites, rows]);

  useEffect(() => {
    if (heroIndex >= heroCandidates.length) setHeroIndex(0);
  }, [heroCandidates.length, heroIndex]);

  const hero = heroCandidates[heroIndex] ?? null;
  const heroHeight = layout.isTv ? 500 : layout.isTablet ? 520 : Math.max(430, Math.min(600, Math.round(layout.height * 0.56)));
  const rtshItems = useMemo<MediaItem[]>(() => archiveVideos.map(video => ({
    id: `youtube:${video.id}`,
    title: video.title,
    subtitle: 'RTSH Arkiv · Shqip',
    poster: video.thumbnail,
    backdrop: video.thumbnail,
    genres: ['Shqip'],
    source: { kind: 'youtube', videoId: video.id, channelTitle: video.channelTitle },
  })), [archiveVideos]);
  const rtshById = useMemo(() => new Map<string, YouTubeVideo>(archiveVideos.map(video => [`youtube:${video.id}`, video])), [archiveVideos]);

  const refresh = () => { clearMediaDiscoveryCache(); setReload(value => value + 1); };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: Platform.isTV ? 70 : 108 }} showsVerticalScrollIndicator={false}>
      {hero ? (
        <ImageBackground source={(hero.backdrop || hero.poster) ? { uri: hero.backdrop || hero.poster } : undefined} style={[styles.hero, { minHeight: heroHeight }]}>
          <View style={styles.heroShade} />
          <View style={[styles.heroContent, { paddingHorizontal: layout.isTv ? 52 : 20, paddingBottom: layout.isTv ? 48 : 31 }]}>
            <Text numberOfLines={2} style={[styles.heroTitle, { fontSize: layout.isTv ? 54 : layout.isTablet ? 47 : 39 }]}>{hero.title}</Text>
            <Text numberOfLines={1} style={styles.heroMeta}>{[hero.source?.kind === 'stremio' && hero.source.mediaType === 'series' ? copy.series : copy.movies, hero.genres?.[0], hero.year].filter(Boolean).join('  •  ')}</Text>
            <Pressable accessibilityRole="button" onPress={() => onSelect(hero)} style={({ pressed }) => [styles.detailsButton, pressed && styles.pressed]}>
              <Text style={styles.detailsText}>{copy.details}</Text>
            </Pressable>
            {heroCandidates.length > 1 ? (
              <View style={styles.dots}>{heroCandidates.map((_, index) => <Pressable key={index} onPress={() => setHeroIndex(index)} hitSlop={6}><View style={[styles.dot, index === heroIndex && styles.dotActive]} /></Pressable>)}</View>
            ) : null}
          </View>
        </ImageBackground>
      ) : null}

      {continueWatching.length ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { paddingHorizontal: layout.horizontalPadding }]}>{copy.continue}</Text>
          <FlatList
            horizontal
            data={continueWatching}
            keyExtractor={progress => progress.mediaId}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: layout.horizontalPadding }}
            renderItem={({ item }) => item.item ? <ContinueCard item={item.item as MediaItem} progress={item} copy={copy} onPress={() => onSelect(item.item as MediaItem)} /> : null}
          />
        </View>
      ) : null}

      {rows.map(row => <PosterRow key={row.key} title={row.title} items={row.items} onSelect={onSelect} />)}
      {rtshItems.length ? <PosterRow title={copy.albanian} items={rtshItems} onSelect={item => { const video = rtshById.get(item.id); if (video) onOpenYouTubeVideo(video); }} /> : null}

      {loading ? <View style={[styles.loading, { paddingHorizontal: layout.horizontalPadding }]}><ActivityIndicator /><Text style={styles.loadingText}>{copy.loading}</Text></View> : null}
      {!loading && !rows.length ? (
        <View style={[styles.empty, { marginHorizontal: layout.horizontalPadding }]}>
          <Text style={styles.emptyText}>{copy.noContent}</Text>
          <Pressable onPress={refresh} style={styles.retry}><Text style={styles.retryText}>{copy.retry}</Text></Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#070707' },
  hero: { justifyContent: 'flex-end', backgroundColor: '#111' },
  heroShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.25)' },
  heroContent: { maxWidth: 760 },
  heroTitle: { color: '#fff', fontWeight: '900', letterSpacing: -1.5, lineHeight: 52 },
  heroMeta: { color: '#f0f0f1', fontSize: 14, fontWeight: '800', marginTop: 9 },
  detailsButton: { alignSelf: 'flex-start', minHeight: 50, minWidth: 168, paddingHorizontal: 24, borderRadius: 28, backgroundColor: '#f5f5f6', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  detailsText: { color: '#111113', fontSize: 16, fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  dots: { flexDirection: 'row', gap: 8, marginTop: 17, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.76)' },
  dotActive: { width: 34, backgroundColor: '#fff' },
  section: { paddingTop: 27 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 },
  sectionTitle: { color: '#f7f7f8', fontWeight: '900', fontSize: 22, marginBottom: 11 },
  chevron: { color: '#9c9da2', fontSize: 31, lineHeight: 31 },
  continueCard: { height: Platform.isTV ? 205 : 145, marginRight: 12, borderRadius: 14, overflow: 'hidden', backgroundColor: '#171718' },
  continueArt: { flex: 1, justifyContent: 'flex-end' },
  continueImage: { borderRadius: 14 },
  continueShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.24)' },
  remainingBadge: { position: 'absolute', top: 9, right: 9, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, backgroundColor: 'rgba(15,15,16,0.82)' },
  remainingText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  continueTextWrap: { paddingHorizontal: 12, paddingBottom: 13 },
  continueTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  continueSubtitle: { color: '#d5d5d7', fontSize: 11, fontWeight: '600', marginTop: 3 },
  continueProgress: { position: 'absolute', left: 12, right: 12, bottom: 5, height: 3, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.28)', overflow: 'hidden' },
  continueProgressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 99 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 30 },
  loadingText: { color: '#9a9ba0', fontSize: 13 },
  empty: { marginTop: 30, borderRadius: 18, backgroundColor: '#171718', padding: 18 },
  emptyText: { color: '#a5a6ab', fontSize: 14 },
  retry: { alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 15, paddingVertical: 9, borderRadius: 18, backgroundColor: '#f2f2f3' },
  retryText: { color: '#111', fontWeight: '900' },
});
