import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ImageBackground, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { stringsFor } from '../i18n';
import { getMetaCached } from '../services/mediaDiscovery';
import { FILMA_ARCHIVE_MANIFEST_URL } from '../services/stremio';
import { useFilma } from '../store/FilmaContext';
import type { MediaItem } from '../types';
import { FocusButton } from './FocusButton';
import { theme } from './theme';
import { useResponsiveLayout } from './useResponsiveLayout';

type Props = {
  item: MediaItem;
  favorite: boolean;
  knownPlayable?: boolean;
  onPlay(item: MediaItem): void;
  onToggleFavorite(): void;
  onClose(): void;
};

export function MediaDetailsModal({ item, favorite, knownPlayable = false, onPlay, onToggleFavorite, onClose }: Props) {
  const { state } = useFilma();
  const layout = useResponsiveLayout();
  const text = stringsFor(state.preferences.appLanguage);
  const [description, setDescription] = useState<string>();
  const [metaLoading, setMetaLoading] = useState(false);

  const copy = useMemo(() => state.preferences.appLanguage === 'fr'
    ? {
        movie: 'FILM', series: 'SÉRIE', play: 'Lire dans FILMA', episodes: 'Voir les épisodes',
        check: 'Vérifier les sources', available: 'Lecture directe disponible',
        catalog: 'Titre de catalogue · FILMA vérifiera tes sources avant de lancer la lecture.',
        noSynopsis: 'Aucun résumé disponible pour le moment.', favorite: 'Dans ma liste', addFavorite: 'Ajouter à ma liste',
      }
    : state.preferences.appLanguage === 'sq'
      ? {
          movie: 'FILM', series: 'SERIAL', play: 'Luaj në FILMA', episodes: 'Shiko episodet',
          check: 'Kontrollo burimet', available: 'Ka transmetim direkt',
          catalog: 'Titull katalogu · FILMA do të kontrollojë burimet para luajtjes.',
          noSynopsis: 'Nuk ka përshkrim për momentin.', favorite: 'Në listën time', addFavorite: 'Shto në listën time',
        }
      : {
          movie: 'MOVIE', series: 'SERIES', play: 'Play in FILMA', episodes: 'View episodes',
          check: 'Check sources', available: 'Direct playback available',
          catalog: 'Catalogue title · FILMA will check your providers before playback.',
          noSynopsis: 'No synopsis is available yet.', favorite: 'In My List', addFavorite: 'Add to My List',
        }, [state.preferences.appLanguage]);

  const isSeries = item.source?.kind === 'stremio' && item.source.mediaType === 'series' && !item.source.videoId;
  const isArchive = item.source?.kind === 'stremio' && item.source.manifestUrl === FILMA_ARCHIVE_MANIFEST_URL;
  const direct = knownPlayable || Boolean(item.streamUrl) || isArchive || item.source?.kind === 'youtube';

  useEffect(() => {
    if (item.source?.kind !== 'stremio') {
      setDescription(undefined);
      return;
    }
    let cancelled = false;
    setMetaLoading(true);
    void getMetaCached(item.source.manifestUrl, item.source.mediaType, item.source.mediaId)
      .then(meta => {
        if (!cancelled) setDescription(meta.description?.trim() || undefined);
      })
      .catch(() => {
        if (!cancelled) setDescription(undefined);
      })
      .finally(() => {
        if (!cancelled) setMetaLoading(false);
      });
    return () => { cancelled = true; };
  }, [item]);

  const backdrop = item.backdrop || item.poster;
  const typeLabel = isSeries ? copy.series : copy.movie;
  const actionLabel = isSeries ? copy.episodes : direct ? copy.play : copy.check;

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} transparent>
      <SafeAreaView style={styles.overlay}>
        <View style={[styles.sheet, layout.isTv && styles.sheetTv]}>
          <ImageBackground
            source={backdrop ? { uri: backdrop } : undefined}
            style={[styles.hero, { minHeight: layout.isTv ? 360 : layout.isCompactPhone ? 235 : 285 }]}
            imageStyle={styles.heroImage}
          >
            <View style={styles.heroShade} />
            <View style={[styles.heroContent, { padding: layout.isTv ? 30 : 18 }]}>
              <View style={[styles.typeBadge, direct && styles.typeBadgePlayable]}>
                <Text style={[styles.typeBadgeText, direct && styles.typeBadgePlayableText]}>{direct ? `▶ ${copy.available}` : typeLabel}</Text>
              </View>
              <Text numberOfLines={2} style={[styles.title, { fontSize: layout.isTv ? 38 : layout.isCompactPhone ? 27 : 32 }]}>{item.title}</Text>
              <Text numberOfLines={2} style={styles.meta}>{[item.year, item.genres?.slice(0, 3).join(' · '), item.subtitle].filter(Boolean).join('  •  ')}</Text>
            </View>
          </ImageBackground>

          <ScrollView contentContainerStyle={[styles.body, { padding: layout.isTv ? 28 : 17 }]}>
            <View style={styles.providerNote}>
              <View style={[styles.noteDot, direct && styles.noteDotGood]} />
              <Text style={styles.providerText}>{direct ? copy.available : copy.catalog}</Text>
            </View>

            {metaLoading ? (
              <View style={styles.loadingRow}><ActivityIndicator size="small" /><Text style={styles.synopsis}>{text.loading}</Text></View>
            ) : (
              <Text style={styles.synopsis}>{description || copy.noSynopsis}</Text>
            )}

            <View style={styles.actions}>
              <FocusButton active preferredFocus label={isSeries ? actionLabel : `▶ ${actionLabel}`} onPress={() => onPlay(item)} />
              <FocusButton label={favorite ? `♥ ${copy.favorite}` : `♡ ${copy.addFavorite}`} onPress={onToggleFavorite} />
              <FocusButton label={text.dismiss} onPress={onClose} />
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(2,4,9,0.84)', justifyContent: 'flex-end' },
  sheet: { width: '100%', maxHeight: '92%', alignSelf: 'center', overflow: 'hidden', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#0c1018', borderWidth: 1, borderColor: '#252d3d' },
  sheetTv: { width: '82%', maxWidth: 1120, maxHeight: '86%', marginBottom: 38, borderRadius: 24 },
  hero: { justifyContent: 'flex-end', backgroundColor: '#141a26' },
  heroImage: { opacity: 0.78 },
  heroShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(3,5,10,0.58)' },
  heroContent: { maxWidth: 820 },
  typeBadge: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: 'rgba(13,17,27,0.9)', borderWidth: 1, borderColor: '#4b5568', paddingHorizontal: 9, paddingVertical: 5 },
  typeBadgePlayable: { backgroundColor: 'rgba(20,70,52,0.92)', borderColor: '#3f9d76' },
  typeBadgeText: { color: '#dce2ec', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  typeBadgePlayableText: { color: '#84edbb' },
  title: { color: '#fff', fontWeight: '900', letterSpacing: -0.9, marginTop: 12 },
  meta: { color: '#d4dae5', marginTop: 7, fontSize: Platform.isTV ? 14 : 11, fontWeight: '700' },
  body: { gap: 15 },
  providerNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: '#252d3b', backgroundColor: '#10151f', padding: 11 },
  noteDot: { width: 7, height: 7, borderRadius: 99, marginTop: 4, backgroundColor: '#9ca3af' },
  noteDotGood: { backgroundColor: '#65e0a6' },
  providerText: { flex: 1, color: '#9ba5b6', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  synopsis: { color: '#c5ccd8', fontSize: Platform.isTV ? 15 : 12, lineHeight: Platform.isTV ? 22 : 18 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 4 },
});
