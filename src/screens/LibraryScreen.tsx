import React, { useMemo, useRef } from 'react';
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { shouldShowInContinueWatching } from '../services/progress';
import { useFilma } from '../store/FilmaContext';
import type { MediaItem } from '../types';
import { MediaCard } from '../ui/MediaCard';
import { useResponsiveLayout } from '../ui/useResponsiveLayout';

type Props = {
  onSelect(item: MediaItem): void;
  onOpenLiveTv(): void;
};

function copyFor(language: 'en' | 'fr' | 'sq') {
  if (language === 'fr') return { title: 'Bibliothèque', continue: 'Continuer à regarder', list: 'Ma liste', live: 'TV en direct', liveHelp: 'Ouvrir vos chaînes TV', empty: 'Votre bibliothèque se remplira à mesure que vous regardez et ajoutez des titres.' };
  if (language === 'sq') return { title: 'Biblioteka', continue: 'Vazhdo shikimin', list: 'Lista ime', live: 'TV Live', liveHelp: 'Hap kanalet e tua TV', empty: 'Biblioteka do të mbushet ndërsa shikon dhe shton tituj.' };
  return { title: 'Library', continue: 'Continue Watching', list: 'My List', live: 'Live TV', liveHelp: 'Open your TV channels', empty: 'Your library will fill up as you watch and save titles.' };
}

function MediaRow({ title, items, onSelect }: { title: string; items: MediaItem[]; onSelect(item: MediaItem): void }) {
  const { state } = useFilma();
  const layout = useResponsiveLayout();
  const listRef = useRef<FlatList<MediaItem>>(null);
  if (!items.length) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { paddingHorizontal: layout.horizontalPadding }]}>{title}</Text>
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
            onFocus={() => {
              if (Platform.isTV) listRef.current?.scrollToIndex({ index, viewPosition: 0.35, animated: true });
            }}
            onPress={() => onSelect(item)}
          />
        )}
      />
    </View>
  );
}

export function LibraryScreen({ onSelect, onOpenLiveTv }: Props) {
  const { state } = useFilma();
  const layout = useResponsiveLayout();
  const copy = useMemo(() => copyFor(state.preferences.appLanguage), [state.preferences.appLanguage]);

  const savedSnapshots = useMemo(() => {
    const byId = new Map<string, MediaItem>();
    for (const progress of Object.values(state.progress)) {
      if (progress.item) byId.set(progress.mediaId, progress.item as MediaItem);
    }
    return byId;
  }, [state.progress]);

  const continueWatching = useMemo(() => Object.values(state.progress)
    .filter(progress => Boolean(progress.item) && shouldShowInContinueWatching(progress))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map(progress => progress.item as MediaItem), [state.progress]);

  const favorites = useMemo(() => Object.values(state.favorites)
    .filter(entry => !entry.deletedAt)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .flatMap(entry => {
      const item = savedSnapshots.get(entry.mediaId);
      return item ? [item] : [];
    }), [savedSnapshots, state.favorites]);

  const hasMedia = continueWatching.length > 0 || favorites.length > 0;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
      <View style={{ paddingHorizontal: layout.horizontalPadding, paddingTop: layout.isTv ? 28 : 20 }}>
        <Text style={[styles.title, { fontSize: layout.isTv ? 42 : layout.isTablet ? 38 : 34 }]}>{copy.title}</Text>
      </View>

      <MediaRow title={copy.continue} items={continueWatching} onSelect={onSelect} />
      <MediaRow title={copy.list} items={favorites} onSelect={onSelect} />

      <View style={[styles.shortcuts, { paddingHorizontal: layout.horizontalPadding }]}>
        <Pressable accessibilityRole="button" onPress={onOpenLiveTv} style={({ pressed }) => [styles.shortcut, pressed && styles.shortcutPressed]}>
          <View style={styles.shortcutIcon}><Text style={styles.shortcutIconText}>▣</Text></View>
          <View style={styles.shortcutText}>
            <Text style={styles.shortcutTitle}>{copy.live}</Text>
            <Text style={styles.shortcutHelp}>{copy.liveHelp}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>

      {!hasMedia ? <Text style={[styles.empty, { paddingHorizontal: layout.horizontalPadding }]}>{copy.empty}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080808' },
  title: { color: '#f6f6f7', fontWeight: '900', letterSpacing: -1.2, marginBottom: 8 },
  section: { paddingTop: 24 },
  sectionTitle: { color: '#f4f4f5', fontSize: 21, fontWeight: '900', marginBottom: 12 },
  shortcuts: { paddingTop: 26 },
  shortcut: { minHeight: 76, borderRadius: 18, backgroundColor: '#1b1b1c', borderWidth: 1, borderColor: '#2a2a2c', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 13 },
  shortcutPressed: { opacity: 0.75 },
  shortcutIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#343436', alignItems: 'center', justifyContent: 'center' },
  shortcutIconText: { color: '#fff', fontSize: 21, fontWeight: '900' },
  shortcutText: { flex: 1 },
  shortcutTitle: { color: '#f7f7f8', fontSize: 17, fontWeight: '800' },
  shortcutHelp: { color: '#96989e', fontSize: 12, marginTop: 3 },
  chevron: { color: '#a4a6ac', fontSize: 30, fontWeight: '300' },
  empty: { color: '#85878d', fontSize: 14, lineHeight: 20, marginTop: 24 },
});
