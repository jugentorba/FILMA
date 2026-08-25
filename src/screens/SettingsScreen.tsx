import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { APP_LANGUAGE_OPTIONS, AUDIO_LANGUAGE_OPTIONS, stringsFor } from '../i18n';
import { validatePlaybackAddon } from '../services/addonValidation';
import { useDeviceMode } from '../store/DeviceModeContext';
import { useDropboxSync } from '../store/DropboxSyncContext';
import { useFilma } from '../store/FilmaContext';
import { FocusButton } from '../ui/FocusButton';
import { theme } from '../ui/theme';

export function SettingsScreen() {
  const {
    deviceId,
    state,
    setAppLanguage,
    toggleAudioLanguage,
    clearAudioLanguages,
    addPlaylist,
    setPlaylistEnabled,
    removePlaylist,
    addAddon,
    setAddonEnabled,
    removeAddon,
  } = useFilma();
  const { isTvMode, setTvModeEnabled } = useDeviceMode();
  const dropbox = useDropboxSync();
  const text = stringsFor(state.preferences.appLanguage);
  const [playlistName, setPlaylistName] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [addonName, setAddonName] = useState('');
  const [manifestUrl, setManifestUrl] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [message, setMessage] = useState<string>();
  const [messageIsError, setMessageIsError] = useState(false);
  const [validatingAddon, setValidatingAddon] = useState(false);

  const playlists = useMemo(() => state.playlists.filter(item => !item.deletedAt), [state.playlists]);
  const addons = useMemo(() => state.addons.filter(item => !item.deletedAt), [state.addons]);

  const showMessage = (value: string, isError = false) => {
    setMessage(value);
    setMessageIsError(isError);
  };

  const tvModeCopy = state.preferences.appLanguage === 'fr'
    ? {
        title: 'Mode de l’appareil',
        help: 'Choisis Téléphone ou Mode TV. Le Mode TV permet de tester les fonctions TV et YouTube directement sur ce téléphone.',
        phone: 'Téléphone',
        tv: 'Mode TV',
        on: 'Mode TV actif',
        off: 'Mode téléphone actif',
      }
    : state.preferences.appLanguage === 'sq'
      ? {
          title: 'Modaliteti i pajisjes',
          help: 'Zgjidh Telefon ose Modalitet TV. Modaliteti TV të lejon të testosh funksionet e TV-së dhe YouTube direkt në këtë telefon.',
          phone: 'Telefon',
          tv: 'Modalitet TV',
          on: 'Modaliteti TV aktiv',
          off: 'Modaliteti telefon aktiv',
        }
      : {
          title: 'Device mode',
          help: 'Choose Phone or TV Mode. TV Mode lets you test TV features and YouTube directly on this phone.',
          phone: 'Phone',
          tv: 'TV Mode',
          on: 'TV Mode active',
          off: 'Phone mode active',
        };

  const copy = state.preferences.appLanguage === 'fr'
    ? {
        automatic: 'Automatique',
        playlistUrlError: 'L’URL de la playlist doit commencer par http:// ou https://',
        playlistAdded: 'Playlist ajoutée.',
        addonUrlError: 'Utilisez une URL manifest.json complète et compatible Stremio.',
        addonChecking: 'Vérification de la source…',
        addonInvalidManifest: 'Ce fichier n’est pas un manifeste Stremio valide.',
        addonNoStream: 'Cette source ne fournit pas de ressource de lecture « stream ». FILMA ne l’ajoutera pas comme source de films.',
        addonUnsupportedType: 'Cette source ne prend pas en charge les films ou les séries.',
        addonLoadError: 'FILMA n’a pas pu charger ou vérifier cette source.',
        addonAdded: 'Source de films vérifiée et ajoutée.',
        myPlaylist: 'Ma playlist',
        mySource: 'Ma source',
        missingDropboxKey: 'La clé d’application Dropbox est absente de cette version.',
        connectDropbox: 'Connecter Dropbox',
        tvPairHelp: 'Scannez le QR code avec votre téléphone, autorisez FILMA dans Dropbox, puis saisissez le code unique affiché par Dropbox.',
        phonePairHelp: 'Dropbox s’ouvre dans votre navigateur. Autorisez FILMA, copiez le code unique affiché par Dropbox, revenez dans FILMA et collez-le ci-dessous.',
        authCode: 'Code d’autorisation Dropbox',
        finishConnection: 'Terminer la connexion',
        openDropbox: 'Ouvrir Dropbox',
        newQrCode: 'Nouveau QR code',
        newCode: 'Nouveau code',
        cancel: 'Annuler',
      }
    : state.preferences.appLanguage === 'sq'
      ? {
          automatic: 'Automatik',
          playlistUrlError: 'URL-ja e playlistës duhet të fillojë me http:// ose https://',
          playlistAdded: 'Playlista u shtua.',
          addonUrlError: 'Përdor një URL të plotë manifest.json të përputhshme me Stremio.',
          addonChecking: 'Po kontrollohet burimi…',
          addonInvalidManifest: 'Ky skedar nuk është një manifest i vlefshëm Stremio.',
          addonNoStream: 'Ky burim nuk ofron resursin « stream ». FILMA nuk do ta shtojë si burim filmash.',
          addonUnsupportedType: 'Ky burim nuk mbështet filma ose seriale.',
          addonLoadError: 'FILMA nuk arriti ta ngarkojë ose verifikojë këtë burim.',
          addonAdded: 'Burimi i filmave u verifikua dhe u shtua.',
          myPlaylist: 'Playlista ime',
          mySource: 'Burimi im',
          missingDropboxKey: 'Ky version nuk ka Dropbox App Key.',
          connectDropbox: 'Lidh Dropbox',
          tvPairHelp: 'Skano kodin QR me telefon, autorizo FILMA në Dropbox dhe pastaj shkruaj kodin njëpërdorimësh që shfaq Dropbox.',
          phonePairHelp: 'Dropbox hapet në shfletues. Autorizo FILMA, kopjo kodin njëpërdorimësh që shfaq Dropbox, kthehu në FILMA dhe vendose më poshtë.',
          authCode: 'Kodi i autorizimit Dropbox',
          finishConnection: 'Përfundo lidhjen',
          openDropbox: 'Hap Dropbox',
          newQrCode: 'Kod QR i ri',
          newCode: 'Kod i ri',
          cancel: 'Anulo',
        }
      : {
          automatic: 'Automatic',
          playlistUrlError: 'Playlist URL must start with http:// or https://',
          playlistAdded: 'Playlist added.',
          addonUrlError: 'Use a full Stremio-compatible manifest.json URL.',
          addonChecking: 'Checking source…',
          addonInvalidManifest: 'This file is not a valid Stremio manifest.',
          addonNoStream: 'This source does not provide a stream resource, so FILMA will not save it as a movie playback source.',
          addonUnsupportedType: 'This source does not support movies or series.',
          addonLoadError: 'FILMA could not load or verify this source.',
          addonAdded: 'Movie source verified and added.',
          myPlaylist: 'My playlist',
          mySource: 'My source',
          missingDropboxKey: 'Dropbox App Key is missing from this build.',
          connectDropbox: 'Connect Dropbox',
          tvPairHelp: 'Scan the QR code on your phone, approve FILMA in Dropbox, then enter the one-time code shown by Dropbox.',
          phonePairHelp: 'Dropbox opens in your browser. Approve FILMA, copy the one-time authorization code Dropbox shows, return to FILMA, and paste it below.',
          authCode: 'Dropbox authorization code',
          finishConnection: 'Finish connection',
          openDropbox: 'Open Dropbox',
          newQrCode: 'New QR code',
          newCode: 'New code',
          cancel: 'Cancel',
        };

  const addPlaylistNow = () => {
    const url = playlistUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      showMessage(copy.playlistUrlError, true);
      return;
    }
    addPlaylist(playlistName.trim() || copy.myPlaylist, url);
    setPlaylistName('');
    setPlaylistUrl('');
    showMessage(copy.playlistAdded);
  };

  const addAddonNow = async () => {
    if (validatingAddon) return;
    const url = manifestUrl.trim();
    if (!/^https?:\/\//i.test(url) || !/manifest\.json(?:\?.*)?$/i.test(url)) {
      showMessage(copy.addonUrlError, true);
      return;
    }

    setValidatingAddon(true);
    showMessage(copy.addonChecking);
    try {
      const validation = await validatePlaybackAddon(url);
      if (!validation.valid) {
        const reason = validation.reason === 'invalid-manifest'
          ? copy.addonInvalidManifest
          : validation.reason === 'no-stream-resource'
            ? copy.addonNoStream
            : copy.addonUnsupportedType;
        showMessage(reason, true);
        return;
      }

      addAddon(addonName.trim() || validation.name || copy.mySource, url);
      setAddonName('');
      setManifestUrl('');
      showMessage(copy.addonAdded);
    } catch (reason) {
      const detail = reason instanceof Error && reason.message ? ` ${reason.message}` : '';
      showMessage(`${copy.addonLoadError}${detail}`, true);
    } finally {
      setValidatingAddon(false);
    }
  };

  const syncStatus = dropbox.status === 'syncing'
    ? text.syncing
    : dropbox.status === 'pairing'
      ? text.pairing
      : dropbox.connected
        ? text.connected
        : dropbox.status === 'checking'
          ? text.checking
          : text.notConnected;

  const finishPairing = async () => {
    await dropbox.finishPairing(pairingCode);
    setPairingCode('');
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.heading}>
        <Text style={styles.kicker}>FILMA</Text>
        <Text style={styles.title}>{text.settingsTitle}</Text>
        <Text style={styles.intro}>{text.settingsIntro}</Text>
      </View>

      {message ? <Text style={[styles.message, messageIsError && styles.messageError]}>{message}</Text> : null}

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBadge}><Text style={styles.iconText}>TV</Text></View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>{tvModeCopy.title}</Text>
            <Text style={styles.help}>{tvModeCopy.help}</Text>
          </View>
        </View>
        <View style={styles.optionRow}>
          <FocusButton label={tvModeCopy.phone} active={!isTvMode} onPress={() => setTvModeEnabled(false)} />
          <FocusButton label={tvModeCopy.tv} active={isTvMode} onPress={() => setTvModeEnabled(true)} />
        </View>
        <Text style={styles.lastSync}>{isTvMode ? tvModeCopy.on : tvModeCopy.off}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBadge}><Text style={styles.iconText}>Aa</Text></View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>{text.languageTitle}</Text>
            <Text style={styles.help}>{text.audioHelp}</Text>
          </View>
        </View>

        <Text style={styles.fieldLabel}>{text.appLanguage}</Text>
        <View style={styles.optionRow}>
          {APP_LANGUAGE_OPTIONS.map(option => (
            <FocusButton key={option.code} compact label={option.label} active={state.preferences.appLanguage === option.code} onPress={() => setAppLanguage(option.code)} />
          ))}
        </View>

        <View style={styles.divider} />
        <Text style={styles.fieldLabel}>{text.audioLanguages}</Text>
        <View style={styles.optionRow}>
          <FocusButton compact label={text.anyLanguage} active={!state.preferences.preferredAudioLanguages.length} onPress={clearAudioLanguages} />
          {AUDIO_LANGUAGE_OPTIONS.map(option => (
            <FocusButton
              key={option.code}
              compact
              label={option.labels[state.preferences.appLanguage]}
              active={state.preferences.preferredAudioLanguages.includes(option.code)}
              onPress={() => toggleAudioLanguage(option.code)}
            />
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBadge}><Text style={styles.iconText}>☁</Text></View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>{text.syncTitle}</Text>
            <Text style={styles.help}>{text.syncHelp}</Text>
          </View>
        </View>

        <View style={styles.statusPanel}>
          <View>
            <Text style={styles.statusLabel}>Dropbox</Text>
            <Text style={styles.statusCaption}>FILMA App Folder</Text>
          </View>
          <View style={[styles.statusPill, dropbox.connected && styles.statusPillOk]}>
            <Text style={[styles.statusValue, dropbox.connected && styles.statusValueOk]}>{syncStatus}</Text>
          </View>
        </View>

        {!dropbox.configured ? <Text style={styles.warning}>{copy.missingDropboxKey}</Text> : null}
        {dropbox.error ? <Text style={styles.error}>{dropbox.error}</Text> : null}

        {dropbox.pairingUrl && !dropbox.connected ? (
          <View style={styles.pairingPanel}>
            <Text style={styles.pairingTitle}>{copy.connectDropbox}</Text>
            {dropbox.isTv ? (
              <>
                <Text style={styles.help}>{copy.tvPairHelp}</Text>
                <View style={styles.qrWrap}>
                  <QRCode value={dropbox.pairingUrl} size={260} backgroundColor="#ffffff" color="#000000" quietZone={12} />
                </View>
              </>
            ) : (
              <Text style={styles.help}>{copy.phonePairHelp}</Text>
            )}

            <TextInput
              value={pairingCode}
              onChangeText={setPairingCode}
              placeholder={copy.authCode}
              placeholderTextColor={theme.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, styles.pairingInput]}
            />
            <View style={styles.optionRow}>
              <FocusButton label={copy.finishConnection} active preferredFocus onPress={() => void finishPairing()} />
              {!dropbox.isTv ? <FocusButton label={copy.openDropbox} onPress={() => void dropbox.openPairing()} /> : null}
              <FocusButton label={dropbox.isTv ? copy.newQrCode : copy.newCode} onPress={() => void dropbox.restartPairing()} />
              <FocusButton label={copy.cancel} onPress={() => { setPairingCode(''); dropbox.cancelPairing(); }} />
            </View>
          </View>
        ) : null}

        {!dropbox.pairingUrl || dropbox.connected ? (
          <View style={styles.optionRow}>
            {!dropbox.connected ? (
              <FocusButton label={text.connectDropbox} active preferredFocus onPress={() => void dropbox.connect()} />
            ) : (
              <>
                <FocusButton label={dropbox.status === 'syncing' ? text.syncing : text.syncNow} active preferredFocus onPress={() => void dropbox.syncNow().catch(() => undefined)} />
                <FocusButton label={text.disconnect} onPress={() => void dropbox.disconnect()} />
              </>
            )}
          </View>
        ) : null}

        {dropbox.lastSyncAt ? <Text style={styles.lastSync}>{text.lastSync}: {new Date(dropbox.lastSyncAt).toLocaleString()}</Text> : null}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBadge}><Text style={styles.iconText}>▶</Text></View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>{text.movieSources}</Text>
            <Text style={styles.help}>{text.manifestUrl}</Text>
          </View>
        </View>
        <TextInput value={addonName} onChangeText={setAddonName} placeholder={text.addonName} placeholderTextColor={theme.muted} style={styles.input} />
        <TextInput
          value={manifestUrl}
          onChangeText={setManifestUrl}
          placeholder="https://example.com/manifest.json"
          placeholderTextColor={theme.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={styles.input}
        />
        <View style={styles.actionRow}>
          <FocusButton label={validatingAddon ? copy.addonChecking : text.addAddon} active onPress={() => void addAddonNow()} />
        </View>
        {addons.map(item => {
          const automatic = item.id.startsWith('auto-stremio:');
          return (
            <View key={item.id} style={styles.sourceRow}>
              <View style={styles.sourceText}>
                <View style={styles.sourceTitleRow}>
                  <Text style={styles.sourceName}>{item.name}</Text>
                  <View style={[styles.sourceStatus, item.enabled ? styles.sourceStatusOn : styles.sourceStatusOff]}>
                    <Text style={[styles.sourceStatusText, item.enabled ? styles.sourceStatusTextOn : undefined]}>
                      {automatic ? copy.automatic : item.enabled ? text.enabled : text.disabled}
                    </Text>
                  </View>
                </View>
                <Text numberOfLines={1} style={styles.sourceUrl}>{item.manifestUrl}</Text>
              </View>
              {!automatic ? (
                <View style={styles.sourceActions}>
                  <FocusButton compact label={item.enabled ? text.disable : text.enable} onPress={() => setAddonEnabled(item.id, !item.enabled)} />
                  <FocusButton compact label={text.remove} onPress={() => removeAddon(item.id)} />
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBadge}><Text style={styles.iconText}>TV</Text></View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>{text.liveSources}</Text>
            <Text style={styles.help}>M3U / M3U8 URL</Text>
          </View>
        </View>
        <TextInput value={playlistName} onChangeText={setPlaylistName} placeholder={text.playlistName} placeholderTextColor={theme.muted} style={styles.input} />
        <TextInput
          value={playlistUrl}
          onChangeText={setPlaylistUrl}
          placeholder="https://example.com/playlist.m3u"
          placeholderTextColor={theme.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={styles.input}
        />
        <View style={styles.actionRow}><FocusButton label={text.addPlaylist} active onPress={addPlaylistNow} /></View>
        {playlists.map(item => {
          const automatic = item.id.startsWith('auto-tv:');
          return (
            <View key={item.id} style={styles.sourceRow}>
              <View style={styles.sourceText}>
                <View style={styles.sourceTitleRow}>
                  <Text style={styles.sourceName}>{item.name}</Text>
                  <View style={[styles.sourceStatus, item.enabled ? styles.sourceStatusOn : styles.sourceStatusOff]}>
                    <Text style={[styles.sourceStatusText, item.enabled ? styles.sourceStatusTextOn : undefined]}>
                      {automatic ? copy.automatic : item.enabled ? text.enabled : text.disabled}
                    </Text>
                  </View>
                </View>
                <Text numberOfLines={1} style={styles.sourceUrl}>{item.url}</Text>
              </View>
              {!automatic ? (
                <View style={styles.sourceActions}>
                  <FocusButton compact label={item.enabled ? text.disable : text.enable} onPress={() => setPlaylistEnabled(item.id, !item.enabled)} />
                  <FocusButton compact label={text.remove} onPress={() => removePlaylist(item.id)} />
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={styles.deviceCard}>
        <Text style={styles.deviceTitle}>{text.advanced}</Text>
        <Text style={styles.device}>FILMA 0.1.2 · build 3</Text>
        <Text style={styles.device}>{text.device}: {deviceId}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  content: {
    paddingHorizontal: Platform.isTV ? 64 : 18,
    paddingTop: Platform.isTV ? 46 : 24,
    paddingBottom: Platform.isTV ? 100 : 130,
    alignItems: Platform.isTV ? 'flex-start' : 'stretch',
  },
  heading: { maxWidth: 920, marginBottom: 24 },
  kicker: { color: theme.accent, fontWeight: '900', letterSpacing: 2.2, fontSize: 12 },
  title: { color: theme.text, fontSize: Platform.isTV ? 46 : 34, fontWeight: '900', marginTop: 7 },
  intro: { color: theme.muted, maxWidth: 760, marginTop: 8, fontSize: Platform.isTV ? 17 : 15, lineHeight: 23 },
  message: { color: theme.success, marginBottom: 16, fontWeight: '800' },
  messageError: { color: '#fda4af' },
  card: {
    width: '100%',
    maxWidth: 980,
    backgroundColor: '#101521',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 22,
    padding: Platform.isTV ? 28 : 18,
    marginBottom: 18,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 20 },
  cardHeaderText: { flex: 1 },
  iconBadge: { minWidth: 44, height: 44, borderRadius: 14, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  cardTitle: { color: theme.text, fontWeight: '900', fontSize: Platform.isTV ? 25 : 21 },
  help: { color: theme.muted, marginTop: 5, lineHeight: Platform.isTV ? 24 : 21 },
  fieldLabel: { color: theme.text, fontWeight: '900', marginBottom: 10, fontSize: 15 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: 20 },
  statusPanel: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16,
    padding: 16, borderRadius: 16, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, marginBottom: 14,
  },
  statusLabel: { color: theme.text, fontWeight: '900', fontSize: 16 },
  statusCaption: { color: theme.muted, marginTop: 3, fontSize: 12 },
  statusPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#232a3a' },
  statusPillOk: { backgroundColor: '#12362f' },
  statusValue: { color: theme.muted, fontWeight: '900', fontSize: 12 },
  statusValueOk: { color: theme.success },
  warning: { color: '#fde68a', lineHeight: 21, marginBottom: 12 },
  error: { color: '#fda4af', lineHeight: 21, marginBottom: 12 },
  pairingPanel: { marginTop: 12, padding: 18, borderWidth: 1, borderColor: theme.border, borderRadius: 18, backgroundColor: theme.background },
  pairingTitle: { color: theme.text, fontSize: 19, fontWeight: '900' },
  qrWrap: { padding: 10, borderRadius: 12, backgroundColor: '#fff', alignSelf: Platform.isTV ? 'center' : 'flex-start', marginVertical: 14 },
  input: {
    minHeight: 54, marginBottom: 12, borderWidth: 1, borderColor: '#31394d', borderRadius: 14,
    backgroundColor: theme.background, color: theme.text, paddingHorizontal: 15, fontSize: 16,
  },
  pairingInput: { width: '100%', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: Platform.isTV ? 20 : 16 },
  actionRow: { alignItems: 'flex-start', marginBottom: 8 },
  sourceRow: {
    flexDirection: Platform.isTV ? 'row' : 'column',
    alignItems: Platform.isTV ? 'center' : 'stretch',
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: 14,
    marginTop: 14,
  },
  sourceText: { flex: 1 },
  sourceTitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  sourceName: { color: theme.text, fontWeight: '900', fontSize: 16 },
  sourceUrl: { color: theme.muted, marginTop: 4 },
  sourceActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  sourceStatus: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  sourceStatusOn: { backgroundColor: '#12362f' },
  sourceStatusOff: { backgroundColor: '#252b39' },
  sourceStatusText: { color: theme.muted, fontSize: 11, fontWeight: '900' },
  sourceStatusTextOn: { color: theme.success },
  lastSync: { color: theme.muted, marginTop: 14 },
  deviceCard: { width: '100%', maxWidth: 980, paddingHorizontal: 4, paddingVertical: 10 },
  deviceTitle: { color: theme.muted, fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2 },
  device: { color: '#70798c', marginTop: 6, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11 },
});