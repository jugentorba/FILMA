const assert = require('node:assert/strict');
const { isPlaybackComplete, shouldShowInContinueWatching } = require('../.sync-test-build/services/progress.js');
const { mergeStates } = require('../.sync-test-build/services/sync.js');
const { LEGACY_TIMESTAMP, normalizeState, normalizeSyncEnvelope } = require('../.sync-test-build/services/stateSchema.js');

const at = second => `2026-08-25T08:00:${String(second).padStart(2, '0')}.000Z`;

function empty(mode = 'movies') {
  return {
    mode,
    preferences: { appLanguage: 'en', preferredAudioLanguages: [], interfaceDensity: 'compact', updatedAt: LEGACY_TIMESTAMP },
    progress: {},
    favorites: {},
    playlists: [],
    addons: [],
  };
}

{
  assert.equal(isPlaybackComplete(919, 1000), false, '91.9% is still resumable');
  assert.equal(isPlaybackComplete(920, 1000), true, '92% marks playback complete');
  assert.equal(isPlaybackComplete(10, 0), false, 'unknown duration never marks playback complete');

  const base = {
    mediaId: 'film',
    durationSeconds: 1000,
    updatedAt: at(1),
    deviceId: 'phone',
  };
  assert.equal(shouldShowInContinueWatching({ ...base, positionSeconds: 29 }), false, 'very short accidental playback is hidden');
  assert.equal(shouldShowInContinueWatching({ ...base, positionSeconds: 30 }), true, 'meaningful playback enters Continue Watching');
  assert.equal(shouldShowInContinueWatching({ ...base, positionSeconds: 950, completed: true }), false, 'completed playback stays out of Continue Watching');
}

{
  const legacy = normalizeState({
    mode: 'live',
    favorites: { film: { mediaId: 'film', createdAt: at(1) } },
    playlists: [{ id: 'p1', name: 'TV', url: 'https://example.test/list.m3u', enabled: true }],
    addons: [{ id: 'a1', name: 'Movies', manifestUrl: 'https://example.test/manifest.json', enabled: true }],
  });

  assert.equal(legacy.mode, 'live');
  assert.equal(legacy.preferences.appLanguage, 'en', 'legacy installs receive a safe UI language default');
  assert.deepEqual(legacy.preferences.preferredAudioLanguages, [], 'legacy installs default to any audio language');
  assert.equal(legacy.preferences.interfaceDensity, 'compact', 'legacy installs use the denser responsive interface');
  assert.equal(legacy.favorites.film.updatedAt, at(1));
  assert.equal(legacy.playlists[0].updatedAt, LEGACY_TIMESTAMP);
  assert.equal(legacy.addons[0].updatedAt, LEGACY_TIMESTAMP);
}

{
  const normalized = normalizeState({
    ...empty(),
    preferences: {
      appLanguage: 'fr',
      preferredAudioLanguages: ['fr', 'sq', 'fr', 'invalid'],
      interfaceDensity: 'comfortable',
      updatedAt: at(8),
    },
    progress: {
      film: {
        mediaId: 'film',
        positionSeconds: 950,
        durationSeconds: 1000,
        updatedAt: at(8),
        deviceId: 'phone',
        completed: true,
      },
    },
  });
  assert.equal(normalized.preferences.appLanguage, 'fr');
  assert.deepEqual(normalized.preferences.preferredAudioLanguages, ['fr', 'sq'], 'audio language preferences are validated and deduplicated');
  assert.equal(normalized.preferences.interfaceDensity, 'comfortable', 'valid appearance density survives normalization');
  assert.equal(normalized.progress.film.completed, true, 'completed playback survives normalization');
}

{
  const invalidDensity = normalizeState({
    ...empty(),
    preferences: {
      appLanguage: 'en',
      preferredAudioLanguages: [],
      interfaceDensity: 'gigantic',
      updatedAt: at(9),
    },
  });
  assert.equal(invalidDensity.preferences.interfaceDensity, 'compact', 'invalid appearance density falls back safely');
}

{
  const envelope = normalizeSyncEnvelope({ schemaVersion: 1, updatedAt: at(2), state: empty() });
  assert.ok(envelope);
  assert.equal(envelope.schemaVersion, 2);
}

