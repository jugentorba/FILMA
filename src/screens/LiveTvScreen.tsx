import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { fetchPlaylist } from '../services/m3u';
import { useFilma } from '../store/FilmaContext';
import type { LiveChannel, MediaItem } from '../types';
import { FocusButton } from '../ui/FocusButton';
import { theme } from '../ui/theme';

type Props = {
  onSelect(item: MediaItem): void;
  onOpenSettings(): void;
};

export function LiveTvScreen({ onSelect, onOpenSettings }: Props) {
  const { state } = useFilma();
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const refresh = async () => {
    const sources = state.playlists.filter(source => source.enabled);
    if (!sources.length) {
      setChannels([]);
      return;
    }

    setLoading(true);
    setError(undefined);
    const results = await Promise.allSettled(sources.map(source => fetchPlaylist(source.url)));
    const merged = new Map<string, LiveChannel>();
    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const channel of result.value) merged.set(channel.id, channel);
      }
    }
    setChannels([...merged.values()]);
    if (!merged.size && results.some(result => result.status === 'rejected')) {
      setError('No configured playlist could be loaded. Check the playlist URLs in Settings.');
    }
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
    // Reload when configured playlist URLs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.playlists.map(item => `${item.id}:${item.url}:${item.enabled}`).join('|')]);

  const visibleChannels = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return channels;
    return channels.filter(channel =>
      channel.name.toLowerCase().includes(needle) || channel.group?.toLowerCase().includes(needle),
    );
  }, [channels, query]);

  if (!state.playlists.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.title}>Live TV</Text>
        <Text style={styles.emptyText}>
          Add your own legal/public M3U or M3U8 playlist. FILMA will parse it and refresh the channel list automatically.
        </Text>
        <FocusButton label="Open Settings" active onPress={onOpenSettings} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Live TV</Text>
          <Text style={styles.subtitle}>{channels.length} channels from {state.playlists.length} playlist(s)</Text>
        </View>
        <FocusButton compact label="Refresh" onPress={() => void refresh()} />
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search channels or groups"
        placeholderTextColor={theme.muted}
        style={styles.search}
        autoCorrect={false}
      />

      {loading ? <ActivityIndicator size="large" /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={visibleChannels}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <FocusButton
            label={`${item.name}${item.group ? `  ·  ${item.group}` : ''}`}
            style={styles.channel}
            onPress={() => onSelect({
              id: `live:${item.id}`,
              title: item.name,
              subtitle: item.group ?? 'Live TV',
              streamUrl: item.url,
            })}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.background,
    paddingHorizontal: Platform.isTV ? 64 : 20,
    paddingTop: Platform.isTV ? 44 : 24,
  },
  empty: {
    flex: 1,
    paddingHorizontal: Platform.isTV ? 64 : 24,
    alignItems: 'flex-start',
    justifyContent: 'center',
    backgroundColor: theme.background,
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
  },
  title: {
    color: theme.text,
    fontSize: Platform.isTV ? 42 : 30,
    fontWeight: '900',
  },
  subtitle: {
    color: theme.muted,
    fontSize: Platform.isTV ? 16 : 14,
    marginTop: 6,
  },
  emptyText: {
    color: theme.muted,
    maxWidth: 680,
    fontSize: Platform.isTV ? 19 : 16,
    lineHeight: Platform.isTV ? 28 : 24,
  },
  search: {
    marginTop: 24,
    marginBottom: 20,
    minHeight: 52,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    backgroundColor: theme.surface,
    color: theme.text,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  list: {
    paddingBottom: 80,
    gap: 10,
  },
  channel: {
    width: '100%',
    alignItems: 'flex-start',
  },
  error: {
    color: '#fda4af',
    marginBottom: 14,
  },
});
