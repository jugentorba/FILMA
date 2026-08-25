import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { APP_LANGUAGE_OPTIONS, AUDIO_LANGUAGE_OPTIONS, stringsFor } from '../i18n';
import { validatePlaybackAddon } from '../services/addonValidation';
import { importLocalPlaylistFile } from '../services/localPlaylist';
import { useDeviceMode } from '../store/DeviceModeContext';
import { useDropboxSync } from '../store/DropboxSyncContext';
import { useFilma } from '../store/FilmaContext';
import { FocusButton } from '../ui/FocusButton';
import { theme } from '../ui/theme';
import { useResponsiveLayout } from '../ui/useResponsiveLayout';

export function SettingsScreen() {
  const {
    deviceId,
    state,
    setAppLanguage,
    toggleAudioLanguage,
    clearAudioLanguages,
    setInterfaceDensity,
    addPlaylist,
    addLocalPlaylist,
    addXtreamPlaylist,
    setPlaylistEnabled,
    removePlaylist,
    addAddon,
    setAddonEnabled,
    removeAddon,
  } = useFilma();
  const { isTvMode, isNativeTv, setTvModeEnabled } = useDeviceMode();
  const layout = useResponsiveLayout();
  const dropbox = useDropboxSync();
  const text = stringsFor(state.preferences.appLanguage);
  const [playlistName, setPlaylistName] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [importingPlaylist, setImportingPlaylist] = useState(false);
  const [xtreamName, setXtreamName] = useState('');
  const [xtreamServer, setXtreamServer] = useState('');
  const [xtreamUsername, setXtreamUsername] = useState('');
  const [xtreamPassword, setXtreamPassword] = useState('');
  const [addingXtream, setAddingXtream] = useState(false);
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

  const appearanceCopy = state.preferences.appLanguage === 'fr'
    ? {
        title: 'Apparence',
        help: 'Choisis la densité de l’interface. Compact affiche plus de contenu et des icônes plus petites.',
        compact: 'Compact',
        comfortable: 'Confortable',
      }
    : state.preferences.appLanguage === 'sq'
      ? {
          title: 'Pamja',
          help: 'Zgjidh dendësinë e ndërfaqes. Kompakt shfaq më shumë përmbajtje me ikona më të vogla.',
          compact: 'Kompakt',
          comfortable: 'Komode',
        }
      : {
          title: 'Appearance',
          help: 'Choose the interface density. Compact shows more content with smaller icons and controls.',
          compact: 'Compact',
          comfortable: 'Comfortable',
        };

  const copy = state.preferences.appLanguage === 'fr'
    ? {
        automatic: 'Automatique',
        playlistUrlError: 'L’URL de la playlist doit commencer par http:// ou https://',
        playlistAdded: 'Playlist ajoutée.',
        m3uTitle: 'Playlist M3U / M3U8',
        fileTitle: 'Fichier M3U / M3U8',
        fileHelp: 'Importe un fichier depuis cet appareil. FILMA le conserve localement pour qu’il fonctionne encore après un redémarrage. Le fichier n’est pas envoyé vers Dropbox.',
        importFile: 'Importer un fichier',
        importingFile: 'Importation…',
        fileImported: (count: number) => `Playlist importée · ${count} chaîne${count === 1 ? '' : 's'}.`,
        fileImportError: 'FILMA n’a pas pu importer ce fichier.',
        localFile: 'Fichier local',
        xtreamTitle: 'Xtream Codes',
        xtreamHelp: 'Connecte un fournisseur Xtream avec l’adresse du serveur, le nom d’utilisateur et le mot de passe. Les identifiants restent chiffrés sur cet appareil et ne sont pas envoyés vers Dropbox.',
        xtreamServer: 'Adresse du serveur (https://provider.example)',
        xtreamUsername: 'Nom d’utilisateur',
        xtreamPassword: 'Mot de passe',
        xtreamConnecting: 'Connexion…',
        xtreamConnect: 'Connecter Xtream',
        xtreamAdded: 'Source Xtream vérifiée et ajoutée.',
        xtreamError: 'FILMA n’a pas pu connecter cette source Xtream.',
        addonUrlError: 'Utilisez une URL manifest.json complète et compatible Stremio.',
        addonChecking: 'Vérification de la source…',
        addonInvalidManifest: 'Ce fichier n’est pas un manifeste Stremio valide.',
        addonNoStream: 'Cette source ne fournit pas de ressource de lecture « stream ». FILMA ne l’ajoutera pas comme source de films.',
        addonUnsupportedType: 'Cette source ne prend pas en charge les films ou les séries.',
        addonLoadError: 'FILMA n’a pas pu charger ou vérifier cette source.',
        addonAdded: 'Source de films vérifiée et ajoutée.',
        myPlaylist: 'Ma playlist',
        myXtream: 'Mon fournisseur TV',
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
          m3uTitle: 'Playlist M3U / M3U8',
          fileTitle: 'Skedar M3U / M3U8',
          fileHelp: 'Importo një skedar nga kjo pajisje. FILMA e ruan lokalisht që të vazhdojë të punojë edhe pas rihapjes së aplikacionit. Skedari nuk dërgohet në Dropbox.',
          importFile: 'Importo skedar',
          importingFile: 'Duke importuar…',
          fileImported: (count: number) => `Playlista u importua · ${count} kanal${count === 1 ? '' : 'e'}.`,
          fileImportError: 'FILMA nuk arriti ta importojë këtë skedar.',
          localFile: 'Skedar lokal',
          xtreamTitle: 'Xtream Codes',
          xtreamHelp: 'Lidh një ofrues Xtream me adresën e serverit, emrin e përdoruesit dhe fjalëkalimin. Kredencialet ruhen të sigurta vetëm në këtë pajisje dhe nuk dërgohen në Dropbox.',
          xtreamServer: 'Adresa e serverit (https://provider.example)',
          xtreamUsername: 'Emri i përdoruesit',
          xtreamPassword: 'Fjalëkalimi',
          xtreamConnecting: 'Duke u lidhur…',
          xtreamConnect: 'Lidh Xtream',
          xtreamAdded: 'Burimi Xtream u verifikua dhe u shtua.',
          xtreamError: 'FILMA nuk arriti të lidhë këtë burim Xtream.',
          addonUrlError: 'Përdor një URL të plotë manifest.json të përputhshme me Stremio.',
          addonChecking: 'Po kontrollohet burimi…',
          addonInvalidManifest: 'Ky skedar nuk është një manifest i vlefshëm Stremio.',
          addonNoStream: 'Ky burim nuk ofron resursin « stream ». FILMA nuk do ta shtojë si burim filmash.',
          addonUnsupportedType: 'Ky burim nuk mbështet filma ose seriale.',
          addonLoadError: 'FILMA nuk arriti ta ngarkojë ose verifikojë këtë burim.',
          addonAdded: 'Burimi i filmave u verifikua dhe u shtua.',
          myPlaylist: 'Playlista ime',
          myXtream: 'Ofruesi im TV',
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
          m3uTitle: 'M3U / M3U8 playlist',
          fileTitle: 'M3U / M3U8 file',
          fileHelp: 'Import a file from this device. FILMA keeps a persistent local copy so it still works after the app restarts. The file is not uploaded to Dropbox.',
          importFile: 'Import file',
          importingFile: 'Importing…',
          fileImported: (count: number) => `Playlist imported · ${count} channel${count === 1 ? '' : 's'}.`,
          fileImportError: 'FILMA could not import this file.',
          localFile: 'Local file',
          xtreamTitle: 'Xtream Codes',
          xtreamHelp: 'Connect an Xtream provider with its server address, username and password. Credentials stay encrypted on this device and are not uploaded to Dropbox.',
          xtreamServer: 'Server address (https://provider.example)',
          xtreamUsername: 'Username',
          xtreamPassword: 'Password',
          xtreamConnecting: 'Connecting…',
          xtreamConnect: 'Connect Xtream',
          xtreamAdded: 'Xtream source verified and added.',
          xtreamError: 'FILMA could not connect this Xtream source.',
          addonUrlError: 'Use a full Stremio-compatible manifest.json URL.',
          addonChecking: 'Checking source…',
          addonInvalidManifest: 'This file is not a valid Stremio manifest.',
          addonNoStream: 'This source does not provide a stream resource, so FILMA will not save it as a movie playback source.',
          addonUnsupportedType: 'This source does not support movies or series.',
          addonLoadError: 'FILMA could not load or verify this source.',
          addonAdded: 'Movie source verified and added.',
          myPlaylist: 'My playlist',
          myXtream: 'My TV provider',
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

  const importPlaylistNow = async () => {
    if (importingPlaylist) return;
    setImportingPlaylist(true);
    try {
      const imported = await importLocalPlaylistFile();
      if (!imported) return;
      addLocalPlaylist(imported.name, imported.uri);
      showMessage(copy.fileImported(imported.channelCount));
    } catch (reason) {
      const detail = reason instanceof Error && reason.message ? ` ${reason.message}` : '';
      showMessage(`${copy.fileImportError}${detail}`, true);
    } finally {
      setImportingPlaylist(false);
    }
  };

  const addXtreamNow = async () => {
    if (addingXtream) return;
    setAddingXtream(true);
    showMessage(copy.xtreamConnecting);
    try {
      await addXtreamPlaylist(
        xtreamName.trim() || copy.myXtream,
        xtreamServer,
        xtreamUsername,
        xtreamPassword,
      );
      setXtreamName('');
      setXtreamServer('');
      setXtreamUsername('');
      setXtreamPassword('');
      showMessage(copy.xtreamAdded);
    } catch (reason) {
      const detail = reason instanceof Error && reason.message ? ` ${reason.message}` : '';
      showMessage(`${copy.xtreamError}${detail}`, true);
    } finally {
      setAddingXtream(false);
    }
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

  const contentStyle = useMemo(() => ({
    paddingHorizontal: layout.horizontalPadding,
    paddingTop: layout.isTv ? 34 : layout.isCompactPhone ? 16 : 20,
    paddingBottom: layout.isTv ? 90 : 112,
  }), [layout.horizontalPadding, layout.isCompactPhone, layout.isTv]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, contentStyle]} keyboardShouldPersistTaps="handled">
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
            <Text style={styles.help}>{isNativeTv ? tvModeCopy.on : tvModeCopy.help}</Text>
          </View>
        </View>
        <View style={styles.optionRow}>
          {!isNativeTv ? <FocusButton label={tvModeCopy.phone} active={!isTvMode} onPress={() => setTvModeEnabled(false)} /> : null}
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
          <View style={styles.iconBadge}><Text style={styles.iconText}>◫</Text></View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>{appearanceCopy.title}</Text>
            <Text style={styles.help}>{appearanceCopy.help}</Text>
          </View>
        </View>
        <View style={styles.optionRow}>
          <FocusButton
            compact
            label={appearanceCopy.compact}
            active={state.preferences.interfaceDensity === 'compact'}
            onPress={() => setInterfaceDensity('compact')}
          />
          <FocusButton
            compact
            label={appearanceCopy.comfortable}
            active={state.preferences.interfaceDensity === 'comfortable'}
            onPress={() => setInterfaceDensity('comfortable')}
          />
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
            <Text style={styles.help}>M3U / M3U8 · {copy.localFile} · Xtream Codes</Text>
          </View>
        </View>

        <Text style={styles.fieldLabel}>{copy.m3uTitle}</Text>
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

        {!Platform.isTV ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.fieldLabel}>{copy.fileTitle}</Text>
            <Text style={styles.help}>{copy.fileHelp}</Text>
            <View style={styles.formSpacer} />
            <View style={styles.actionRow}>
              <FocusButton label={importingPlaylist ? copy.importingFile : copy.importFile} active onPress={() => void importPlaylistNow()} />
            </View>
          </>
        ) : null}

        <View style={styles.divider} />
        <Text style={styles.fieldLabel}>{copy.xtreamTitle}</Text>
        <Text style={styles.help}>{copy.xtreamHelp}</Text>
        <View style={styles.formSpacer} />
        <TextInput value={xtreamName} onChangeText={setXtreamName} placeholder={copy.myXtream} placeholderTextColor={theme.muted} style={styles.input} />
        <TextInput
          value={xtreamServer}
          onChangeText={setXtreamServer}
          placeholder={copy.xtreamServer}
          placeholderTextColor={theme.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={styles.input}
        />
        <TextInput
          value={xtreamUsername}
          onChangeText={setXtreamUsername}
          placeholder={copy.xtreamUsername}
          placeholderTextColor={theme.muted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <TextInput
          value={xtreamPassword}
          onChangeText={setXtreamPassword}
          placeholder={copy.xtreamPassword}
          placeholderTextColor={theme.muted}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          style={styles.input}
        />
        <View style={styles.actionRow}>
          <FocusButton label={addingXtream ? copy.xtreamConnecting : copy.xtreamConnect} active onPress={() => void addXtreamNow()} />
        </View>

        {playlists.map(item => {
          const automatic = item.id.startsWith('auto-tv:');
          const typeLabel = item.kind === 'xtream'
            ? 'Xtream'
            : item.kind === 'file'
              ? copy.localFile
              : automatic
                ? copy.automatic
                : 'M3U';
          return (
            <View key={item.id} style={styles.sourceRow}>
              <View style={styles.sourceText}>
                <View style={styles.sourceTitleRow}>
                  <Text style={styles.sourceName}>{item.name}</Text>
                  <View style={[styles.sourceStatus, item.enabled ? styles.sourceStatusOn : styles.sourceStatusOff]}>
                    <Text style={[styles.sourceStatusText, item.enabled ? styles.sourceStatusTextOn : undefined]}>
                      {item.enabled ? text.enabled : text.disabled}
                    </Text>
                  </View>
                  <View style={styles.sourceTypePill}>
                    <Text style={styles.sourceTypeText}>{typeLabel}</Text>
                  </View>
                </View>
                <Text numberOfLines={1} style={styles.sourceUrl}>{item.kind === 'file' ? copy.localFile : item.url}</Text>
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
        <Text style={styles.device}>FILMA 0.1.5 · build 6</Text>
        <Text style={styles.device}>{text.device}: {deviceId}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  content: {
    alignItems: Platform.isTV ? 'flex-start' : 'stretch',
  },
  heading: { maxWidth: 920, marginBottom: 18 },
  kicker: { color: theme.accent, fontWeight: '900', letterSpacing: 2.2, fontSize: 11 },
  title: { color: theme.text, fontSize: Platform.isTV ? 38 : 28, fontWeight: '900', marginTop: 5 },
  intro: { color: theme.muted, maxWidth: 760, marginTop: 6, fontSize: Platform.isTV ? 15 : 13, lineHeight: 20 },
  message: { color: theme.success, marginBottom: 14, fontWeight: '800', fontSize: 13 },
  messageError: { color: '#fda4af' },
  card: {
    width: '100%',
    maxWidth: 980,
    backgroundColor: '#101521',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 17,
    padding: Platform.isTV ? 20 : 14,
    marginBottom: 13,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  cardHeaderText: { flex: 1 },
  iconBadge: { minWidth: 36, height: 36, borderRadius: 11, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  cardTitle: { color: theme.text, fontWeight: '900', fontSize: Platform.isTV ? 20 : 17 },
  help: { color: theme.muted, marginTop: 3, lineHeight: Platform.isTV ? 20 : 18, fontSize: Platform.isTV ? 14 : 12 },
  fieldLabel: { color: theme.text, fontWeight: '900', marginBottom: 8, fontSize: 13 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, alignItems: 'center' },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: 14 },
  formSpacer: { height: 10 },
  statusPanel: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    padding: 12, borderRadius: 13, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, marginBottom: 11,
  },
  statusLabel: { color: theme.text, fontWeight: '900', fontSize: 14 },
  statusCaption: { color: theme.muted, marginTop: 2, fontSize: 10 },
  statusPill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: '#232a3a' },
  statusPillOk: { backgroundColor: '#12362f' },
  statusValue: { color: theme.muted, fontWeight: '900', fontSize: 10 },
  statusValueOk: { color: theme.success },
  warning: { color: '#fde68a', lineHeight: 18, marginBottom: 10, fontSize: 12 },
  error: { color: '#fda4af', lineHeight: 18, marginBottom: 10, fontSize: 12 },
  pairingPanel: { marginTop: 10, padding: 14, borderWidth: 1, borderColor: theme.border, borderRadius: 14, backgroundColor: theme.background },
  pairingTitle: { color: theme.text, fontSize: 16, fontWeight: '900' },
  qrWrap: { padding: 8, borderRadius: 10, backgroundColor: '#fff', alignSelf: Platform.isTV ? 'center' : 'flex-start', marginVertical: 12 },
  input: {
    minHeight: 44, marginBottom: 9, borderWidth: 1, borderColor: '#31394d', borderRadius: 11,
    backgroundColor: theme.background, color: theme.text, paddingHorizontal: 12, fontSize: 13,
  },
  pairingInput: { width: '100%', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: Platform.isTV ? 17 : 13 },
  actionRow: { alignItems: 'flex-start', marginBottom: 6 },
  sourceRow: {
    flexDirection: Platform.isTV ? 'row' : 'column',
    alignItems: Platform.isTV ? 'center' : 'stretch',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: 11,
    marginTop: 11,
  },
  sourceText: { flex: 1 },
  sourceTitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  sourceName: { color: theme.text, fontWeight: '900', fontSize: 14 },
  sourceUrl: { color: theme.muted, marginTop: 3, fontSize: 11 },
  sourceActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  sourceStatus: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  sourceStatusOn: { backgroundColor: '#12362f' },
  sourceStatusOff: { backgroundColor: '#252b39' },
  sourceStatusText: { color: theme.muted, fontSize: 9, fontWeight: '900' },
  sourceStatusTextOn: { color: theme.success },
  sourceTypePill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, backgroundColor: theme.accentSoft },
  sourceTypeText: { color: theme.text, fontSize: 9, fontWeight: '900' },
  lastSync: { color: theme.muted, marginTop: 10, fontSize: 11 },
  deviceCard: { width: '100%', maxWidth: 980, paddingHorizontal: 3, paddingVertical: 8 },
  deviceTitle: { color: theme.muted, fontWeight: '800', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.1 },
  device: { color: '#70798c', marginTop: 5, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 9 },
});