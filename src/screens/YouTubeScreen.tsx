import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { stringsFor } from '../i18n';
import {
  fetchPopularYouTubeVideos,
  searchYouTubeVideos,
  type YouTubeBrowseMode,
  type YouTubeVideo,
  youtubeConfigured,
} from '../services/youtube';
import { useFilma } from '../store/FilmaContext';
import { FocusButton } from '../ui/FocusButton';
import { theme } from '../ui/theme';
import { useResponsiveLayout } from '../ui/useResponsiveLayout';

type Props = {
  onOpenVideo(video: YouTubeVideo): void;
};

function YouTubeCard({ video, index, columns, onFocus, onPress }: {
  video: YouTubeVideo;
  index: number;
  columns: number;
  onFocus(index: number): void;
  onPress(): void;
}) {
  const [focused, setFocused] = useState(false);
  const layout = useResponsiveLayout();
  const cardStyle = useMemo(() => ({
    maxWidth: `${100 / columns}%` as const,
    padding: layout.isTv ? 6 : layout.isCompactPhone ? 2 : 4,
    borderRadius: layout.isTv ? 14 : 12,
  }), [columns, layout.isCompactPhone, layout.isTv]);
  const titleStyle = useMemo(() => ({
    fontSize: layout.isTv ? 15 : layout.isCompactPhone ? 12 : layout.isTablet ? 14 : 13,
    lineHeight: layout.isTv ? 20 : layout.isCompactPhone ? 16 : 18,
    marginTop: layout.isCompactPhone ? 6 : 8,
  }), [layout.isCompactPhone, layout.isTablet, layout.isTv]);
  const channelStyle = useMemo(() => ({
    fontSize: layout.isTv ? 12 : layout.isCompactPhone ? 10 : 11,
    marginTop: layout.isCompactPhone ? 3 : 4,
  }), [layout.isCompactPhone, layout.isTv]);

  return (
    <Pressable
      focusable
      accessibilityRole="button"
      accessibilityLabel={`${video.title} · ${video.channelTitle}`}
      onFocus={() => { setFocused(true); onFocus(index); }}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={[styles.card, cardStyle, focused && styles.cardFocused]}
    >
      <View style={styles.thumbnailWrap}>
        {video.thumbnail ? <Image source={{ uri: video.thumbnail }} style={styles.thumbnail} resizeMode="cover" /> : null}
        <View style={[styles.playBadge, layout.isCompactPhone && styles.playBadgeCompact]}>
          <Text style={styles.playBadgeText}>▶</Text>
        </View>
      </View>
      <Text numberOfLines={2} style={[styles.videoTitle, titleStyle]}>{video.title}</Text>
      <Text numberOfLines={1} style={[styles.channelTitle, channelStyle]}>{video.channelTitle}</Text>
    </Pressable>
  );
}