{
  const local = empty('live');
  local.preferences = { appLanguage: 'en', preferredAudioLanguages: ['en'], interfaceDensity: 'compact', updatedAt: at(10) };
  local.favorites.film = { mediaId: 'film', createdAt: at(1), updatedAt: at(10) };
  local.progress.film = { mediaId: 'film', positionSeconds: 100, durationSeconds: 1000, updatedAt: at(10), deviceId: 'phone' };
  local.playlists.push({ id: 'p1', name: 'TV', url: 'https://example.test/list.m3u', enabled: true, createdAt: at(1), updatedAt: at(10) });

  const remote = empty('movies');
  remote.preferences = { appLanguage: 'fr', preferredAudioLanguages: ['fr', 'sq'], interfaceDensity: 'comfortable', updatedAt: at(20) };
  remote.favorites.film = { mediaId: 'film', createdAt: at(1), updatedAt: at(20), deletedAt: at(20) };
  remote.progress.film = { mediaId: 'film', positionSeconds: 950, durationSeconds: 1000, updatedAt: at(20), deviceId: 'tv', completed: true };
  remote.playlists.push({ id: 'p1', name: 'TV', url: 'https://example.test/list.m3u', enabled: true, createdAt: at(1), updatedAt: at(20), deletedAt: at(20) });
  remote.addons.push({ id: 'a2', name: 'Series', manifestUrl: 'https://example.test/manifest.json', enabled: true, createdAt: at(20), updatedAt: at(20) });

  const merged = mergeStates(local, remote);
  assert.equal(merged.mode, 'live', 'screen mode remains local to the device');
  assert.equal(merged.preferences.appLanguage, 'fr', 'newest synchronized preferences win');
  assert.deepEqual(merged.preferences.preferredAudioLanguages, ['fr', 'sq']);
  assert.equal(merged.preferences.interfaceDensity, 'comfortable', 'appearance density follows the newest synchronized preferences');
  assert.equal(merged.progress.film.positionSeconds, 950, 'newest progress wins');
  assert.equal(merged.progress.film.completed, true, 'newest completed state wins across devices');
  assert.equal(merged.favorites.film.deletedAt, at(20), 'newer favorite deletion wins');
  assert.equal(merged.playlists[0].deletedAt, at(20), 'newer playlist deletion wins');
  assert.equal(merged.addons[0].id, 'a2', 'remote-only entities are retained');

  const readded = empty();
  readded.favorites.film = { mediaId: 'film', createdAt: at(1), updatedAt: at(30) };
  const afterReadd = mergeStates(readded, merged);
  assert.equal(afterReadd.favorites.film.deletedAt, undefined, 'newer re-add beats an older tombstone');
}

{
  const local = empty();
  local.progress.episode = {
    mediaId: 'episode', positionSeconds: 60, durationSeconds: 1800, updatedAt: at(10), deviceId: 'phone',
    item: {
      id: 'episode', title: 'Series · Old episode title',
      source: { kind: 'stremio', manifestUrl: 'https://example.test/manifest.json', mediaType: 'series', mediaId: 'tt123', videoId: 'tt123:1:1' },
    },
  };

  const remote = empty();
  remote.progress.episode = {
    mediaId: 'episode', positionSeconds: 420, durationSeconds: 1800, updatedAt: at(20), deviceId: 'tv',
    item: {
      id: 'episode', title: 'Series · Pilot', subtitle: 'S1 E1',
      source: { kind: 'stremio', manifestUrl: 'https://example.test/manifest.json', mediaType: 'series', mediaId: 'tt123', videoId: 'tt123:1:1' },
    },
  };

  const merged = mergeStates(local, remote);
  assert.equal(merged.progress.episode.positionSeconds, 420, 'newest episode progress wins');
  assert.equal(merged.progress.episode.item.title, 'Series · Pilot', 'resume snapshot follows newest progress');
  assert.equal(merged.progress.episode.item.source.videoId, 'tt123:1:1', 'episode stream identity is preserved');

  const persisted = normalizeState(merged);
  assert.equal(persisted.progress.episode.item.title, 'Series · Pilot', 'episode title survives state normalization');
  assert.equal(persisted.progress.episode.item.source.videoId, 'tt123:1:1', 'episode video id survives state normalization');
}

console.log('FILMA sync and playback-state tests passed.');
