import * as FileSystem from 'expo-file-system/legacy';
import type { LiveChannel, PlaylistSource } from '../types';
import { fetchPlaylist, parseM3U } from './m3u';
import { playlistFetchUrl } from './iptvAuth';

const PLAYLIST_DIRECTORY = 'filma-playlists';

export type ImportedLocalPlaylist = {
  name: string;
  uri: string;
  channelCount: number;
};

function persistentDirectory(): string {
  if (!FileSystem.documentDirectory) {
    throw new Error('Persistent app storage is not available on this device.');
  }
  return `${FileSystem.documentDirectory}${PLAYLIST_DIRECTORY}/`;
}

function safeFileName(originalName: string): string {
  const trimmed = originalName.trim() || 'playlist.m3u';
  const withExtension = /\.m3u8?$/i.test(trimmed) ? trimmed : `${trimmed}.m3u`;
  const safe = withExtension
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'playlist.m3u';
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
}

function defaultDisplayName(fileName: string): string {
  return fileName.replace(/\.m3u8?$/i, '').trim() || 'Imported playlist';
}

function parseLocalPlaylist(text: string): LiveChannel[] {
  const channels = parseM3U(text);
  if (!channels.length) throw new Error('The selected file contains no playable HTTP/HLS channels.');
  return channels;
}

export async function importLocalPlaylistFile(): Promise<ImportedLocalPlaylist | null> {
  // DocumentPicker is mobile-only in Expo. Import it lazily so Apple TV never
  // attempts to resolve the native picker module just by opening Settings.
  const DocumentPicker = await import('expo-document-picker');
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  if (!asset?.uri) throw new Error('The selected playlist could not be read.');

  const text = await FileSystem.readAsStringAsync(asset.uri);
  const channels = parseLocalPlaylist(text);
  const directory = persistentDirectory();
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const target = `${directory}${safeFileName(asset.name)}`;
  await FileSystem.copyAsync({ from: asset.uri, to: target });

  return {
    name: defaultDisplayName(asset.name),
    uri: target,
    channelCount: channels.length,
  };
}

export async function loadPlaylistSource(source: PlaylistSource): Promise<LiveChannel[]> {
  if (source.kind === 'file') {
    const text = await FileSystem.readAsStringAsync(source.url);
    return parseLocalPlaylist(text);
  }

  const url = await playlistFetchUrl(source);
  return fetchPlaylist(url);
}

export async function deleteLocalPlaylistFile(source: PlaylistSource): Promise<void> {
  if (source.kind !== 'file' || !source.url.startsWith('file://')) return;
  await FileSystem.deleteAsync(source.url, { idempotent: true });
}
