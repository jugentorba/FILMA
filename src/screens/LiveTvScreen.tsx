import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { fetchPlaylist, mergeLiveChannels } from '../services/m3u';
import { useFilma } from '../store/FilmaContext';
import type { LiveChannel, MediaItem } from '../types';
import { FocusButton } from '../ui/FocusButton';
import { theme } from '../ui/theme';

type Props = {
  onSelect(item: MediaItem): void;
  onOpenSettings(): void;
};

type SourceHealth = {
  id: string;
  name: string;
  ok: boolean;
  channelCount: number;
  checkedAt: string;
  error?: string;
};

type ChannelCardProps = {
  channel: LiveChannel;
  index: number;
  onFocus(index: number): void;
  onPress(): void;
};

const AUTO_REFRESH_MS = 5 * 60 * 1000;

function ChannelCard({ channel, index, onFocus, onPress }: ChannelCardProps) {
  const [focused, setFocused] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const backupCount = channel.alternateUrls?.length ?? 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={channel.name}
      focusable
      hasTVPreferredFocus={Platform.isTV && index === 0}
      onFocus={() => {
        setFocused(true);
        onFocus(index);
      }}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={[styles.channelCard, focused && styles.channelCardFocused]}
    >
      <View style={styles.logoPanel}>
        {channel.logo && !logoFailed ? (
          <Image source={{ uri: channel.logo }} style={styles.logo} resizeMode="contain" onError={() => setLogoFailed(true)} />
        ) : (
          <View style={styles.logoFallback}>
            <Text style={styles.logoFallbackText}>{channel.name.slice(0, 2).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>LIVE</Text></View>
        {backupCount > 0 ? (
          <View style={styles.backupBadge}><Text style={styles.backupBadgeText}>+{backupCount}</Text></View>
        ) : null}
      </View>
      <Text numberOfLines={2} style={styles.channelName}>{channel.name}</Text>
      <Text numberOfLines={1} style={styles.channelGroup}>{channel.group || 'FILMA TV'}</Text>
    </Pressable>
  );
}

export function LiveTvScreen({ onSelect, onOpenSettings }: Props) {
  const { state } = useFilma();
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [query, setQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [sourceHealth, setSourceHealth] = useState<SourceHealth[]>([]);
  const groupListRef = useRef<FlatList<{ name: string; count: number }>>(null);
  const channelListRef = useRef<FlatList<LiveChannel>>(null);
  const columns = Platform.isTV ? 4 : 2;

  const copy = useMemo(() => state.preferences.appLanguage === 'fr'
    ? {
        title: 'TV en direct',
        addSource: 'Ajoutez votre propre playlist M3U ou M3U8 légale/publique. FILMA la lira et actualisera automatiquement la liste des chaînes.',
        openSettings: 'Ouvrir les réglages',
        refreshing: 'Actualisation…',
        refresh: 'Actualiser',
        channels: 'chaînes',
        sourcesOnline: 'sources en ligne',
        search: 'Rechercher des chaînes ou groupes',
        all: 'Toutes',
        noMatch: 'Aucune chaîne ne correspond à ce filtre.',
        noSource: 'Aucune playlist configurée n’a pu être chargée. Vérifiez les URL dans les Réglages.',
        unavailable: (count: number, working: number) => `${count} playlist${count === 1 ? '' : 's'} indisponible${count === 1 ? '' : 's'}. FILMA affiche les chaînes des ${working} source${working === 1 ? '' : 's'} disponible${working === 1 ? '' : 's'}.`,
      }
    : state.preferences.appLanguage === 'sq'
      ? {
          title: 'TV Live',
          addSource: 'Shto playlistën tënde ligjore/publike M3U ose M3U8. FILMA do ta lexojë dhe do ta rifreskojë automatikisht listën e kanaleve.',
          openSettings: 'Hap cilësimet',
          refreshing: 'Duke rifreskuar…',
          refresh: 'Rifresko',
          channels: 'kanale',
          sourcesOnline: 'burime online',
          search: 'Kërko kanale ose grupe',
          all: 'Të gjitha',
          noMatch: 'Asnjë kanal nuk përputhet me këtë filtër.',
          noSource: 'Asnjë playlistë e konfiguruar nuk u ngarkua. Kontrollo URL-të te Cilësimet.',
          unavailable: (count: number, working: number) => `${count} playlist${count === 1 ? 'ë' : 'a'} nuk është e disponueshme. FILMA po shfaq kanalet nga ${working} burim${working === 1 ? '' : 'e'} që funksionojnë.`,
        }
      : {
          title: 'Live TV',
          addSource: 'Add your own legal/public M3U or M3U8 playlist. FILMA will parse it and refresh the channel list automatically.',
          openSettings: 'Open Settings',
          refreshing: 'Refreshing…',
          refresh: 'Refresh',
          channels: 'channels',
          sourcesOnline: 'sources online',
          search: 'Search channels or groups',
          all: 'All',
          noMatch: 'No channels match this filter.',
          noSource: 'No configured playlist could be loaded. Check the playlist URLs in Settings.',
          unavailable: (count: number, working: number) => `${count} playlist${count === 1 ? '' : 's'} unavailable. FILMA is showing channels from ${working} working source${working === 1 ? '' : 's'}.`,
        }, [state.preferences.appLanguage]);

  const activePlaylists = useMemo(
    () => state.playlists.filter(source => source.enabled && !source.deletedAt),
    [state.playlists],
  );

  const refresh = useCallback(async () => {
    if (!activePlaylists.length) {
      setChannels([]);
      setSourceHealth([]);
      setError(undefined);
      return;
    }

    setLoading(true);
    setError(undefined);

    const results = await Promise.all(activePlaylists.map(async source => {
      try {
        const loaded = await fetchPlaylist(source.url);
        return {
          source,
          channels: loaded,
          health: {
            id: source.id,
            name: source.name,
            ok: true,
            channelCount: loaded.length,
            checkedAt: new Date().toISOString(),
          } satisfies SourceHealth,
        };
      } catch (reason) {
        return {
          source,
          channels: [] as LiveChannel[],
          health: {
            id: source.id,
            name: source.name,
            ok: false,
            channelCount: 0,
            checkedAt: new Date().toISOString(),
            error: reason instanceof Error ? reason.message : 'Could not load playlist.',
          } satisfies SourceHealth,
        };
      }
    }));

    const health = results.map(result => result.health);
    const failed = health.filter(item => !item.ok);
    const nextChannels = mergeLiveChannels(results.map(result => result.channels))
      .sort((a, b) => a.name.localeCompare(b.name));

    setSourceHealth(health);
    setChannels(nextChannels);
    if (!nextChannels.length) {
      setError(copy.noSource);
    } else if (failed.length) {
      setError(copy.unavailable(failed.length, health.length - failed.length));
    }
    setLoading(false);
  }, [activePlaylists, copy]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!activePlaylists.length) return;
    const timer = setInterval(() => {
      void refresh();
    }, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [activePlaylists.length, refresh]);

  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const channel of channels) {
      const group = channel.group?.trim();
      if (group) counts.set(group, (counts.get(group) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [channels]);

  useEffect(() => {
    if (selectedGroup !== 'all' && !groups.some(group => group.name === selectedGroup)) {
      setSelectedGroup('all');
    }
  }, [groups, selectedGroup]);

  const visibleChannels = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return channels.filter(channel => {
      if (selectedGroup !== 'all' && channel.group !== selectedGroup) return false;
      if (!needle) return true;
      return channel.name.toLocaleLowerCase().includes(needle)
        || channel.group?.toLocaleLowerCase().includes(needle);
    });
  }, [channels, query, selectedGroup]);

  const groupItems = useMemo(
    () => [{ name: 'all', count: channels.length }, ...groups],
    [channels.length, groups],
  );
  const healthySources = sourceHealth.filter(item => item.ok).length;

  if (!activePlaylists.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.emptyText}>{copy.addSource}</Text>
        <FocusButton label={copy.openSettings} active preferredFocus onPress={onOpenSettings} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>
            {channels.length} {copy.channels} · {healthySources}/{activePlaylists.length} {copy.sourcesOnline}
          </Text>
        </View>
        <FocusButton compact label={loading ? copy.refreshing : copy.refresh} onPress={() => void refresh()} />
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={copy.search}
        placeholderTextColor={theme.muted}
        style={styles.search}
        autoCorrect={false}
        autoCapitalize="none"
      />

      <FlatList
        ref={groupListRef}
        horizontal
        data={groupItems}
        keyExtractor={item => item.name}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.groupRow}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          groupListRef.current?.scrollToOffset({ offset: Math.max(0, index * averageItemLength), animated: true });
        }}
        renderItem={({ item, index }) => (
          <FocusButton
            compact
            label={`${item.name === 'all' ? copy.all : item.name} (${item.count})`}
            active={selectedGroup === item.name}
            preferredFocus={item.name === 'all'}
            onFocus={() => {
              if (Platform.isTV) {
                groupListRef.current?.scrollToIndex({ index, viewPosition: 0.3, animated: true });
              }
            }}
            onPress={() => {
              setSelectedGroup(item.name);
              channelListRef.current?.scrollToOffset({ offset: 0, animated: false });
            }}
          />
        )}
      />

      {loading && !channels.length ? <ActivityIndicator size="large" style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        key={`live-grid-${columns}`}
        ref={channelListRef}
        data={visibleChannels}
        numColumns={columns}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.channelGridRow}
        initialNumToRender={Platform.isTV ? 16 : 10}
        windowSize={Platform.isTV ? 9 : 6}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          channelListRef.current?.scrollToOffset({ offset: Math.max(0, Math.floor(index / columns) * averageItemLength), animated: true });
        }}
        renderItem={({ item, index }) => (
          <ChannelCard
            channel={item}
            index={index}
            onFocus={focusedIndex => {
              if (Platform.isTV) {
                channelListRef.current?.scrollToIndex({ index: focusedIndex, viewPosition: 0.48, animated: true });
              }
            }}
            onPress={() => onSelect({
              id: `live:${item.id}`,
              title: item.name,
              subtitle: item.group ?? copy.title,
              poster: item.logo,
              streamUrl: item.url,
              alternateStreamUrls: item.alternateUrls,
            })}
          />
        )}
        ListEmptyComponent={<Text style={styles.emptyList}>{copy.noMatch}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.background,
    paddingHorizontal: Platform.isTV ? 58 : 16,
    paddingTop: Platform.isTV ? 32 : 18,
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
  headerText: { flex: 1 },
  title: {
    color: theme.text,
    fontSize: Platform.isTV ? 42 : 30,
    fontWeight: '900',
    letterSpacing: -0.8,
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
    marginTop: 20,
    marginBottom: 10,
    minHeight: Platform.isTV ? 58 : 52,
    borderWidth: 1,
    borderColor: '#323b50',
    borderRadius: 16,
    backgroundColor: '#121724',
    color: theme.text,
    paddingHorizontal: 16,
    fontSize: Platform.isTV ? 18 : 16,
  },
  groupRow: {
    gap: 10,
    paddingVertical: 10,
    paddingRight: 20,
  },
  loader: { marginTop: 40 },
  list: {
    paddingTop: 12,
    paddingBottom: Platform.isTV ? 80 : 110,
  },
  channelGridRow: {
    gap: Platform.isTV ? 16 : 10,
    marginBottom: Platform.isTV ? 20 : 14,
  },
  channelCard: {
    width: Platform.isTV ? '23.6%' : '48.5%',
    padding: Platform.isTV ? 8 : 5,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: theme.surface,
  },
  channelCardFocused: {
    borderColor: theme.accent,
    backgroundColor: theme.surfaceRaised,
    transform: [{ scale: 1.035 }],
    zIndex: 2,
  },
  logoPanel: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f4f6fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: '78%', height: '78%' },
  logoFallback: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#171d2b' },
  logoFallbackText: { color: '#e5e9f1', fontSize: Platform.isTV ? 34 : 24, fontWeight: '900', letterSpacing: -1 },
  liveBadge: {
    position: 'absolute',
    left: 8,
    top: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: theme.accent,
  },
  liveBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  backupBadge: {
    position: 'absolute',
    right: 8,
    top: 8,
    minWidth: 26,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,8,14,0.78)',
  },
  backupBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  channelName: {
    color: theme.text,
    fontSize: Platform.isTV ? 17 : 14,
    lineHeight: Platform.isTV ? 21 : 18,
    minHeight: Platform.isTV ? 42 : 36,
    fontWeight: '850',
    marginTop: 10,
  },
  channelGroup: { color: theme.muted, fontSize: 11, marginTop: 3, marginBottom: 3, fontWeight: '700' },
  error: {
    color: '#fda4af',
    marginVertical: 10,
  },
  emptyList: {
    color: theme.muted,
    paddingVertical: 34,
    textAlign: 'center',
  },
});