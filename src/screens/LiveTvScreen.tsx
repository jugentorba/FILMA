import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { fetchPlaylist, mergeLiveChannels } from '../services/m3u';
import { useFilma } from '../store/FilmaContext';
import type { LiveChannel, MediaItem } from '../types';
import { FocusButton } from '../ui/FocusButton';
import { PlayerModal } from '../ui/PlayerModal';
import { theme } from '../ui/theme';
import { useResponsiveLayout } from '../ui/useResponsiveLayout';

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

type ChannelRowProps = {
  channel: LiveChannel;
  index: number;
  onFocus(index: number): void;
  onPress(): void;
};

const AUTO_REFRESH_MS = 5 * 60 * 1000;

function asMediaItem(channel: LiveChannel): MediaItem {
  return {
    id: `live:${channel.id}`,
    title: channel.name,
    subtitle: [channel.group, channel.country].filter(Boolean).join(' · ') || 'Live TV',
    poster: channel.logo,
    streamUrl: channel.url,
    alternateStreamUrls: channel.alternateUrls,
  };
}

function ChannelRow({ channel, index, onFocus, onPress }: ChannelRowProps) {
  const [focused, setFocused] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const backupCount = channel.alternateUrls?.length ?? 0;
  const layout = useResponsiveLayout();

  const rowSize = useMemo(() => {
    const logo = layout.isTv ? 52 : layout.isCompactPhone ? 38 : layout.isTablet ? 48 : 42;
    return {
      row: {
        minHeight: layout.isTv ? 68 : layout.isCompactPhone ? 52 : layout.isTablet ? 64 : 56,
        paddingHorizontal: layout.isTv ? 12 : 8,
        paddingVertical: layout.isCompactPhone ? 5 : 6,
        borderRadius: layout.isTv ? 14 : 12,
      },
      logo: {
        width: logo,
        height: logo,
        borderRadius: layout.isTv ? 11 : 9,
        marginRight: layout.isCompactPhone ? 8 : 10,
      },
      name: {
        fontSize: layout.isTv ? 17 : layout.isCompactPhone ? 13 : layout.isTablet ? 16 : 14,
      },
      meta: {
        fontSize: layout.isTv ? 12 : layout.isCompactPhone ? 10 : 11,
        marginTop: 2,
      },
      chevron: { fontSize: layout.isTv ? 24 : 20 },
    };
  }, [layout.isCompactPhone, layout.isTablet, layout.isTv]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={channel.name}
      focusable
      onFocus={() => {
        setFocused(true);
        onFocus(index);
      }}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={[styles.channelRow, rowSize.row, focused && styles.channelRowFocused]}
    >
      <View style={[styles.logoBox, rowSize.logo]}>
        {channel.logo && !logoFailed ? (
          <Image source={{ uri: channel.logo }} style={styles.logo} resizeMode="contain" onError={() => setLogoFailed(true)} />
        ) : (
          <Text style={styles.logoFallback}>{channel.name.slice(0, 2).toUpperCase()}</Text>
        )}
      </View>

      <View style={styles.channelText}>
        <Text numberOfLines={1} style={[styles.channelName, rowSize.name]}>{channel.name}</Text>
        <Text numberOfLines={1} style={[styles.channelMeta, rowSize.meta]}>
          {[channel.group, channel.country].filter(Boolean).join(' · ') || 'FILMA TV'}
        </Text>
      </View>

      <View style={styles.rowBadges}>
        {backupCount ? <Text style={styles.backupBadge}>+{backupCount}</Text> : null}
        <Text style={styles.liveBadge}>LIVE</Text>
        <Text style={[styles.chevron, rowSize.chevron]}>›</Text>
      </View>
    </Pressable>
  );
}

