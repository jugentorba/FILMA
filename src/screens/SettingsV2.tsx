import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { APP_LANGUAGE_OPTIONS, AUDIO_LANGUAGE_OPTIONS, audioLanguageLabel, stringsFor } from '../i18n';
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
    updatePreferences,
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

  const [showMovieSources, setShowMovieSources] = useState(false);
  const [showTvSources, setShowTvSources] = useState(false);
  const [showSync, setShowSync] = useState(false);
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

  const copy = useMemo(() => {
    if (state.preferences.appLanguage === 'fr') {
      return {
        subtitle: 'Choisissez vos langues et la façon dont FILMA trouve et lit le contenu.',
        languageCard: 'Langues', appLanguage: 'Langue de l’application',
        contentLanguages: 'Recherche & audio',
        contentHelp: 'Ces langues sont utilisées pour les catalogues qui proposent un filtre de langue, pour classer les sources de lecture et pour choisir automatiquement la piste audio. Touchez-les dans l’ordre de priorité souhaité.',
        automaticOrder: 'Ordre automatique : Français → Albanais → Anglais',
        resetOrder: 'Ordre automatique', subtitleRule: 'Sous-titres',
        subtitleHelp: 'FILMA préfère automatiquement les sous-titres dans la langue de l’application, puis dans vos langues audio.',
        appearance: 'Apparence', appearanceHelp: 'Compact affiche davantage de contenu. Confortable augmente les cartes et commandes.',
        compact: 'Compact', comfortable: 'Confortable',
        movieSources: 'Sources films & séries', movieSummary: 'FILMA Free est intégré. Ajoutez ici d’autres fournisseurs compatibles Stremio si vous en utilisez.',
        tvSources: 'Sources TV', tvSummary: 'Chaînes automatiques + playlist M3U/M3U8, fichier local ou compte Xtream.',
        sync: 'Synchronisation', syncSummary: 'Continue Watching, favoris, profils et sources via Dropbox.',
        deviceMode: 'Mode de l’appareil', phone: 'Téléphone', tv: 'TV',
        open: 'Gérer', hide: 'Masquer', automatic: 'Automatique', builtIn: 'Intégré',
        playable: 'Lecture directe', catalog: 'Catalogue',
        playlistUrlError: 'L’URL de la playlist doit commencer par http:// ou https://', playlistAdded: 'Playlist ajoutée.',
        m3uTitle: 'URL M3U / M3U8', fileTitle: 'Fichier M3U / M3U8', importFile: 'Importer un fichier', importing: 'Importation…',
        fileImported: (n: number) => `${n} chaîne${n === 1 ? '' : 's'} importée${n === 1 ? '' : 's'}.`, fileError: 'Impossible d’importer ce fichier.',
        xtreamTitle: 'Xtream Codes', xtreamHelp: 'Les identifiants restent chiffrés sur cet appareil et ne sont pas synchronisés vers Dropbox.',
        server: 'Adresse du serveur', username: 'Nom d’utilisateur', password: 'Mot de passe', connectXtream: 'Connecter Xtream', connecting: 'Connexion…', xtreamAdded: 'Source Xtream ajoutée.', xtreamError: 'Connexion Xtream impossible.',
        addonUrlError: 'Utilisez une URL manifest.json compatible Stremio.', checkingSource: 'Vérification…', addonAdded: 'Source ajoutée.', addonError: 'Cette source n’a pas pu être ajoutée.',
        connectDropbox: 'Connecter Dropbox', finishDropbox: 'Terminer la connexion', authCode: 'Code d’autorisation Dropbox', cancel: 'Annuler',
        pairingHelp: 'Autorisez FILMA dans Dropbox, puis collez le code unique affiché par Dropbox.',
        qrHelp: 'Scannez le QR code avec votre téléphone, autorisez FILMA, puis saisissez le code unique.',
        local: 'Local', sourceName: 'Nom de la source', playlistName: 'Nom de la playlist',
      };
    }
    if (state.preferences.appLanguage === 'sq') {
      return {
        subtitle: 'Zgjidh gjuhët dhe mënyrën si FILMA kërkon dhe luan përmbajtjen.',
        languageCard: 'Gjuhët', appLanguage: 'Gjuha e aplikacionit',
        contentLanguages: 'Kërkimi & audio',
        contentHelp: 'Këto gjuhë përdoren për katalogët me filtër gjuhe, për renditjen e burimeve të luajtjes dhe për zgjedhjen automatike të audios. Preki sipas rendit të përparësisë.',
        automaticOrder: 'Rendi automatik: Frëngjisht → Shqip → Anglisht',
        resetOrder: 'Rendi automatik', subtitleRule: 'Titrat',
        subtitleHelp: 'FILMA preferon titrat në gjuhën e aplikacionit, pastaj në gjuhët e zgjedhura të audios.',
        appearance: 'Pamja', appearanceHelp: 'Kompakt shfaq më shumë përmbajtje. Komode rrit kartat dhe komandat.',
        compact: 'Kompakt', comfortable: 'Komode',
        movieSources: 'Burimet e filmave & serialeve', movieSummary: 'FILMA Free është i integruar. Këtu mund të shtosh ofrues të tjerë Stremio që përdor.',
        tvSources: 'Burimet TV', tvSummary: 'Kanale automatike + M3U/M3U8, skedar lokal ose llogari Xtream.',
        sync: 'Sinkronizimi', syncSummary: 'Vazhdo shikimin, të preferuarat, profilet dhe burimet me Dropbox.',
        deviceMode: 'Modaliteti i pajisjes', phone: 'Telefon', tv: 'TV',
        open: 'Menaxho', hide: 'Fshih', automatic: 'Automatik', builtIn: 'Integruar',
        playable: 'Luhet direkt', catalog: 'Katalog',
        playlistUrlError: 'URL-ja duhet të fillojë me http:// ose https://', playlistAdded: 'Playlista u shtua.',
        m3uTitle: 'URL M3U / M3U8', fileTitle: 'Skedar M3U / M3U8', importFile: 'Importo skedar', importing: 'Duke importuar…',
        fileImported: (n: number) => `${n} kanale u importuan.`, fileError: 'Skedari nuk u importua.',
        xtreamTitle: 'Xtream Codes', xtreamHelp: 'Të dhënat ruhen të enkriptuara vetëm në këtë pajisje dhe nuk sinkronizohen në Dropbox.',
        server: 'Adresa e serverit', username: 'Emri i përdoruesit', password: 'Fjalëkalimi', connectXtream: 'Lidh Xtream', connecting: 'Duke u lidhur…', xtreamAdded: 'Burimi Xtream u shtua.', xtreamError: 'Xtream nuk u lidh.',
        addonUrlError: 'Përdor një URL manifest.json të përputhshme me Stremio.', checkingSource: 'Duke kontrolluar…', addonAdded: 'Burimi u shtua.', addonError: 'Burimi nuk u shtua.',
        connectDropbox: 'Lidh Dropbox', finishDropbox: 'Përfundo lidhjen', authCode: 'Kodi i autorizimit Dropbox', cancel: 'Anulo',
        pairingHelp: 'Autorizo FILMA në Dropbox dhe vendos kodin njëpërdorimësh që shfaqet.',
        qrHelp: 'Skano QR me telefon, autorizo FILMA dhe pastaj shkruaj kodin njëpërdorimësh.',
        local: 'Lokal', sourceName: 'Emri i burimit', playlistName: 'Emri i playlistës',
      };
    }
    return {
      subtitle: 'Choose your languages and how FILMA finds and plays content.',
      languageCard: 'Languages', appLanguage: 'App language',
      contentLanguages: 'Search & audio',
      contentHelp: 'These languages are used by catalogues that support language filtering, to rank playback sources, and to select the audio track automatically. Tap them in the priority order you want.',
      automaticOrder: 'Automatic order: French → Albanian → English',
      resetOrder: 'Automatic order', subtitleRule: 'Subtitles',
      subtitleHelp: 'FILMA automatically prefers subtitles in the app language, then your selected audio languages.',
      appearance: 'Appearance', appearanceHelp: 'Compact shows more content. Comfortable makes cards and controls larger.',
      compact: 'Compact', comfortable: 'Comfortable',
      movieSources: 'Movie & series sources', movieSummary: 'FILMA Free is built in. Add other Stremio-compatible providers here if you use them.',
      tvSources: 'TV sources', tvSummary: 'Automatic channels + M3U/M3U8 URL, local file, or Xtream account.',
      sync: 'Sync', syncSummary: 'Continue Watching, favorites, profiles and sources through Dropbox.',
      deviceMode: 'Device mode', phone: 'Phone', tv: 'TV',
      open: 'Manage', hide: 'Hide', automatic: 'Automatic', builtIn: 'Built in',
      playable: 'Direct playback', catalog: 'Catalogue',
      playlistUrlError: 'Playlist URL must start with http:// or https://', playlistAdded: 'Playlist added.',
      m3uTitle: 'M3U / M3U8 URL', fileTitle: 'M3U / M3U8 file', importFile: 'Import file', importing: 'Importing…',
      fileImported: (n: number) => `${n} channel${n === 1 ? '' : 's'} imported.`, fileError: 'Could not import this file.',
      xtreamTitle: 'Xtream Codes', xtreamHelp: 'Credentials stay encrypted on this device and are not synchronized to Dropbox.',
      server: 'Server address', username: 'Username', password: 'Password', connectXtream: 'Connect Xtream', connecting: 'Connecting…', xtreamAdded: 'Xtream source added.', xtreamError: 'Could not connect Xtream.',
      addonUrlError: 'Use a Stremio-compatible manifest.json URL.', checkingSource: 'Checking…', addonAdded: 'Source added.', addonError: 'Could not add this source.',
      connectDropbox: 'Connect Dropbox', finishDropbox: 'Finish connection', authCode: 'Dropbox authorization code', cancel: 'Cancel',
      pairingHelp: 'Approve FILMA in Dropbox, then paste the one-time authorization code shown by Dropbox.',
      qrHelp: 'Scan the QR code with your phone, approve FILMA, then enter the one-time code.',
      local: 'Local', sourceName: 'Source name', playlistName: 'Playlist name',
    };
  }, [state.preferences.appLanguage]);

  const showMessage = (value: string, error = false) => {
    setMessage(value);
    setMessageIsError(error);
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
      showMessage(`${copy.fileError}${detail}`, true);
    } finally {
      setImportingPlaylist(false);
    }
  };

  const addPlaylistNow = () => {
    const url = playlistUrl.trim();
    if (!/^https?:\/\//i.test(url)) return showMessage(copy.playlistUrlError, true);
    addPlaylist(playlistName.trim() || copy.playlistName, url);
    setPlaylistName('');
    setPlaylistUrl('');
    showMessage(copy.playlistAdded);
  };

  const addXtreamNow = async () => {
    if (addingXtream) return;
    setAddingXtream(true);
    try {
      await addXtreamPlaylist(xtreamName.trim() || 'Xtream', xtreamServer, xtreamUsername, xtreamPassword);
      setXtreamName(''); setXtreamServer(''); setXtreamUsername(''); setXtreamPassword('');
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
    if (!/^https?:\/\//i.test(url) || !/manifest\.json(?:\?.*)?$/i.test(url)) return showMessage(copy.addonUrlError, true);
    setValidatingAddon(true);
    try {
      const validation = await validatePlaybackAddon(url);
      if (!validation.valid) return showMessage(copy.addonError, true);
      addAddon(addonName.trim() || validation.name || copy.sourceName, url);
      setAddonName(''); setManifestUrl('');
      showMessage(copy.addonAdded);
    } catch {
      showMessage(copy.addonError, true);
    } finally {
      setValidatingAddon(false);
    }
  };

  const finishPairing = async () => {
    await dropbox.finishPairing(pairingCode);
    setPairingCode('');
  };

  const syncStatus = dropbox.connected ? text.connected : dropbox.status === 'syncing' ? text.syncing : dropbox.status === 'checking' ? text.checking : text.notConnected;
  const selectedLanguages = state.preferences.preferredAudioLanguages;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingHorizontal: layout.horizontalPadding, paddingTop: layout.isTv ? 34 : 18, paddingBottom: layout.isTv ? 80 : 110 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.pageHeader}>
        <Text style={styles.kicker}>FILMA</Text>
        <Text style={[styles.pageTitle, { fontSize: layout.isTv ? 38 : 29 }]}>{text.settingsTitle}</Text>
        <Text style={styles.pageSubtitle}>{copy.subtitle}</Text>
      </View>

      {message ? <View style={[styles.message, messageIsError && styles.messageError]}><Text style={[styles.messageText, messageIsError && styles.messageTextError]}>{message}</Text></View> : null}

      <View style={styles.card}>
        <CardHeading icon="Aa" title={copy.languageCard} subtitle={copy.contentHelp} />
        <Text style={styles.fieldLabel}>{copy.appLanguage}</Text>
        <View style={styles.buttonRow}>
          {APP_LANGUAGE_OPTIONS.map(option => (
            <FocusButton key={option.code} compact active={state.preferences.appLanguage === option.code} label={option.label} onPress={() => setAppLanguage(option.code)} />
          ))}
        </View>

        <View style={styles.divider} />
        <Text style={styles.fieldLabel}>{copy.contentLanguages}</Text>
        <Text style={styles.fieldHelp}>{selectedLanguages.length ? selectedLanguages.map((language, index) => `${index + 1}. ${audioLanguageLabel(language, state.preferences.appLanguage)}`).join('   →   ') : copy.automaticOrder}</Text>
        <View style={[styles.buttonRow, styles.languageButtons]}>
          {AUDIO_LANGUAGE_OPTIONS.map(option => {
            const index = selectedLanguages.indexOf(option.code);
            return (
              <FocusButton
                key={option.code}
                compact
                active={index >= 0}
                label={index >= 0 ? `${index + 1}. ${option.labels[state.preferences.appLanguage]}` : option.labels[state.preferences.appLanguage]}
                onPress={() => toggleAudioLanguage(option.code)}
              />
            );
          })}
          <FocusButton compact active={!selectedLanguages.length} label={copy.resetOrder} onPress={clearAudioLanguages} />
        </View>

        <View style={styles.infoStrip}>
          <View style={styles.infoDot} />
          <View style={styles.infoText}><Text style={styles.infoTitle}>{copy.subtitleRule}</Text><Text style={styles.infoBody}>{copy.subtitleHelp}</Text></View>
        </View>
      </View>

      <View style={styles.card}>
        <CardHeading icon="◫" title={copy.appearance} subtitle={copy.appearanceHelp} />
        <View style={styles.buttonRow}>
          <FocusButton compact active={state.preferences.interfaceDensity === 'compact'} label={copy.compact} onPress={() => setInterfaceDensity('compact')} />
          <FocusButton compact active={state.preferences.interfaceDensity === 'comfortable'} label={copy.comfortable} onPress={() => setInterfaceDensity('comfortable')} />
        </View>
      </View>

      <SummaryCard
        icon="▶"
        title={copy.movieSources}
        subtitle={copy.movieSummary}
        status={`${addons.length} ${text.enabled.toLocaleLowerCase()}`}
        action={showMovieSources ? copy.hide : copy.open}
        open={showMovieSources}
        onToggle={() => setShowMovieSources(value => !value)}
      >
        <View style={styles.sourceList}>
          {addons.map(item => {
            const automatic = item.id.startsWith('auto-stremio:');
            const builtIn = item.id === 'auto-stremio:com.filma.archive';
            return (
              <View key={item.id} style={styles.sourceRow}>
                <View style={styles.sourceMain}>
                  <View style={styles.sourceNameLine}>
                    <Text style={styles.sourceName}>{item.name}</Text>
                    <View style={[styles.tag, builtIn && styles.tagGood]}><Text style={[styles.tagText, builtIn && styles.tagGoodText]}>{builtIn ? copy.playable : automatic ? copy.automatic : item.enabled ? text.enabled : text.disabled}</Text></View>
                  </View>
                  <Text numberOfLines={1} style={styles.sourceUrl}>{builtIn ? copy.builtIn : item.manifestUrl}</Text>
                </View>
                {!automatic ? <View style={styles.sourceActions}><FocusButton compact label={item.enabled ? text.disable : text.enable} onPress={() => setAddonEnabled(item.id, !item.enabled)} /><FocusButton compact label={text.remove} onPress={() => removeAddon(item.id)} /></View> : null}
              </View>
            );
          })}
          <View style={styles.divider} />
          <TextInput value={addonName} onChangeText={setAddonName} placeholder={copy.sourceName} placeholderTextColor={theme.muted} style={styles.input} />
          <TextInput value={manifestUrl} onChangeText={setManifestUrl} placeholder="https://provider.example/manifest.json" placeholderTextColor={theme.muted} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} />
          <FocusButton active label={validatingAddon ? copy.checkingSource : text.addAddon} onPress={() => void addAddonNow()} />
        </View>
      </SummaryCard>

      <SummaryCard
        icon="TV"
        title={copy.tvSources}
        subtitle={copy.tvSummary}
        status={`${playlists.length} ${text.enabled.toLocaleLowerCase()}`}
        action={showTvSources ? copy.hide : copy.open}
        open={showTvSources}
        onToggle={() => setShowTvSources(value => !value)}
      >
        <View style={styles.sourceList}>
          {playlists.map(item => {
            const automatic = item.id.startsWith('auto-tv:');
            const type = item.kind === 'xtream' ? 'Xtream' : item.kind === 'file' ? copy.local : automatic ? copy.automatic : 'M3U';
            return (
              <View key={item.id} style={styles.sourceRow}>
                <View style={styles.sourceMain}>
                  <View style={styles.sourceNameLine}><Text style={styles.sourceName}>{item.name}</Text><View style={styles.tag}><Text style={styles.tagText}>{type}</Text></View></View>
                  <Text numberOfLines={1} style={styles.sourceUrl}>{item.kind === 'file' ? copy.local : item.url}</Text>
                </View>
                {!automatic ? <View style={styles.sourceActions}><FocusButton compact label={item.enabled ? text.disable : text.enable} onPress={() => setPlaylistEnabled(item.id, !item.enabled)} /><FocusButton compact label={text.remove} onPress={() => removePlaylist(item.id)} /></View> : null}
              </View>
            );
          })}

          <View style={styles.divider} />
          <Text style={styles.fieldLabel}>{copy.m3uTitle}</Text>
          <TextInput value={playlistName} onChangeText={setPlaylistName} placeholder={copy.playlistName} placeholderTextColor={theme.muted} style={styles.input} />
          <TextInput value={playlistUrl} onChangeText={setPlaylistUrl} placeholder="https://example.com/list.m3u" placeholderTextColor={theme.muted} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} />
          <FocusButton active label={text.addPlaylist} onPress={addPlaylistNow} />

          {!Platform.isTV ? <><View style={styles.divider} /><Text style={styles.fieldLabel}>{copy.fileTitle}</Text><FocusButton active label={importingPlaylist ? copy.importing : copy.importFile} onPress={() => void importPlaylistNow()} /></> : null}

          <View style={styles.divider} />
          <Text style={styles.fieldLabel}>{copy.xtreamTitle}</Text>
          <Text style={styles.fieldHelp}>{copy.xtreamHelp}</Text>
          <TextInput value={xtreamName} onChangeText={setXtreamName} placeholder={copy.sourceName} placeholderTextColor={theme.muted} style={styles.input} />
          <TextInput value={xtreamServer} onChangeText={setXtreamServer} placeholder={copy.server} placeholderTextColor={theme.muted} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} />
          <TextInput value={xtreamUsername} onChangeText={setXtreamUsername} placeholder={copy.username} placeholderTextColor={theme.muted} autoCapitalize="none" autoCorrect={false} style={styles.input} />
          <TextInput value={xtreamPassword} onChangeText={setXtreamPassword} placeholder={copy.password} placeholderTextColor={theme.muted} autoCapitalize="none" autoCorrect={false} secureTextEntry style={styles.input} />
          <FocusButton active label={addingXtream ? copy.connecting : copy.connectXtream} onPress={() => void addXtreamNow()} />
        </View>
      </SummaryCard>

      <SummaryCard
        icon="☁"
        title={copy.sync}
        subtitle={copy.syncSummary}
        status={syncStatus}
        action={showSync ? copy.hide : copy.open}
        open={showSync}
        onToggle={() => setShowSync(value => !value)}
      >
        <View style={styles.sourceList}>
          {dropbox.error ? <Text style={styles.error}>{dropbox.error}</Text> : null}
          {dropbox.pairingUrl && !dropbox.connected ? (
            <View style={styles.pairingPanel}>
              <Text style={styles.fieldHelp}>{dropbox.isTv ? copy.qrHelp : copy.pairingHelp}</Text>
              {dropbox.isTv ? <View style={styles.qrWrap}><QRCode value={dropbox.pairingUrl} size={250} backgroundColor="#fff" color="#000" quietZone={10} /></View> : null}
              <TextInput value={pairingCode} onChangeText={setPairingCode} placeholder={copy.authCode} placeholderTextColor={theme.muted} autoCapitalize="none" autoCorrect={false} style={styles.input} />
              <View style={styles.buttonRow}><FocusButton active label={copy.finishDropbox} onPress={() => void finishPairing()} /><FocusButton label={copy.cancel} onPress={() => { setPairingCode(''); dropbox.cancelPairing(); }} /></View>
            </View>
          ) : !dropbox.connected ? (
            <FocusButton active label={copy.connectDropbox} onPress={() => void dropbox.connect()} />
          ) : (
            <View style={styles.buttonRow}><FocusButton active label={dropbox.status === 'syncing' ? text.syncing : text.syncNow} onPress={() => void dropbox.syncNow().catch(() => undefined)} /><FocusButton label={text.disconnect} onPress={() => void dropbox.disconnect()} /></View>
          )}
          {dropbox.lastSyncAt ? <Text style={styles.fieldHelp}>{text.lastSync}: {new Date(dropbox.lastSyncAt).toLocaleString()}</Text> : null}
        </View>
      </SummaryCard>

      <View style={styles.card}>
        <CardHeading icon="▣" title={copy.deviceMode} subtitle={isNativeTv ? 'TV hardware' : isTvMode ? 'TV interface' : 'Phone interface'} />
        <View style={styles.buttonRow}>
          {!isNativeTv ? <FocusButton compact active={!isTvMode} label={copy.phone} onPress={() => setTvModeEnabled(false)} /> : null}
          <FocusButton compact active={isTvMode} label={copy.tv} onPress={() => setTvModeEnabled(true)} />
        </View>
        <View style={styles.divider} />
        <Text style={styles.deviceText}>FILMA 0.1.5 · build 6</Text>
        <Text style={styles.deviceText}>{text.device}: {deviceId}</Text>
      </View>
    </ScrollView>
  );
}

