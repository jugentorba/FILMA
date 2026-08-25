import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFilma } from '../store/FilmaContext';
import { FocusButton } from '../ui/FocusButton';
import { theme } from '../ui/theme';

export function SettingsScreen() {
  const { deviceId, state, addPlaylist, removePlaylist, addAddon, removeAddon } = useFilma();
  const [playlistName, setPlaylistName] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [addonName, setAddonName] = useState('');
  const [manifestUrl, setManifestUrl] = useState('');
  const [message, setMessage] = useState<string>();

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

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.intro}>
        FILMA ships without unauthorized stream lists. Add playlists and compatible add-ons you are allowed to use.
      </Text>

      {message ? <Text style={styles.message}>{message}</Text> : null}

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

        {state.playlists.map(item => (
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

        {state.addons.map(item => (
          <View key={item.id} style={styles.sourceRow}>
            <View style={styles.sourceText}>
              <Text style={styles.sourceName}>{item.name}</Text>
              <Text numberOfLines={1} style={styles.sourceUrl}>{item.manifestUrl}</Text>
            </View>
            <FocusButton compact label="Remove" onPress={() => removeAddon(item.id)} />
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cross-device sync</Text>
        <Text style={styles.help}>
          The merge engine is enabled in the project. A Dropbox transport can use the same data model without a paid FILMA server.
        </Text>
        <Text style={styles.device}>This installation: {deviceId}</Text>
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
    lineHeight: 21,
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
  device: {
    color: theme.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
  },
});