export function LiveTvScreen({ onOpenSettings }: Props) {
  const { state } = useFilma();
  const layout = useResponsiveLayout();
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [query, setQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('Albania');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [sourceHealth, setSourceHealth] = useState<SourceHealth[]>([]);
  const [playingChannel, setPlayingChannel] = useState<LiveChannel | null>(null);
  const [playbackQueue, setPlaybackQueue] = useState<LiveChannel[]>([]);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const countryListRef = useRef<FlatList<{ name: string; count: number }>>(null);
  const groupListRef = useRef<FlatList<{ name: string; count: number }>>(null);
  const channelListRef = useRef<FlatList<LiveChannel>>(null);

  const copy = useMemo(() => state.preferences.appLanguage === 'fr'
    ? {
        title: 'TV en direct',
        combinedAlbania: 'Albanie regroupe les chaînes d’Albanie et du Kosovo.',
        addSource: 'Ajoutez votre propre playlist M3U ou M3U8 légale/publique. FILMA la lira et actualisera automatiquement la liste des chaînes.',
        openSettings: 'Ouvrir les réglages',
        refreshing: 'Actualisation…',
        refresh: 'Actualiser',
        channels: 'chaînes',
        sourcesOnline: 'sources en ligne',
        search: 'Rechercher une chaîne',
        all: 'Toutes',
        noMatch: 'Aucune chaîne ne correspond à ce filtre.',
        noSource: 'Aucune playlist configurée n’a pu être chargée. Vérifiez les URL dans les Réglages.',
        unavailable: (count: number, working: number) => `${count} playlist${count === 1 ? '' : 's'} indisponible${count === 1 ? '' : 's'}. FILMA utilise ${working} source${working === 1 ? '' : 's'} disponible${working === 1 ? '' : 's'}.`,
      }
    : state.preferences.appLanguage === 'sq'
      ? {
          title: 'TV Live',
          combinedAlbania: 'Shqipëria përfshin kanalet e Shqipërisë dhe Kosovës.',
          addSource: 'Shto playlistën tënde ligjore/publike M3U ose M3U8. FILMA do ta lexojë dhe do ta rifreskojë automatikisht listën e kanaleve.',
          openSettings: 'Hap cilësimet',
          refreshing: 'Duke rifreskuar…',
          refresh: 'Rifresko',
          channels: 'kanale',
          sourcesOnline: 'burime online',
          search: 'Kërko një kanal',
          all: 'Të gjitha',
          noMatch: 'Asnjë kanal nuk përputhet me këtë filtër.',
          noSource: 'Asnjë playlistë e konfiguruar nuk u ngarkua. Kontrollo URL-të te Cilësimet.',
          unavailable: (count: number, working: number) => `${count} playlist${count === 1 ? 'ë' : 'a'} nuk është e disponueshme. FILMA po përdor ${working} burim${working === 1 ? '' : 'e'} që funksionojnë.`,
        }
      : {
          title: 'Live TV',
          combinedAlbania: 'Albania includes channels from both Albania and Kosovo.',
          addSource: 'Add your own legal/public M3U or M3U8 playlist. FILMA will parse it and refresh the channel list automatically.',
          openSettings: 'Open Settings',
          refreshing: 'Refreshing…',
          refresh: 'Refresh',
          channels: 'channels',
          sourcesOnline: 'sources online',
          search: 'Search a channel',
          all: 'All',
          noMatch: 'No channels match this filter.',
          noSource: 'No configured playlist could be loaded. Check the playlist URLs in Settings.',
          unavailable: (count: number, working: number) => `${count} playlist${count === 1 ? '' : 's'} unavailable. FILMA is using ${working} working source${working === 1 ? '' : 's'}.`,
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
        const country = source.countryGroup || source.countryName || 'Other';
        const enriched = loaded.map(channel => ({
          ...channel,
          country,
          countryCode: source.countryCode,
          sourceName: source.name,
        }));
        return {
          channels: enriched,
          health: {
            id: source.id,
            name: source.name,
            ok: true,
            channelCount: enriched.length,
            checkedAt: new Date().toISOString(),
          } satisfies SourceHealth,
        };
      } catch (reason) {
        return {
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

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!activePlaylists.length) return;
    const timer = setInterval(() => { void refresh(); }, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [activePlaylists.length, refresh]);

  const countries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const channel of channels) {
      const country = channel.country?.trim() || 'Other';
      counts.set(country, (counts.get(country) ?? 0) + 1);
    }
    const priority = (name: string) => name === 'Albania' ? 0 : name === 'France' ? 1 : 2;
    return [...counts.entries()]
      .sort((a, b) => priority(a[0]) - priority(b[0]) || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [channels]);

  useEffect(() => {
    if (!countries.length) return;
    if (!countries.some(country => country.name === selectedCountry)) {
      setSelectedCountry(countries[0].name);
      setSelectedGroup('all');
    }
  }, [countries, selectedCountry]);

  const countryChannels = useMemo(
    () => channels.filter(channel => (channel.country || 'Other') === selectedCountry),
    [channels, selectedCountry],
  );

  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const channel of countryChannels) {
      const group = channel.group?.trim();
      if (group) counts.set(group, (counts.get(group) ?? 0) + 1);
    }
    const sportsFirst = (name: string) => /sport/i.test(name) ? 0 : 1;
    return [...counts.entries()]
      .sort((a, b) => sportsFirst(a[0]) - sportsFirst(b[0]) || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [countryChannels]);

  useEffect(() => {
    if (selectedGroup !== 'all' && !groups.some(group => group.name === selectedGroup)) {
      setSelectedGroup('all');
    }
  }, [groups, selectedGroup]);

  const visibleChannels = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return countryChannels.filter(channel => {
      if (selectedGroup !== 'all' && channel.group !== selectedGroup) return false;
      if (!needle) return true;
      return channel.name.toLocaleLowerCase().includes(needle)
        || channel.group?.toLocaleLowerCase().includes(needle);
    });
  }, [countryChannels, query, selectedGroup]);

  const groupItems = useMemo(
    () => [{ name: 'all', count: countryChannels.length }, ...groups],
    [countryChannels.length, groups],
  );
  const healthySources = sourceHealth.filter(item => item.ok).length;

  const openChannel = (channel: LiveChannel, index: number) => {
    setPlaybackQueue(visibleChannels);
    setPlaybackIndex(index);
    setPlayingChannel(channel);
  };

  const selectChannelAt = (index: number) => {
    const channel = playbackQueue[index];
    if (!channel) return;
    setPlaybackIndex(index);
    setPlayingChannel(channel);
  };

  const zapChannel = (delta: number) => {
    if (!playbackQueue.length) return;
    const nextIndex = (playbackIndex + delta + playbackQueue.length) % playbackQueue.length;
    selectChannelAt(nextIndex);
  };

  const screenStyle = useMemo(() => ({
    paddingHorizontal: layout.horizontalPadding,
    paddingTop: layout.isTv ? 24 : layout.isCompactPhone ? 10 : 14,
  }), [layout.horizontalPadding, layout.isCompactPhone, layout.isTv]);

  const titleStyle = useMemo(() => ({
    fontSize: layout.isTv ? 34 : layout.isCompactPhone ? 24 : layout.isTablet ? 30 : 26,
  }), [layout.isCompactPhone, layout.isTablet, layout.isTv]);

  const searchStyle = useMemo(() => ({
    minHeight: layout.isTv ? 48 : layout.isCompactPhone ? 40 : 44,
    fontSize: layout.isTv ? 16 : layout.isCompactPhone ? 13 : 14,
    borderRadius: layout.isCompactPhone ? 11 : 13,
    paddingHorizontal: layout.isCompactPhone ? 11 : 13,
  }), [layout.isCompactPhone, layout.isTv]);

  if (!activePlaylists.length) {
    return (
      <View style={[styles.empty, { paddingHorizontal: layout.horizontalPadding }]}>
        <Text style={[styles.title, titleStyle]}>{copy.title}</Text>
        <Text style={styles.emptyText}>{copy.addSource}</Text>
        <FocusButton label={copy.openSettings} active preferredFocus onPress={onOpenSettings} />
      </View>
    );
  }

  return (
    <View style={[styles.root, screenStyle]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, titleStyle]}>{copy.title}</Text>
          <Text style={styles.subtitle}>
            {channels.length} {copy.channels} · {healthySources}/{activePlaylists.length} {copy.sourcesOnline}
          </Text>
        </View>
        <FocusButton compact label={loading ? copy.refreshing : copy.refresh} onPress={() => void refresh()} />
      </View>

      <FlatList
        ref={countryListRef}
        horizontal
        data={countries}
        keyExtractor={item => item.name}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.countryRow}
        renderItem={({ item, index }) => (
          <FocusButton
            compact
            label={`${item.name} (${item.count})`}
            active={selectedCountry === item.name}
            preferredFocus={item.name === 'Albania'}
            onFocus={() => {
              if (Platform.isTV) countryListRef.current?.scrollToIndex({ index, viewPosition: 0.3, animated: true });
            }}
            onPress={() => {
              setSelectedCountry(item.name);
              setSelectedGroup('all');
              channelListRef.current?.scrollToOffset({ offset: 0, animated: false });
            }}
          />
        )}
      />

      {selectedCountry === 'Albania' ? <Text style={styles.countryHint}>{copy.combinedAlbania}</Text> : null}

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={copy.search}
        placeholderTextColor={theme.muted}
        style={[styles.search, searchStyle]}
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
        renderItem={({ item, index }) => (
          <FocusButton
            compact
            label={`${item.name === 'all' ? copy.all : item.name} (${item.count})`}
            active={selectedGroup === item.name}
            onFocus={() => {
              if (Platform.isTV) groupListRef.current?.scrollToIndex({ index, viewPosition: 0.3, animated: true });
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
        ref={channelListRef}
        data={visibleChannels}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        initialNumToRender={Platform.isTV ? 20 : 12}
        windowSize={Platform.isTV ? 10 : 7}
        renderItem={({ item, index }) => (
          <ChannelRow
            channel={item}
            index={index}
            onFocus={focusedIndex => {
              if (Platform.isTV) channelListRef.current?.scrollToIndex({ index: focusedIndex, viewPosition: 0.45, animated: true });
            }}
            onPress={() => openChannel(item, index)}
          />
        )}
        ListEmptyComponent={<Text style={styles.emptyList}>{copy.noMatch}</Text>}
      />

      {playingChannel ? (
        <PlayerModal
          key={playingChannel.id}
          item={asMediaItem(playingChannel)}
          favorite={false}
          onProgress={() => undefined}
          onToggleFavorite={() => undefined}
          onClose={() => setPlayingChannel(null)}
          onPreviousChannel={() => zapChannel(-1)}
          onNextChannel={() => zapChannel(1)}
          channelPosition={`${playbackIndex + 1}/${playbackQueue.length}`}
          channelQueue={playbackQueue}
          channelIndex={playbackIndex}
          onSelectChannel={selectChannelAt}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.background,
  },
  empty: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    backgroundColor: theme.background,
    gap: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerText: { flex: 1 },
  title: { color: theme.text, fontWeight: '900', letterSpacing: -0.7 },
  subtitle: { color: theme.muted, fontSize: Platform.isTV ? 14 : 12, marginTop: 4 },
  emptyText: { color: theme.muted, maxWidth: 680, fontSize: Platform.isTV ? 17 : 14, lineHeight: Platform.isTV ? 24 : 21 },
  countryRow: { gap: 7, paddingTop: 12, paddingBottom: 6, paddingRight: 14 },
  countryHint: { color: theme.muted, fontSize: 11, marginBottom: 1 },
  search: {
    marginTop: 7,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#323b50',
    backgroundColor: '#121724',
    color: theme.text,
  },
  groupRow: { gap: 6, paddingVertical: 7, paddingRight: 14 },
  loader: { marginTop: 30 },
  list: { paddingTop: 6, paddingBottom: Platform.isTV ? 70 : 96, gap: 6 },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f2635',
    backgroundColor: '#101521',
  },
  channelRowFocused: { borderColor: theme.accent, backgroundColor: '#161c2a', transform: [{ scale: 1.008 }] },
  logoBox: {
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: { width: '86%', height: '86%' },
  logoFallback: { color: '#111827', fontSize: 13, fontWeight: '900' },
  channelText: { flex: 1, minWidth: 0 },
  channelName: { color: theme.text, fontWeight: '800' },
  channelMeta: { color: theme.muted },
  rowBadges: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 7 },
  liveBadge: { color: '#fff', backgroundColor: '#dc264f', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, fontSize: 9, fontWeight: '900' },
  backupBadge: { color: theme.text, backgroundColor: '#252d3d', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, fontSize: 9, fontWeight: '800' },
  chevron: { color: theme.muted, marginLeft: 1 },
  error: { color: '#fda4af', marginVertical: 6, fontSize: 12 },
  emptyList: { color: theme.muted, paddingVertical: 24, textAlign: 'center' },
});
