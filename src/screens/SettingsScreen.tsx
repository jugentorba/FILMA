import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { APP_LANGUAGE_OPTIONS, AUDIO_LANGUAGE_OPTIONS, stringsFor } from '../i18n';
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
    removePlaylist,
    addAddon,
    removeAddon,
  } = useFilma();
  const dropbox = useDropboxSync();
  const text = stringsFor(state.preferences.appLanguage);
  const [playlistName, setPlaylistName] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [addonName, setAddonName] = useState('');
  const [manifestUrl, setManifestUrl] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [message, setMessage] = useState<string>();

  const playlists = useMemo(() => state.playlists.filter(item => !item.deletedAt), [state.playlists]);
  const addons = useMemo(() => state.addons.filter(item => !item.deletedAt), [state.addons]);

  const addPlaylistNow = () => {
    const url = playlistUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      setMessage('Playlist URL must start with http:// or https://');
      return;
    }
    addPlaylist(playlistName.trim() || 'My playlist', url);
    setPlaylistName('');
    setPlaylistUrl('');
    setMessage('Playlist added.');
  };

  const addAddonNow = () => {
    const url = manifestUrl.trim();
    if (!/^https?:\/\//i.test(url) || !/manifest\.json(?:\?.*)?$/i.test(url)) {
      setMessage('Use a full Stremio-compatible manifest.json URL.');
      return;
    }
    addAddon(addonName.trim() || 'My source', url);
    setAddonName('');
    setManifestUrl('');
    setMessage('Movie source added.');
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
    await dropbox.finishTvPairing(pairingCode);
    setPairingCode('');
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.heading}>
        <Text style={styles.kicker}>FILMA</Text>
        <Text style={styles.title}>{text.settingsTitle}</Text>
        <Text style={styles.intro}>{text.settingsIntro}</Text>
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}

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
            <FocusButton
              key={option.code}
              compact
              label={option.label}
              active={state.preferences.appLanguage === option.code}
              onPress={() => setAppLanguage(option.code)}
            />
          ))}
        </View>

        <View style={styles.divider} />
        <Text style={styles.fieldLabel}>{text.audioLanguages}</Text>
        <View style={styles.optionRow}>
          <FocusButton
            compact
            label={text.anyLanguage}
            active={!state.preferences.preferredAudioLanguages.length}
            onPress={clearAudioLanguages}
          />
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

        {!dropbox.configured ? <Text style={styles.warning}>Dropbox App Key is missing from this build.</Text> : null}
        {dropbox.error ? <Text style={styles.error}>{dropbox.error}</Text> : null}

        {dropbox.needsTvPairing && dropbox.tvPairingUrl && !dropbox.connected ? (
          <View style={styles.pairingPanel}>
            <Text style={styles.pairingTitle}>Connect this TV to Dropbox</Text>
            <Text style={styles.help}>Scan the QR code, approve FILMA in Dropbox, then enter the one-time authorization code.</Text>
            <View style={styles.qrWrap}>
              <QRCode value={dropbox.tvPairingUrl} size={Platform.isTV ? 260 : 190} backgroundColor="#ffffff" color="#000000" quietZone={12} />
            </View>
            <TextInput
              value={pairingCode}
              onChangeText={setPairingCode}
              placeholder="Dropbox authorization code"
              placeholderTextColor={theme.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, styles.pairingInput]}
            />
            <View style={styles.optionRow}>
              <FocusButton label="Finish pairing" active preferredFocus onPress={() => void finishPairing()} />
              <FocusButton label="New QR code" onPress={() => void dropbox.beginTvPairing()} />
              <FocusButton label="Cancel" onPress={() => { setPairingCode(''); dropbox.cancelTvPairing(); }} />
            </View>
          </View>
        ) : null}

        {!dropbox.tvPairingUrl || dropbox.connected ? (
          <View style={styles.optionRow}>
            {!dropbox.connected ? (
              <FocusButton
                label={dropbox.needsTvPairing ? text.pairDropbox : text.connectDropbox}
                active
                preferredFocus
                onPress={() => void dropbox.connect()}
              />
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
        <View style={styles.actionRow}><FocusButton label={text.addAddon} active onPress={addAddonNow} /></View>
        {addons.map(item => (
          <View key={item.id} style={styles.sourceRow}>
            <View style={styles.sourceText}>
              <Text style={styles.sourceName}>{item.name}</Text>
              <Text numberOfLines={1} style={styles.sourceUrl}>{item.manifestUrl}</Text>
            </View>
            <FocusButton compact label={text.remove} onPress={() => removeAddon(item.id)} />
          </View>
        ))}
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
        {playlists.map(item => (
          <View key={item.id} style={styles.sourceRow}>
            <View style={styles.sourceText}>
              <Text style={styles.sourceName}>{item.name}</Text>
              <Text numberOfLines={1} style={styles.sourceUrl}>{item.url}</Text>
            </View>
            <FocusButton compact label={text.remove} onPress={() => removePlaylist(item.id)} />
          </View>
        ))}
      </View>

      <View style={styles.deviceCard}>
        <Text style={styles.deviceTitle}>{text.advanced}</Text>
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
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 14, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 14, marginTop: 14 },
  sourceText: { flex: 1 },
  sourceName: { color: theme.text, fontWeight: '900', fontSize: 16 },
  sourceUrl: { color: theme.muted, marginTop: 4 },
  lastSync: { color: theme.muted, marginTop: 14 },
  deviceCard: { width: '100%', maxWidth: 980, paddingHorizontal: 4, paddingVertical: 10 },
  deviceTitle: { color: theme.muted, fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2 },
  device: { color: '#70798c', marginTop: 6, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11 },
});
