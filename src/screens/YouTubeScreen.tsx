import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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

type Props = {
  onOpenVideo(video: YouTubeVideo): void;
};

function YouTubeCard({ video, index, onFocus, onPress }: {
  video: YouTubeVideo;
  index: number;
  onFocus(index: number): void;
  onPress(): void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      focusable
      onFocus={() => { setFocused(true); onFocus(index); }}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={[styles.card, focused && styles.cardFocused]}
    >
      <View style={styles.thumbnailWrap}>
        {video.thumbnail ? <Image source={{ uri: video.thumbnail }} style={styles.thumbnail} resizeMode="cover" /> : null}
        <View style={styles.playBadge}><Text style={styles.playBadgeText}>▶</Text></View>
      </View>
      <Text numberOfLines={2} style={styles.videoTitle}>{video.title}</Text>
      <Text numberOfLines={1} style={styles.channelTitle}>{video.channelTitle}</Text>
    </Pressable>
  );
}

export function YouTubeScreen({ onOpenVideo }: Props) {
  const { state } = useFilma();
  const text = stringsFor(state.preferences.appLanguage);
  const listRef = useRef<FlatList<YouTubeVideo>>(null);
  const [query, setQuery] = useState('');
  const [browseMode, setBrowseMode] = useState<YouTubeBrowseMode>('videos');
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [reloadVersion, setReloadVersion] = useState(0);
  const configured = youtubeConfigured();
  const columns = Platform.isTV ? 4 : 2;

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
    }, 500);
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

  if (!configured) {
    return (
      <View style={styles.root}>
        <View style={styles.heroRow}>
          <View style={styles.youtubeMark}><Text style={styles.youtubeMarkText}>▶</Text></View>
          <View style={styles.heroText}>
            <Text style={styles.title}>YouTube</Text>
            <Text style={styles.subtitle}>{modeCopy.fallbackTitle}</Text>
          </View>
        </View>

        <Text style={styles.fallbackText}>{modeCopy.fallbackText}</Text>

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
            style={styles.search}
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
    <View style={styles.root}>
      <View style={styles.heroRow}>
        <View style={styles.youtubeMark}><Text style={styles.youtubeMarkText}>▶</Text></View>
        <View style={styles.heroText}>
          <Text style={styles.title}>YouTube</Text>
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
          style={styles.search}
          autoCorrect={false}
          returnKeyType="search"
        />
        <FocusButton compact label={text.retry} onPress={() => setReloadVersion(value => value + 1)} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{heading}</Text>
        {loading ? <ActivityIndicator size="small" /> : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        key={`youtube-grid-${columns}`}
        ref={listRef}
        data={videos}
        numColumns={columns}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        initialNumToRender={Platform.isTV ? 12 : 8}
        windowSize={7}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          listRef.current?.scrollToOffset({ offset: Math.max(0, Math.floor(index / columns) * averageItemLength), animated: true });
        }}
        renderItem={({ item, index }) => (
          <YouTubeCard
            video={item}
            index={index}
            onFocus={focusedIndex => {
              if (Platform.isTV) listRef.current?.scrollToIndex({ index: focusedIndex, viewPosition: 0.55, animated: true });
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
  root: {
    flex: 1,
    backgroundColor: theme.background,
    paddingHorizontal: Platform.isTV ? 52 : 16,
    paddingTop: Platform.isTV ? 30 : 20,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroText: { flex: 1 },
  youtubeMark: {
    width: Platform.isTV ? 58 : 48,
    height: Platform.isTV ? 40 : 34,
    borderRadius: 12,
    backgroundColor: '#ff0033',
    alignItems: 'center',
    justifyContent: 'center',
  },
  youtubeMarkText: { color: '#fff', fontSize: Platform.isTV ? 20 : 16, fontWeight: '900' },
  title: { color: theme.text, fontSize: Platform.isTV ? 40 : 30, fontWeight: '900' },
  subtitle: { color: theme.muted, marginTop: 4, fontSize: Platform.isTV ? 15 : 13 },
  fallbackText: { color: theme.muted, fontSize: Platform.isTV ? 18 : 16, lineHeight: 26, maxWidth: 780, marginTop: 28 },
  fallbackSectionTitle: { color: theme.text, fontSize: 18, fontWeight: '900', marginTop: 28, marginBottom: 10 },
  quickLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: Platform.isTV ? 24 : 18 },
  searchRow: { flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center' },
  search: {
    flex: 1,
    minHeight: Platform.isTV ? 58 : 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingHorizontal: 18,
    color: theme.text,
    fontSize: Platform.isTV ? 18 : 16,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 26, marginBottom: 12 },
  sectionTitle: { color: theme.text, fontSize: Platform.isTV ? 24 : 20, fontWeight: '900' },
  error: { color: '#fda4af', marginTop: 16, marginBottom: 12 },
  grid: { paddingBottom: Platform.isTV ? 80 : 110 },
  row: { gap: Platform.isTV ? 16 : 10, marginBottom: Platform.isTV ? 22 : 16 },
  card: {
    flex: 1,
    maxWidth: Platform.isTV ? '25%' : '50%',
    padding: Platform.isTV ? 8 : 4,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    transform: [{ scale: 1 }],
  },
  cardFocused: { borderColor: theme.accent, backgroundColor: theme.surface, transform: [{ scale: 1.035 }] },
  thumbnailWrap: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, overflow: 'hidden', backgroundColor: '#151a25' },
  thumbnail: { width: '100%', height: '100%' },
  playBadge: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    width: 34,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBadgeText: { color: '#fff', fontSize: 13 },
  videoTitle: { color: theme.text, fontSize: Platform.isTV ? 16 : 14, lineHeight: Platform.isTV ? 21 : 19, fontWeight: '800', marginTop: 10 },
  channelTitle: { color: theme.muted, fontSize: 13, marginTop: 5 },
  emptyList: { color: theme.muted, fontSize: 17, paddingVertical: 40 },
});