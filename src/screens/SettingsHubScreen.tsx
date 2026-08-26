import React, { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFilma } from '../store/FilmaContext';
import { ProfileSwitcher } from '../ui/ProfileSwitcher';
import { useResponsiveLayout } from '../ui/useResponsiveLayout';
import { MovieSourceSettingsScreen } from './MovieSourceSettingsScreen';
import { SettingsScreen as DetailedSettings } from './SettingsV2';

type SectionKey = 'appearance' | 'content' | 'sources' | 'playback' | 'integrations' | 'tv' | 'advanced';

type RowCopy = { title: string; help: string; icon: string; section: SectionKey };

function copyFor(language: 'en' | 'fr' | 'sq') {
  if (language === 'fr') {
    return {
      title: 'Paramètres', account: 'COMPTE', general: 'GÉNÉRAL', about: 'À PROPOS', advanced: 'AVANCÉ',
      switchProfile: 'Changer de profil', switchHelp: 'Basculer vers un profil différent.',
      version: 'Version et informations', versionHelp: 'FILMA 0.1.7 · build 8', close: 'Fermer',
      rows: [
        { title: 'Apparence', help: 'Langue de l’application, densité et préférences visuelles.', icon: '◉', section: 'appearance' },
        { title: 'Contenu et découverte', help: 'Catalogue et langues audio préférées.', icon: '✚', section: 'content' },
        { title: 'Sources films & séries', help: 'Découverte automatique et source site/fournisseur optionnelle.', icon: '◎', section: 'sources' },
        { title: 'Lecture', help: 'Audio, sous-titres et comportement du lecteur.', icon: '▶', section: 'playback' },
        { title: 'Intégrations', help: 'Synchronisation Dropbox et services connectés.', icon: '↗', section: 'integrations' },
        { title: 'TV en direct', help: 'Playlists M3U, fichiers locaux et Xtream.', icon: 'TV', section: 'tv' },
      ] satisfies RowCopy[],
      advancedRow: { title: 'Avancé', help: 'Mode de l’appareil et configuration complète.', icon: '☷', section: 'advanced' } satisfies RowCopy,
    };
  }
  if (language === 'sq') {
    return {
      title: 'Cilësimet', account: 'LLOGARIA', general: 'TË PËRGJITHSHME', about: 'RRETH APLIKACIONIT', advanced: 'TË AVANCUARA',
      switchProfile: 'Ndrysho profilin', switchHelp: 'Kalo në një profil tjetër.',
      version: 'Versioni dhe informacioni', versionHelp: 'FILMA 0.1.7 · build 8', close: 'Mbyll',
      rows: [
        { title: 'Pamja', help: 'Gjuha e aplikacionit, dendësia dhe preferencat vizuale.', icon: '◉', section: 'appearance' },
        { title: 'Përmbajtja dhe zbulimi', help: 'Katalogu dhe gjuhët e preferuara të audios.', icon: '✚', section: 'content' },
        { title: 'Burimet e filmave & serialeve', help: 'Zbulim automatik dhe website/provider opsional.', icon: '◎', section: 'sources' },
        { title: 'Luajtja', help: 'Audio, titrat dhe sjellja e player-it.', icon: '▶', section: 'playback' },
        { title: 'Integrimet', help: 'Sinkronizimi Dropbox dhe shërbimet e lidhura.', icon: '↗', section: 'integrations' },
        { title: 'TV Live', help: 'M3U, skedarë lokalë dhe Xtream.', icon: 'TV', section: 'tv' },
      ] satisfies RowCopy[],
      advancedRow: { title: 'Të avancuara', help: 'Modaliteti i pajisjes dhe konfigurimi i plotë.', icon: '☷', section: 'advanced' } satisfies RowCopy,
    };
  }
  return {
    title: 'Settings', account: 'ACCOUNT', general: 'GENERAL', about: 'ABOUT', advanced: 'ADVANCED',
    switchProfile: 'Switch profile', switchHelp: 'Change to a different profile.',
    version: 'Version & information', versionHelp: 'FILMA 0.1.7 · build 8', close: 'Close',
    rows: [
      { title: 'Appearance', help: 'App language, density and visual preferences.', icon: '◉', section: 'appearance' },
      { title: 'Content & discovery', help: 'Catalogue and preferred audio languages.', icon: '✚', section: 'content' },
      { title: 'Movies & Series sources', help: 'Automatic discovery and optional website/provider source.', icon: '◎', section: 'sources' },
      { title: 'Playback', help: 'Audio, subtitles and player behavior.', icon: '▶', section: 'playback' },
      { title: 'Integrations', help: 'Dropbox sync and connected services.', icon: '↗', section: 'integrations' },
      { title: 'Live TV', help: 'M3U playlists, local files and Xtream.', icon: 'TV', section: 'tv' },
    ] satisfies RowCopy[],
    advancedRow: { title: 'Advanced', help: 'Device mode and complete configuration.', icon: '☷', section: 'advanced' } satisfies RowCopy,
  };
}

