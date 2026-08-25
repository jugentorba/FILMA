import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { stringsFor } from '../i18n';
import { fetchPopularYouTubeVideos, searchYouTubeVideos, type YouTubeVideo, youtubeConfigured } from '../services/youtube';
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
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [reloadVersion, setReloadVersion] = useState(0);
  const configured = youtubeConfigured();

  const loadPopular = useCallback(async () => {
    if (!configured) return;
    setLoading(true);
    setError(undefined);
    try {
      setVideos(await fetchPopularYouTubeVideos(state.preferences.appLanguage));
    } catch (reason) {
      setVideos([]);
      setError(reason instanceof Error ? reason.message : text.youtubeLoadError);
    } finally {
      setLoading(false);
    }
  }, [configured, state.preferences.appLanguage, text.youtubeLoadError]);

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
      void searchYouTubeVideos(needle, state.preferences.appLanguage)
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
  }, [configured, query, state.preferences.appLanguage, text.youtubeSearchError]);

  const heading = useMemo(
    () => query.trim() ? text.youtubeSearchResults : text.youtubeTrending,
    [query, text.youtubeSearchResults, text.youtubeTrending],
  );

  if (!Platform.isTV) return null;

  if (!configured) {
    return (
      <View style={styles.empty}>
        <View style={styles.youtubeMark}><Text style={styles.youtubeMarkText}>▶</Text></View>
        <Text style={styles.title}>YouTube</Text>
        <Text style={styles.emptyText}>{text.youtubeNeedsKey}</Text>
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
        ref={listRef}
        data={videos}
        numColumns={4}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        initialNumToRender={12}
        windowSize={7}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          listRef.current?.scrollToOffset({ offset: Math.max(0, Math.floor(index / 4) * averageItemLength), animated: true });
        }}
        renderItem={({ item, index }) => (
          <YouTubeCard
            video={item}
            index={index}
            onFocus={focusedIndex => {
              listRef.current?.scrollToIndex({ index: focusedIndex, viewPosition: 0.55, animated: true });
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
    paddingHorizontal: 52,
    paddingTop: 30,
  },
  empty: {
    flex: 1,
    backgroundColor: theme.background,
    paddingHorizontal: 72,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroText: { flex: 1 },
  youtubeMark: {
    width: 58,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ff0033',
    alignItems: 'center',
    justifyContent: 'center',
  },
  youtubeMarkText: { color: '#fff', fontSize: 20, fontWeight: '900' },
  title: { color: theme.text, fontSize: 40, fontWeight: '900' },
  subtitle: { color: theme.muted, marginTop: 4, fontSize: 15 },
  emptyText: { color: theme.muted, fontSize: 18, lineHeight: 27, maxWidth: 760, marginTop: 14 },
  searchRow: { flexDirection: 'row', gap: 12, marginTop: 24, alignItems: 'center' },
  search: {
    flex: 1,
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingHorizontal: 18,
    color: theme.text,
    fontSize: 18,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 26, marginBottom: 12 },
  sectionTitle: { color: theme.text, fontSize: 24, fontWeight: '900' },
  error: { color: '#fda4af', marginBottom: 12 },
  grid: { paddingBottom: 80 },
  row: { gap: 16, marginBottom: 22 },
  card: {
    flex: 1,
    maxWidth: '25%',
    padding: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    transform: [{ scale: 1 }],
  },
  cardFocused: {
    borderColor: theme.accent,
    backgroundColor: theme.surface,
    transform: [{ scale: 1.035 }],
  },
  thumbnailWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#151a25',
  },
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
  videoTitle: { color: theme.text, fontSize: 16, lineHeight: 21, fontWeight: '800', marginTop: 10 },
  channelTitle: { color: theme.muted, fontSize: 13, marginTop: 5 },
  emptyList: { color: theme.muted, fontSize: 17, paddingVertical: 40 },
});