function CardHeading({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return <View style={styles.cardHeading}><View style={styles.icon}><Text style={styles.iconText}>{icon}</Text></View><View style={styles.cardHeadingText}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardSubtitle}>{subtitle}</Text></View></View>;
}

function SummaryCard({ icon, title, subtitle, status, action, open, onToggle, children }: { icon: string; title: string; subtitle: string; status: string; action: string; open: boolean; onToggle(): void; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <CardHeading icon={icon} title={title} subtitle={subtitle} />
      <View style={styles.summaryFooter}><View style={styles.statusPill}><View style={styles.statusDot} /><Text style={styles.statusText}>{status}</Text></View><FocusButton compact active={open} label={action} onPress={onToggle} /></View>
      {open ? children : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07090f' },
  pageHeader: { maxWidth: 900, marginBottom: 17 },
  kicker: { color: theme.accent, fontSize: 10, fontWeight: '900', letterSpacing: 2.2 },
  pageTitle: { color: '#f7f8fb', fontWeight: '900', letterSpacing: -0.8, marginTop: 4 },
  pageSubtitle: { color: '#8993a5', marginTop: 5, fontSize: 12, lineHeight: 18 },
  card: { width: '100%', maxWidth: 980, borderRadius: 17, borderWidth: 1, borderColor: '#222a39', backgroundColor: '#10141e', padding: Platform.isTV ? 20 : 14, marginBottom: 12 },
  cardHeading: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 14 },
  cardHeadingText: { flex: 1 },
  icon: { width: 37, height: 37, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#20283a' },
  iconText: { color: '#eef2f8', fontSize: 11, fontWeight: '900' },
  cardTitle: { color: '#f3f5f9', fontSize: Platform.isTV ? 20 : 17, fontWeight: '900' },
  cardSubtitle: { color: '#808a9e', marginTop: 3, fontSize: Platform.isTV ? 13 : 11, lineHeight: Platform.isTV ? 19 : 16 },
  fieldLabel: { color: '#e9edf4', fontSize: 12, fontWeight: '900', marginBottom: 8 },
  fieldHelp: { color: '#818b9d', fontSize: 10, lineHeight: 15, marginBottom: 9 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  languageButtons: { marginTop: 7 },
  divider: { height: 1, backgroundColor: '#252c3a', marginVertical: 14 },
  infoStrip: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', borderRadius: 12, backgroundColor: '#0b1019', borderWidth: 1, borderColor: '#202837', padding: 11, marginTop: 13 },
  infoDot: { width: 7, height: 7, borderRadius: 99, backgroundColor: '#60dca2', marginTop: 4 },
  infoText: { flex: 1 },
  infoTitle: { color: '#e8ecf3', fontSize: 11, fontWeight: '900' },
  infoBody: { color: '#7f899b', fontSize: 10, lineHeight: 15, marginTop: 2 },
  summaryFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: '#0b1019', paddingHorizontal: 9, paddingVertical: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: '#5bd89e' },
  statusText: { color: '#a8b1c0', fontSize: 9, fontWeight: '800' },
  sourceList: { borderTopWidth: 1, borderTopColor: '#252c3a', marginTop: 13, paddingTop: 4 },
  sourceRow: { flexDirection: Platform.isTV ? 'row' : 'column', alignItems: Platform.isTV ? 'center' : 'stretch', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#202735' },
  sourceMain: { flex: 1 },
  sourceNameLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  sourceName: { color: '#edf0f5', fontSize: 12, fontWeight: '900' },
  sourceUrl: { color: '#6f798c', marginTop: 3, fontSize: 9 },
  sourceActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tag: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: '#252c3a' },
  tagGood: { backgroundColor: '#173c30' },
  tagText: { color: '#98a2b4', fontSize: 8, fontWeight: '900' },
  tagGoodText: { color: '#65dfa8' },
  input: { width: '100%', minHeight: 43, borderWidth: 1, borderColor: '#30384a', borderRadius: 11, backgroundColor: '#090d15', color: '#eef1f6', paddingHorizontal: 11, marginBottom: 8, fontSize: 12 },
  pairingPanel: { paddingTop: 8 },
  qrWrap: { alignSelf: 'flex-start', padding: 6, backgroundColor: '#fff', borderRadius: 10, marginBottom: 10 },
  error: { color: '#fda4af', fontSize: 11, marginBottom: 8 },
  message: { maxWidth: 980, borderRadius: 11, padding: 10, backgroundColor: '#123229', borderWidth: 1, borderColor: '#245b49', marginBottom: 12 },
  messageError: { backgroundColor: '#35191d', borderColor: '#6b2932' },
  messageText: { color: '#7de5b7', fontSize: 11, fontWeight: '800' },
  messageTextError: { color: '#fda4af' },
  deviceText: { color: '#687286', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 9, marginTop: 4 },
});