function SettingsRow({ row, onPress }: { row: RowCopy; onPress(): void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.icon}><Text style={styles.iconText}>{row.icon}</Text></View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{row.title}</Text>
        <Text style={styles.rowHelp}>{row.help}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export function SettingsHubScreen() {
  const { state } = useFilma();
  const layout = useResponsiveLayout();
  const copy = useMemo(() => copyFor(state.preferences.appLanguage), [state.preferences.appLanguage]);
  const [detail, setDetail] = useState<SectionKey | null>(null);

  return (
    <>
      <ScrollView style={styles.root} contentContainerStyle={{ paddingHorizontal: layout.horizontalPadding, paddingTop: layout.isTv ? 34 : 24, paddingBottom: 112 }} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { fontSize: layout.isTv ? 45 : layout.isTablet ? 41 : 36 }]}>{copy.title}</Text>

        <Text style={styles.sectionLabel}>{copy.account}</Text>
        <View style={styles.group}>
          <View style={styles.profileRow}>
            <View style={styles.icon}><Text style={styles.iconText}>●●</Text></View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{copy.switchProfile}</Text>
              <Text style={styles.rowHelp}>{copy.switchHelp}</Text>
            </View>
            <ProfileSwitcher />
          </View>
        </View>

        <Text style={styles.sectionLabel}>{copy.general}</Text>
        <View style={styles.group}>{copy.rows.map(row => <SettingsRow key={row.section} row={row} onPress={() => setDetail(row.section)} />)}</View>

        <Text style={styles.sectionLabel}>{copy.about}</Text>
        <View style={styles.group}>
          <View style={styles.infoRow}>
            <View style={styles.icon}><Text style={styles.iconText}>i</Text></View>
            <View style={styles.rowText}><Text style={styles.rowTitle}>{copy.version}</Text><Text style={styles.rowHelp}>{copy.versionHelp}</Text></View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>{copy.advanced}</Text>
        <View style={styles.group}><SettingsRow row={copy.advancedRow} onPress={() => setDetail('advanced')} /></View>
      </ScrollView>

      <Modal visible={detail !== null} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setDetail(null)}>
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.modalBar}>
            <Text style={styles.modalTitle}>{detail ? (detail === 'advanced' ? copy.advancedRow.title : copy.rows.find(row => row.section === detail)?.title ?? copy.title) : copy.title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={copy.close} hitSlop={12} onPress={() => setDetail(null)}><Text style={styles.close}>×</Text></Pressable>
          </View>
          {detail === 'sources' ? <MovieSourceSettingsScreen /> : <DetailedSettings />}
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#090909' },
  title: { color: '#f6f6f7', fontWeight: '900', letterSpacing: -1.2, marginBottom: 22 },
  sectionLabel: { color: '#9b9da4', fontSize: 12, letterSpacing: 1.3, fontWeight: '900', marginTop: 13, marginBottom: 8 },
  group: { borderRadius: 17, overflow: 'hidden', backgroundColor: '#1a1a1b', borderWidth: 1, borderColor: '#272729' },
  row: { minHeight: 78, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#29292b' },
  rowPressed: { backgroundColor: '#242426' },
  profileRow: { minHeight: 84, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 13 },
  infoRow: { minHeight: 82, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 13 },
  icon: { width: 43, height: 43, borderRadius: 13, backgroundColor: '#38383a', alignItems: 'center', justifyContent: 'center' },
  iconText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  rowText: { flex: 1 },
  rowTitle: { color: '#f4f4f5', fontSize: 17, fontWeight: '700' },
  rowHelp: { color: '#94969c', fontSize: 13, lineHeight: 18, marginTop: 2 },
  chevron: { color: '#8d8f96', fontSize: 30, fontWeight: '300' },
  modalRoot: { flex: 1, backgroundColor: '#080808' },
  modalBar: { minHeight: 54, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2a2a2c' },
  modalTitle: { color: '#f4f4f5', fontSize: Platform.isTV ? 22 : 17, fontWeight: '900' },
  close: { color: '#f4f4f5', fontSize: 31, lineHeight: 31, fontWeight: '300' },
});
