import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useDropboxSync } from '../store/DropboxSyncContext';
import { useFilma } from '../store/FilmaContext';
import { FocusButton } from '../ui/FocusButton';
import { theme } from '../ui/theme';

export function SettingsScreen() {
  const { deviceId, state, addPlaylist, removePlaylist, addAddon, removeAddon } = useFilma();
  const dropbox = useDropboxSync();
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
    addAddon(addonName.trim() || 'My add-on', url);
    setAddonName('');
    setManifestUrl('');
    setMessage('Add-on added.');
  };

  const syncStatus = dropbox.status === 'syncing'
    ? 'Syncing…'
    : dropbox.status === 'pairing'
      ? 'Pairing…'
      : dropbox.connected
        ? 'Connected'
        : dropbox.status === 'checking'
          ? 'Checking…'
          : 'Not connected';

  const finishPairing = async () => {
    await dropbox.finishTvPairing(pairingCode);
    setPairingCode('');
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.intro}>
        FILMA ships without unauthorized stream lists. Add playlists and compatible add-ons you are allowed to use.
      </Text>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cross-device sync</Text>
        <Text style={styles.help}>
          Continue Watching, favorites, playlists and add-ons synchronize through your own Dropbox App Folder. FILMA stores the OAuth session securely on each device and never embeds a Dropbox app secret.
        </Text>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Dropbox</Text>
          <Text style={[styles.statusValue, dropbox.connected ? styles.statusOk : undefined]}>{syncStatus}</Text>
        </View>

        {!dropbox.configured ? (
          <Text style={styles.warning}>
            Dropbox login is implemented, but this build still needs EXPO_PUBLIC_DROPBOX_APP_KEY before sign-in can be enabled.
          </Text>
        ) : null}

        {dropbox.error ? <Text style={styles.error}>{dropbox.error}</Text> : null}

        {dropbox.needsTvPairing && dropbox.tvPairingUrl && !dropbox.connected ? (
          <View style={styles.pairingPanel}>
            <Text style={styles.pairingTitle}>Connect this TV to Dropbox</Text>
            <Text style={styles.help}>
              1. Scan this QR code with your phone. 2. Approve FILMA in Dropbox. 3. Dropbox will show a one-time authorization code. 4. Enter that code below.
            </Text>
            <View style={styles.qrWrap}>
              <QRCode
                value={dropbox.tvPairingUrl}
                size={Platform.isTV ? 260 : 190}
                backgroundColor="#ffffff"
                color="#000000"
                quietZone={12}
              />
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
            <View style={styles.syncActions}>
              <FocusButton
                label="Finish pairing"
                active
                preferredFocus
                onPress={() => void finishPairing()}
              />
              <FocusButton
                label="New QR code"
                onPress={() => void dropbox.beginTvPairing()}
              />
              <FocusButton
                label="Cancel"
                onPress={() => {
                  setPairingCode('');
                  dropbox.cancelTvPairing();
                }}
              />
            </View>
          </View>
        ) : null}

        {!dropbox.tvPairingUrl || dropbox.connected ? (
          <View style={styles.syncActions}>
            {!dropbox.connected ? (
              <FocusButton
                label={dropbox.needsTvPairing ? 'Pair Dropbox' : 'Connect Dropbox'}
                active
                preferredFocus
                onPress={() => void dropbox.connect()}
              />
            ) : (
              <>
                <FocusButton
                  label={dropbox.status === 'syncing' ? 'Syncing…' : 'Sync now'}
                  active
                  preferredFocus
                  onPress={() => void dropbox.syncNow().catch(() => undefined)}
                />
                <FocusButton
                  label="Disconnect"
                  onPress={() => void dropbox.disconnect()}
                />
              </>
            )}
          </View>
        ) : null}

        {dropbox.lastSyncAt ? (
          <Text style={styles.lastSync}>Last sync: {new Date(dropbox.lastSyncAt).toLocaleString()}</Text>
        ) : null}
        <Text style={styles.device}>This installation: {deviceId}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Live TV playlists</Text>
        <Text style={styles.help}>M3U / M3U8 playlist URL</Text>
        <TextInput
          value={playlistName}
          onChangeText={setPlaylistName}
          placeholder="Playlist name"
          placeholderTextColor={theme.muted}
          style={styles.input}
        />
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
        <View style={styles.actionRow}><FocusButton label="Add playlist" active onPress={addPlaylistNow} /></View>

        {playlists.map(item => (
          <View key={item.id} style={styles.sourceRow}>
            <View style={styles.sourceText}>
              <Text style={styles.sourceName}>{item.name}</Text>
              <Text numberOfLines={1} style={styles.sourceUrl}>{item.url}</Text>
            </View>
            <FocusButton compact label="Remove" onPress={() => removePlaylist(item.id)} />
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Movie / series add-ons</Text>
        <Text style={styles.help}>Stremio-compatible add-on manifest</Text>
        <TextInput
          value={addonName}
          onChangeText={setAddonName}
          placeholder="Add-on name"
          placeholderTextColor={theme.muted}
          style={styles.input}
        />
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
        <View style={styles.actionRow}><FocusButton label="Add add-on" active onPress={addAddonNow} /></View>

        {addons.map(item => (
          <View key={item.id} style={styles.sourceRow}>
            <View style={styles.sourceText}>
              <Text style={styles.sourceName}>{item.name}</Text>
              <Text numberOfLines={1} style={styles.sourceUrl}>{item.manifestUrl}</Text>
            </View>
            <FocusButton compact label="Remove" onPress={() => removeAddon(item.id)} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    paddingHorizontal: Platform.isTV ? 64 : 20,
    paddingTop: Platform.isTV ? 44 : 24,
    paddingBottom: 100,
  },
  title: {
    color: theme.text,
    fontSize: Platform.isTV ? 42 : 30,
    fontWeight: '900',
  },
  intro: {
    color: theme.muted,
    maxWidth: 780,
    marginTop: 8,
    marginBottom: 22,
    fontSize: 15,
    lineHeight: 22,
  },
  message: {
    color: theme.success,
    marginBottom: 16,
    fontWeight: '700',
  },
  card: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 18,
    padding: Platform.isTV ? 26 : 18,
    marginBottom: 20,
    maxWidth: 960,
  },
  cardTitle: {
    color: theme.text,
    fontWeight: '900',
    fontSize: Platform.isTV ? 25 : 20,
    marginBottom: 6,
  },
  help: {
    color: theme.muted,
    marginBottom: 14,
    lineHeight: Platform.isTV ? 25 : 21,
  },
  input: {
    minHeight: 52,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    backgroundColor: theme.background,
    color: theme.text,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  actionRow: {
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: 14,
    marginTop: 14,
  },
  sourceText: {
    flex: 1,
  },
  sourceName: {
    color: theme.text,
    fontWeight: '800',
    fontSize: 16,
  },
  sourceUrl: {
    color: theme.muted,
    marginTop: 3,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  statusLabel: {
    color: theme.text,
    fontWeight: '800',
  },
  statusValue: {
    color: theme.muted,
    fontWeight: '800',
  },
  statusOk: {
    color: theme.success,
  },
  warning: {
    color: '#fde68a',
    lineHeight: 21,
    marginTop: 10,
  },
  error: {
    color: '#fda4af',
    lineHeight: 21,
    marginTop: 10,
  },
  pairingPanel: {
    marginTop: 16,
    padding: Platform.isTV ? 22 : 16,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 16,
    backgroundColor: theme.background,
    alignItems: 'flex-start',
  },
  pairingTitle: {
    color: theme.text,
    fontSize: Platform.isTV ? 23 : 18,
    fontWeight: '900',
    marginBottom: 8,
  },
  qrWrap: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignSelf: Platform.isTV ? 'center' : 'flex-start',
    marginVertical: 12,
  },
  pairingInput: {
    width: '100%',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: Platform.isTV ? 20 : 16,
    marginTop: 6,
  },
  syncActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
    marginBottom: 12,
  },
  lastSync: {
    color: theme.muted,
    marginBottom: 8,
  },
  device: {
    color: theme.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
  },
});