export function YouTubeScreen({ onOpenVideo }: Props) {
  const { state } = useFilma();
  const layout = useResponsiveLayout();
  const text = stringsFor(state.preferences.appLanguage);
  const listRef = useRef<FlatList<YouTubeVideo>>(null);
  const [query, setQuery] = useState('');
  const [browseMode, setBrowseMode] = useState<YouTubeBrowseMode>('videos');
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [reloadVersion, setReloadVersion] = useState(0);
  const configured = youtubeConfigured();
  const columns = layout.isTv
    ? (layout.width >= 1700 ? 5 : 4)
    : layout.isTablet
      ? (layout.width >= 950 ? 4 : 3)
      : 2;

  const modeCopy = useMemo(() => {
    if (state.preferences.appLanguage === 'fr') {
      return {
        videos: 'Vidéos',
        music: 'Musique',
        popularVideos: 'Populaire sur YouTube',
        popularMusic: 'Musique populaire',
        videoResults: 'Résultats YouTube',
        musicResults: 'Résultats musique',
        fallbackTitle: 'YouTube reste disponible',
        fallbackText: 'La recherche intégrée FILMA nécessite la clé YouTube Data API, mais vous pouvez déjà ouvrir YouTube, YouTube Music ou rechercher directement.',
        searchExternal: 'Rechercher sur YouTube',
        officialAlbanian: 'Chaînes albanaises',
      };
    }
    if (state.preferences.appLanguage === 'sq') {
      return {
        videos: 'Video',
        music: 'Muzikë',
        popularVideos: 'Popullore në YouTube',
        popularMusic: 'Muzikë popullore',
        videoResults: 'Rezultatet e YouTube',
        musicResults: 'Rezultatet e muzikës',
        fallbackTitle: 'YouTube është ende i disponueshëm',
        fallbackText: 'Kërkimi brenda FILMA kërkon çelësin YouTube Data API, por mund të hapësh tani YouTube, YouTube Music ose të kërkosh direkt.',
        searchExternal: 'Kërko në YouTube',
        officialAlbanian: 'Kanale shqiptare',
      };
    }
    return {
      videos: 'Videos',
      music: 'Music',
      popularVideos: 'Popular on YouTube',
      popularMusic: 'Popular music',
      videoResults: 'YouTube search results',
      musicResults: 'Music search results',
      fallbackTitle: 'YouTube is still available',
      fallbackText: 'FILMA’s built-in catalog search needs the YouTube Data API key, but you can already open YouTube, YouTube Music, or search directly.',
      searchExternal: 'Search YouTube',
      officialAlbanian: 'Albanian channels',
    };
  }, [state.preferences.appLanguage]);

  const openUrl = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      setError(text.youtubeLoadError);
    }
  }, [text.youtubeLoadError]);

  const openExternalSearch = useCallback(() => {
    const needle = query.trim();
    const target = needle
      ? `https://www.youtube.com/results?search_query=${encodeURIComponent(needle)}`
      : 'https://www.youtube.com/';
    void openUrl(target);
  }, [openUrl, query]);

  const loadPopular = useCallback(async () => {
    if (!configured) return;
    setLoading(true);
    setError(undefined);
    try {
      setVideos(await fetchPopularYouTubeVideos(state.preferences.appLanguage, browseMode));
    } catch (reason) {
      setVideos([]);
      setError(reason instanceof Error ? reason.message : text.youtubeLoadError);
    } finally {
      setLoading(false);
    }
  }, [browseMode, configured, state.preferences.appLanguage, text.youtubeLoadError]);

  useEffect(() => {
    if (!query.trim()) void loadPopular();
  }, [loadPopular, query, reloadVersion]);

  useEffect(() => {
    const needle = query.trim();
    if (!configured || needle.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(undefined);
      void searchYouTubeVideos(needle, state.preferences.appLanguage, browseMode)
        .then(results => {
          if (!cancelled) setVideos(results);
        })
        .catch(reason => {
          if (!cancelled) {
            setVideos([]);
            setError(reason instanceof Error ? reason.message : text.youtubeSearchError);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [browseMode, configured, query, state.preferences.appLanguage, text.youtubeSearchError]);

  const heading = useMemo(() => {
    if (query.trim()) return browseMode === 'music' ? modeCopy.musicResults : modeCopy.videoResults;
    return browseMode === 'music' ? modeCopy.popularMusic : modeCopy.popularVideos;
  }, [browseMode, modeCopy, query]);

  const changeMode = (nextMode: YouTubeBrowseMode) => {
    if (nextMode === browseMode) return;
    setBrowseMode(nextMode);
    setVideos([]);
    setError(undefined);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const rootStyle = useMemo(() => ({
    paddingHorizontal: layout.horizontalPadding,
    paddingTop: layout.isTv ? 22 : layout.isCompactPhone ? 12 : 16,
  }), [layout.horizontalPadding, layout.isCompactPhone, layout.isTv]);
  const titleStyle = useMemo(() => ({
    fontSize: layout.isTv ? 34 : layout.isCompactPhone ? 24 : layout.isTablet ? 30 : 27,
  }), [layout.isCompactPhone, layout.isTablet, layout.isTv]);
  const searchStyle = useMemo(() => ({
    minHeight: layout.isTv ? 48 : layout.isCompactPhone ? 38 : 44,
    borderRadius: layout.isCompactPhone ? 11 : 13,
    paddingHorizontal: layout.isCompactPhone ? 11 : 14,
    fontSize: layout.isTv ? 16 : layout.isCompactPhone ? 13 : 14,
  }), [layout.isCompactPhone, layout.isTv]);
  const rowStyle = useMemo(() => ({
    gap: layout.isTv ? 10 : layout.isCompactPhone ? 5 : 8,
    marginBottom: layout.isTv ? 12 : layout.isCompactPhone ? 8 : 11,
  }), [layout.isCompactPhone, layout.isTv]);

  if (!configured) {
    return (
      <View style={[styles.root, rootStyle]}>
        <View style={styles.heroRow}>
          <View style={[styles.youtubeMark, layout.isCompactPhone && styles.youtubeMarkCompact]}><Text style={styles.youtubeMarkText}>▶</Text></View>
          <View style={styles.heroText}>
            <Text style={[styles.title, titleStyle]}>YouTube</Text>
            <Text style={styles.subtitle}>{modeCopy.fallbackTitle}</Text>
          </View>
        </View>

        <Text style={[styles.fallbackText, layout.isCompactPhone && styles.fallbackTextCompact]}>{modeCopy.fallbackText}</Text>

        <View style={styles.modeRow}>
          <FocusButton label="YouTube" active preferredFocus onPress={() => void openUrl('https://www.youtube.com/')} />
          <FocusButton label="YouTube Music" onPress={() => void openUrl('https://music.youtube.com/')} />
        </View>

        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={text.youtubeSearchPlaceholder}
            placeholderTextColor={theme.muted}
            style={[styles.search, searchStyle]}
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={openExternalSearch}
          />
          <FocusButton compact label={modeCopy.searchExternal} onPress={openExternalSearch} />
        </View>

        <Text style={styles.fallbackSectionTitle}>{modeCopy.officialAlbanian}</Text>
        <View style={styles.quickLinks}>
          <FocusButton compact label="RTSH" onPress={() => void openUrl('https://www.youtube.com/results?search_query=RTSH')} />
          <FocusButton compact label="Top Channel" onPress={() => void openUrl('https://www.youtube.com/results?search_query=Top+Channel+Albania')} />
          <FocusButton compact label="Klan Kosova" onPress={() => void openUrl('https://www.youtube.com/results?search_query=Klan+Kosova')} />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <View style={[styles.root, rootStyle]}>
      <View style={styles.heroRow}>
        <View style={[styles.youtubeMark, layout.isCompactPhone && styles.youtubeMarkCompact]}><Text style={styles.youtubeMarkText}>▶</Text></View>
        <View style={styles.heroText}>
          <Text style={[styles.title, titleStyle]}>YouTube</Text>
          <Text style={styles.subtitle}>{text.youtubeTvSubtitle}</Text>
        </View>
      </View>

      <View style={styles.modeRow}>
        <FocusButton compact label={modeCopy.videos} active={browseMode === 'videos'} onPress={() => changeMode('videos')} />
        <FocusButton compact label={modeCopy.music} active={browseMode === 'music'} onPress={() => changeMode('music')} />
      </View>

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={text.youtubeSearchPlaceholder}
          placeholderTextColor={theme.muted}
          style={[styles.search, searchStyle]}
          autoCorrect={false}
          returnKeyType="search"
        />
        <FocusButton compact label={text.retry} onPress={() => setReloadVersion(value => value + 1)} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { fontSize: layout.isTv ? 21 : layout.isCompactPhone ? 16 : 18 }]}>{heading}</Text>
        <Text style={styles.resultCount}>{videos.length}</Text>
        {loading ? <ActivityIndicator size="small" /> : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        key={`youtube-grid-${columns}`}
        ref={listRef}
        data={videos}
        numColumns={columns}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.grid, { paddingBottom: layout.isTv ? 70 : 96 }]}
        columnWrapperStyle={rowStyle}
        initialNumToRender={layout.isTv ? Math.max(12, columns * 3) : Math.max(8, columns * 3)}
        windowSize={7}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          listRef.current?.scrollToOffset({ offset: Math.max(0, Math.floor(index / columns) * averageItemLength), animated: true });
        }}
        renderItem={({ item, index }) => (
          <YouTubeCard
            video={item}
            index={index}
            columns={columns}
            onFocus={focusedIndex => {
              if (layout.isTv) listRef.current?.scrollToIndex({ index: focusedIndex, viewPosition: 0.55, animated: true });
            }}
            onPress={() => onOpenVideo(item)}
          />
        )}
        ListEmptyComponent={!loading ? <Text style={styles.emptyList}>{text.noSearchResults}</Text> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroText: { flex: 1 },
  youtubeMark: {
    width: 50,
    height: 35,
    borderRadius: 10,
    backgroundColor: '#ff0033',
    alignItems: 'center',
    justifyContent: 'center',
  },
  youtubeMarkCompact: { width: 42, height: 30, borderRadius: 9 },
  youtubeMarkText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  title: { color: theme.text, fontWeight: '900' },
  subtitle: { color: theme.muted, marginTop: 2, fontSize: 12 },
  fallbackText: { color: theme.muted, fontSize: 15, lineHeight: 23, maxWidth: 780, marginTop: 20 },
  fallbackTextCompact: { fontSize: 13, lineHeight: 19, marginTop: 14 },
  fallbackSectionTitle: { color: theme.text, fontSize: 16, fontWeight: '900', marginTop: 22, marginBottom: 8 },
  quickLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 },
  searchRow: { flexDirection: 'row', gap: 8, marginTop: 9, alignItems: 'center' },
  search: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    color: theme.text,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 17, marginBottom: 8 },
  sectionTitle: { color: theme.text, fontWeight: '900' },
  resultCount: { color: theme.muted, backgroundColor: theme.surface, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, fontSize: 11, fontWeight: '800' },
  error: { color: '#fda4af', marginTop: 10, marginBottom: 8, fontSize: 12 },
  grid: {},
  card: {
    flex: 1,
    borderWidth: 2,
    borderColor: 'transparent',
    transform: [{ scale: 1 }],
  },
  cardFocused: { borderColor: theme.accent, backgroundColor: theme.surface, transform: [{ scale: 1.025 }] },
  thumbnailWrap: { width: '100%', aspectRatio: 16 / 9, borderRadius: 10, overflow: 'hidden', backgroundColor: '#151a25' },
  thumbnail: { width: '100%', height: '100%' },
  playBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    width: 30,
    height: 24,
    borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBadgeCompact: { left: 6, bottom: 6, width: 25, height: 20, borderRadius: 6 },
  playBadgeText: { color: '#fff', fontSize: 11 },
  videoTitle: { color: theme.text, fontWeight: '800' },
  channelTitle: { color: theme.muted },
  emptyList: { color: theme.muted, fontSize: 15, paddingVertical: 28 },
});
