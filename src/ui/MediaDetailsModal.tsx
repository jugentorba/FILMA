import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ImageBackground, Linking, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { stringsFor } from '../i18n';
import { getMetaCached } from '../services/mediaDiscovery';
import { externalProviderUrlFromResolved, isExternalResolvedStream, resolveStreamsAcrossAddons, type ResolvedStream } from '../services/streamResolver';
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

type Availability = 'checking' | 'direct' | 'external' | 'none' | 'unknown';

export function MediaDetailsModal({ item, favorite, knownPlayable = false, onPlay, onOpenSources, onToggleFavorite, onClose }: Props) {
  const { state } = useFilma();
  const layout = useResponsiveLayout();
  const text = stringsFor(state.preferences.appLanguage);
  const [description, setDescription] = useState<string>();
  const [metaLoading, setMetaLoading] = useState(false);
  const [availability, setAvailability] = useState<Availability>('unknown');
  const [providerName, setProviderName] = useState<string>();
  const [externalOptions, setExternalOptions] = useState<ResolvedStream[]>([]);
  const [providerOpenError, setProviderOpenError] = useState(false);

  const copy = useMemo(() => state.preferences.appLanguage === 'fr'
    ? {
        movie: 'FILM', series: 'SÉRIE', play: 'Lire dans FILMA', episodes: 'Voir les épisodes',
        checking: 'Recherche automatique des sources…', direct: 'Lecture directe disponible', external: 'Disponible chez un fournisseur externe',
        none: 'Aucune source disponible actuellement', unknown: 'FILMA vérifiera automatiquement les fournisseurs.',
        openProvider: 'Ouvrir le fournisseur', retry: 'Rechercher à nouveau', sources: 'Sources (optionnel)',
        options: 'Options disponibles', providerFailed: 'FILMA n’a pas pu ouvrir cette option.',
        noSynopsis: 'Aucun résumé disponible pour le moment.', favorite: 'Dans ma liste', addFavorite: 'Ajouter à ma liste',
      }
    : state.preferences.appLanguage === 'sq'
      ? {
          movie: 'FILM', series: 'SERIAL', play: 'Luaj në FILMA', episodes: 'Shiko episodet',
          checking: 'Duke kërkuar automatikisht burimet…', direct: 'Ka transmetim direkt', external: 'I disponueshëm te një ofrues i jashtëm',
          none: 'Nuk ka burim të disponueshëm për momentin', unknown: 'FILMA do t’i kontrollojë automatikisht ofruesit.',
          openProvider: 'Hap ofruesin', retry: 'Kërko përsëri', sources: 'Burimet (opsionale)',
          options: 'Opsionet e disponueshme', providerFailed: 'FILMA nuk arriti ta hapë këtë opsion.',
          noSynopsis: 'Nuk ka përshkrim për momentin.', favorite: 'Në listën time', addFavorite: 'Shto në listën time',
        }
      : {
          movie: 'MOVIE', series: 'SERIES', play: 'Play in FILMA', episodes: 'View episodes',
          checking: 'Searching providers automatically…', direct: 'Direct playback available', external: 'Available from an external provider',
          none: 'No source is currently available', unknown: 'FILMA will check providers automatically.',
          openProvider: 'Open provider', retry: 'Search again', sources: 'Sources (optional)',
          options: 'Available options', providerFailed: 'FILMA could not open this option.',
          noSynopsis: 'No synopsis is available yet.', favorite: 'In My List', addFavorite: 'Add to My List',
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
    setProviderName(undefined);
    setExternalOptions([]);
    setProviderOpenError(false);
    if (isSeries) {
      setAvailability('unknown');
      return;
    }
    if (initiallyPlayable) {
      setAvailability('direct');
      return;
    }
    if (item.source?.kind !== 'stremio') {
      setAvailability('unknown');
      return;
    }

    setAvailability('checking');
    try {
      const resolution = await resolveStreamsAcrossAddons(item, state.addons, state.preferences.preferredAudioLanguages, force);
      const best = resolution.streams[0];
      if (!best) {
        setAvailability('none');
        return;
      }
      setProviderName(best.providerName);
      if (isExternalResolvedStream(best.url)) {
        setExternalOptions(resolution.streams.filter(stream => isExternalResolvedStream(stream.url)).slice(0, 8));
        setAvailability('external');
      } else {
        setAvailability('direct');
      }
    } catch {
      setAvailability('unknown');
    }
  }, [initiallyPlayable, isSeries, item, state.addons, state.preferences.preferredAudioLanguages]);

  useEffect(() => {
    void checkAvailability(false);
  }, [checkAvailability]);

  const openExternalOption = useCallback(async (stream: ResolvedStream) => {
    const url = externalProviderUrlFromResolved(stream.url);
    if (!url) return;
    setProviderOpenError(false);
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) throw new Error('Unsupported provider URL');
      await Linking.openURL(url);
    } catch {
      setProviderOpenError(true);
    }
  }, []);

  const backdrop = item.backdrop || item.poster;
  const typeLabel = isSeries ? copy.series : copy.movie;
  const available = availability === 'direct' || availability === 'external';
  const note = availability === 'checking'
    ? copy.checking
    : availability === 'direct'
      ? `${copy.direct}${providerName ? ` · ${providerName}` : ''}`
      : availability === 'external'
        ? `${copy.external}${providerName ? ` · ${providerName}` : ''}`
        : availability === 'none'
          ? copy.none
          : copy.unknown;

  const primaryLabel = isSeries
    ? copy.episodes
    : availability === 'direct'
      ? `▶ ${copy.play}`
      : availability === 'external'
        ? copy.openProvider
        : availability === 'none'
          ? `↻ ${copy.retry}`
          : undefined;

  const handlePrimary = () => {
    if (isSeries || availability === 'direct' || availability === 'external') {
      onPlay(item);
      return;
    }
    if (availability === 'none') void checkAvailability(true);
  };

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
              <View style={[styles.typeBadge, available && styles.typeBadgePlayable]}>
                <Text style={[styles.typeBadgeText, available && styles.typeBadgePlayableText]}>{available ? `▶ ${note}` : typeLabel}</Text>
              </View>
              <Text numberOfLines={2} style={[styles.title, { fontSize: layout.isTv ? 38 : layout.isCompactPhone ? 27 : 32 }]}>{item.title}</Text>
              <Text numberOfLines={2} style={styles.meta}>{[item.year, item.genres?.slice(0, 3).join(' · '), item.subtitle].filter(Boolean).join('  •  ')}</Text>
            </View>
          </ImageBackground>

          <ScrollView contentContainerStyle={[styles.body, { padding: layout.isTv ? 28 : 17 }]}>
            <View style={styles.providerNote}>
              {availability === 'checking' ? <ActivityIndicator size="small" /> : <View style={[styles.noteDot, available && styles.noteDotGood, availability === 'none' && styles.noteDotNone]} />}
              <Text style={styles.providerText}>{note}</Text>
            </View>

            {availability === 'external' && externalOptions.length > 1 ? (
              <View style={styles.optionsPanel}>
                <Text style={styles.optionsTitle}>{copy.options}</Text>
                <View style={styles.optionsButtons}>
                  {externalOptions.map((stream, index) => (
                    <FocusButton
                      key={`${stream.providerManifestUrl}:${stream.url}:${index}`}
                      compact
                      label={stream.title || stream.providerName}
                      onPress={() => void openExternalOption(stream)}
                    />
                  ))}
                </View>
                {providerOpenError ? <Text style={styles.providerError}>{copy.providerFailed}</Text> : null}
              </View>
            ) : null}

            {metaLoading ? (
              <View style={styles.loadingRow}><ActivityIndicator size="small" /><Text style={styles.synopsis}>{text.loading}</Text></View>
            ) : (
              <Text style={styles.synopsis}>{description || copy.noSynopsis}</Text>
            )}

            <View style={styles.actions}>
              {primaryLabel ? <FocusButton active preferredFocus label={primaryLabel} onPress={handlePrimary} /> : null}
              {availability === 'none' ? <FocusButton label={copy.sources} onPress={onOpenSources} /> : null}
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
  typeBadge: { alignSelf: 'flex-start', maxWidth: '94%', borderRadius: 999, backgroundColor: 'rgba(13,17,27,0.9)', borderWidth: 1, borderColor: '#4b5568', paddingHorizontal: 9, paddingVertical: 5 },
  typeBadgePlayable: { backgroundColor: 'rgba(20,70,52,0.92)', borderColor: '#3f9d76' },
  typeBadgeText: { color: '#dce2ec', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  typeBadgePlayableText: { color: '#84edbb' },
  title: { color: '#fff', fontWeight: '900', letterSpacing: -0.9, marginTop: 12 },
  meta: { color: '#d4dae5', marginTop: 7, fontSize: Platform.isTV ? 14 : 11, fontWeight: '700' },
  body: { gap: 15 },
  providerNote: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: '#252d3b', backgroundColor: '#10151f', padding: 11 },
  noteDot: { width: 7, height: 7, borderRadius: 99, backgroundColor: '#9ca3af' },
  noteDotGood: { backgroundColor: '#65e0a6' },
  noteDotNone: { backgroundColor: '#f0a45b' },
  providerText: { flex: 1, color: '#9ba5b6', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  optionsPanel: { borderRadius: 12, borderWidth: 1, borderColor: '#252d3b', backgroundColor: '#0d121b', padding: 11, gap: 9 },
  optionsTitle: { color: '#d9dfe8', fontSize: 11, fontWeight: '900' },
  optionsButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  providerError: { color: '#fda4af', fontSize: 10, fontWeight: '700' },
  synopsis: { color: '#c5ccd8', fontSize: Platform.isTV ? 15 : 12, lineHeight: Platform.isTV ? 22 : 18 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 4 },
});
