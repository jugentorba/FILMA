import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ImageBackground, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { stringsFor } from '../i18n';
import { getMetaCached } from '../services/mediaDiscovery';
import { resolveStreamsAcrossAddons } from '../services/streamResolver';
import { FILMA_ARCHIVE_MANIFEST_URL } from '../services/stremio';
import { useFilma } from '../store/FilmaContext';
import type { MediaItem } from '../types';
import { FocusButton } from './FocusButton';
import { useResponsiveLayout } from './useResponsiveLayout';

type Props = {
  item: MediaItem;
  favorite: boolean;
  knownPlayable?: boolean;
  onPlay(item: MediaItem): void;
  onOpenSources(): void;
  onToggleFavorite(): void;
  onClose(): void;
};

type Availability = 'checking' | 'available' | 'none' | 'unknown';

export function MediaDetailsModal({ item, favorite, knownPlayable = false, onPlay, onOpenSources, onToggleFavorite, onClose }: Props) {
  const { state, updateProgress } = useFilma();
  const layout = useResponsiveLayout();
  const text = stringsFor(state.preferences.appLanguage);
  const [description, setDescription] = useState<string>();
  const [metaLoading, setMetaLoading] = useState(false);
  const [availability, setAvailability] = useState<Availability>('unknown');

  const copy = useMemo(() => state.preferences.appLanguage === 'fr'
    ? {
        movie: 'FILM', series: 'SÉRIE', play: 'Lire', episodes: 'Épisodes',
        checking: 'Recherche de lecture…', available: 'Prêt à lire',
        none: 'Aucune lecture disponible pour le moment', unknown: 'FILMA vérifiera automatiquement au moment de la lecture.',
        retry: 'Rechercher à nouveau', sources: 'Sources avancées',
        noSynopsis: 'Aucun résumé disponible pour le moment.', favorite: 'Dans ma liste', addFavorite: 'Ma liste',
      }
    : state.preferences.appLanguage === 'sq'
      ? {
          movie: 'FILM', series: 'SERIAL', play: 'Luaj', episodes: 'Episodet',
          checking: 'Duke kërkuar luajtjen…', available: 'Gati për luajtje',
          none: 'Nuk ka luajtje të disponueshme për momentin', unknown: 'FILMA do ta kontrollojë automatikisht kur të shtypësh luaj.',
          retry: 'Kërko përsëri', sources: 'Burime të avancuara',
          noSynopsis: 'Nuk ka përshkrim për momentin.', favorite: 'Në listën time', addFavorite: 'Lista ime',
        }
      : {
          movie: 'MOVIE', series: 'SERIES', play: 'Play', episodes: 'Episodes',
          checking: 'Finding playback…', available: 'Ready to play',
          none: 'No playback is available right now', unknown: 'FILMA will check automatically when you press play.',
          retry: 'Search again', sources: 'Advanced sources',
          noSynopsis: 'No synopsis is available yet.', favorite: 'In My List', addFavorite: 'My List',
        }, [state.preferences.appLanguage]);

  const isSeries = item.source?.kind === 'stremio' && item.source.mediaType === 'series' && !item.source.videoId;
  const isArchive = item.source?.kind === 'stremio' && item.source.manifestUrl === FILMA_ARCHIVE_MANIFEST_URL;
  const initiallyPlayable = knownPlayable || Boolean(item.streamUrl) || isArchive || item.source?.kind === 'youtube';

  useEffect(() => {
    if (item.source?.kind !== 'stremio') {
      setDescription(undefined);
      return;
    }
    let cancelled = false;
    setMetaLoading(true);
    void getMetaCached(item.source.manifestUrl, item.source.mediaType, item.source.mediaId)
      .then(meta => { if (!cancelled) setDescription(meta.description?.trim() || undefined); })
      .catch(() => { if (!cancelled) setDescription(undefined); })
      .finally(() => { if (!cancelled) setMetaLoading(false); });
    return () => { cancelled = true; };
  }, [item]);

  const checkAvailability = useCallback(async (force = false) => {
    if (isSeries) {
      setAvailability('unknown');
      return;
    }
    if (initiallyPlayable) {
      setAvailability('available');
      return;
    }
    if (item.source?.kind !== 'stremio') {
      setAvailability('unknown');
      return;
    }

    setAvailability('checking');
    try {
      const resolution = await resolveStreamsAcrossAddons(item, state.addons, state.preferences.preferredAudioLanguages, force);
      setAvailability(resolution.streams.length ? 'available' : 'none');
    } catch {
      setAvailability('unknown');
    }
  }, [initiallyPlayable, isSeries, item, state.addons, state.preferences.preferredAudioLanguages]);

  useEffect(() => {
    void checkAvailability(false);
  }, [checkAvailability]);

  const note = availability === 'checking'
    ? copy.checking
    : availability === 'available'
      ? copy.available
      : availability === 'none'
        ? copy.none
        : copy.unknown;

  const primaryLabel = isSeries
    ? `▶ ${copy.episodes}`
    : availability === 'none'
      ? `↻ ${copy.retry}`
      : `▶ ${copy.play}`;

  const handlePrimary = () => {
    if (availability === 'none' && !isSeries) {
      void checkAvailability(true);
      return;
    }
    onPlay(item);
  };

  const handleFavorite = () => {
    if (!favorite) {
      const existing = state.progress[item.id];
      updateProgress(
        item,
        existing?.positionSeconds ?? 0,
        existing?.durationSeconds ?? item.durationSeconds ?? 0,
      );
    }
    onToggleFavorite();
  };

  const backdrop = item.backdrop || item.poster;
  const meta = [isSeries ? copy.series : copy.movie, item.year, item.genres?.slice(0, 3).join(' · ')].filter(Boolean).join('  •  ');

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} presentationStyle="fullScreen">
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ImageBackground
            source={backdrop ? { uri: backdrop } : undefined}
            style={[styles.hero, { minHeight: layout.isTv ? 500 : layout.isCompactPhone ? 330 : layout.isTablet ? 470 : 390 }]}
            imageStyle={styles.heroImage}
          >
            <View style={styles.heroShade} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={text.dismiss}
              onPress={onClose}
              style={({ pressed }) => [styles.closeButton, { top: layout.isTv ? 24 : 12, right: layout.isTv ? 28 : 12 }, pressed && styles.closePressed]}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>

            <View style={[styles.heroContent, { paddingHorizontal: layout.isTv ? 44 : layout.horizontalPadding, paddingBottom: layout.isTv ? 42 : 25 }]}>
              <Text style={styles.eyebrow}>{meta}</Text>
              <Text numberOfLines={3} style={[styles.title, { fontSize: layout.isTv ? 46 : layout.isCompactPhone ? 30 : layout.isTablet ? 41 : 35 }]}>{item.title}</Text>
              {item.subtitle ? <Text numberOfLines={2} style={styles.subtitle}>{item.subtitle}</Text> : null}
              <View style={styles.heroActions}>
                <FocusButton active preferredFocus label={primaryLabel} onPress={handlePrimary} />
                <FocusButton label={favorite ? `♥ ${copy.favorite}` : `♡ ${copy.addFavorite}`} onPress={handleFavorite} />
              </View>
            </View>
          </ImageBackground>

          <View style={[styles.body, { paddingHorizontal: layout.isTv ? 44 : layout.horizontalPadding, paddingBottom: layout.isTv ? 55 : 42 }]}>
            <View style={styles.availabilityRow}>
              {availability === 'checking' ? <ActivityIndicator size="small" /> : <View style={[styles.statusDot, availability === 'available' && styles.statusDotGood, availability === 'none' && styles.statusDotWarn]} />}
              <Text style={styles.availabilityText}>{note}</Text>
            </View>

            {metaLoading ? (
              <View style={styles.loadingRow}><ActivityIndicator size="small" /><Text style={styles.synopsis}>{text.loading}</Text></View>
            ) : (
              <Text style={[styles.synopsis, { fontSize: layout.isTv ? 17 : 13, lineHeight: layout.isTv ? 26 : 20 }]}>{description || copy.noSynopsis}</Text>
            )}

            {availability === 'none' ? (
              <View style={styles.advancedRow}><FocusButton compact label={copy.sources} onPress={onOpenSources} /></View>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05070b' },
  scrollContent: { minHeight: '100%', backgroundColor: '#05070b' },
  hero: { justifyContent: 'flex-end', backgroundColor: '#11151d' },
  heroImage: { opacity: 0.9 },
  heroShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(2,4,8,0.54)' },
  closeButton: { position: 'absolute', zIndex: 5, width: Platform.isTV ? 52 : 42, height: Platform.isTV ? 52 : 42, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(6,8,12,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  closePressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  closeText: { color: '#fff', fontSize: Platform.isTV ? 30 : 25, lineHeight: Platform.isTV ? 32 : 27, fontWeight: '500' },
  heroContent: { maxWidth: 860 },
  eyebrow: { color: '#c8ced8', fontSize: Platform.isTV ? 13 : 10, fontWeight: '900', letterSpacing: 0.8 },
  title: { color: '#fff', fontWeight: '900', letterSpacing: -1.1, marginTop: 8 },
  subtitle: { color: '#d0d6df', marginTop: 7, fontSize: Platform.isTV ? 14 : 11, fontWeight: '700' },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  body: { maxWidth: 980, gap: 18, paddingTop: 19 },
  availabilityRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 7, height: 7, borderRadius: 99, backgroundColor: '#8c96a8' },
  statusDotGood: { backgroundColor: '#62dfa5' },
  statusDotWarn: { backgroundColor: '#e5a05d' },
  availabilityText: { flex: 1, color: '#8f99aa', fontSize: Platform.isTV ? 13 : 10, fontWeight: '700' },
  synopsis: { color: '#c8cfd9', maxWidth: 900 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  advancedRow: { flexDirection: 'row', paddingTop: 2 },
});
