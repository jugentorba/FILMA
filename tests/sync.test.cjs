const assert = require('node:assert/strict');
const { mergeStates } = require('../.sync-test-build/services/sync.js');
const { LEGACY_TIMESTAMP, normalizeState, normalizeSyncEnvelope } = require('../.sync-test-build/services/stateSchema.js');

const at = second => `2026-08-25T08:00:${String(second).padStart(2, '0')}.000Z`;

function empty(mode = 'movies') {
  return { mode, progress: {}, favorites: {}, playlists: [], addons: [] };
}

{
  const legacy = normalizeState({
    mode: 'live',
    favorites: { film: { mediaId: 'film', createdAt: at(1) } },
    playlists: [{ id: 'p1', name: 'TV', url: 'https://example.test/list.m3u', enabled: true }],
    addons: [{ id: 'a1', name: 'Movies', manifestUrl: 'https://example.test/manifest.json', enabled: true }],
  });

  assert.equal(legacy.mode, 'live');
  assert.equal(legacy.favorites.film.updatedAt, at(1));
  assert.equal(legacy.playlists[0].updatedAt, LEGACY_TIMESTAMP);
  assert.equal(legacy.addons[0].updatedAt, LEGACY_TIMESTAMP);
}

{
  const envelope = normalizeSyncEnvelope({
    schemaVersion: 1,
    updatedAt: at(2),
    state: empty(),
  });
  assert.ok(envelope);
  assert.equal(envelope.schemaVersion, 2);
}

{
  const local = empty('live');
  local.favorites.film = {
    mediaId: 'film',
    createdAt: at(1),
    updatedAt: at(10),
  };
  local.progress.film = {
    mediaId: 'film',
    positionSeconds: 100,
    durationSeconds: 1000,
    updatedAt: at(10),
    deviceId: 'phone',
  };
  local.playlists.push({
    id: 'p1',
    name: 'TV',
    url: 'https://example.test/list.m3u',
    enabled: true,
    createdAt: at(1),
    updatedAt: at(10),
  });

  const remote = empty('movies');
  remote.favorites.film = {
    mediaId: 'film',
    createdAt: at(1),
    updatedAt: at(20),
    deletedAt: at(20),
  };
  remote.progress.film = {
    mediaId: 'film',
    positionSeconds: 250,
    durationSeconds: 1000,
    updatedAt: at(20),
    deviceId: 'tv',
  };
  remote.playlists.push({
    id: 'p1',
    name: 'TV',
    url: 'https://example.test/list.m3u',
    enabled: true,
    createdAt: at(1),
    updatedAt: at(20),
    deletedAt: at(20),
  });
  remote.addons.push({
    id: 'a2',
    name: 'Series',
    manifestUrl: 'https://example.test/manifest.json',
    enabled: true,
    createdAt: at(20),
    updatedAt: at(20),
  });

  const merged = mergeStates(local, remote);
  assert.equal(merged.mode, 'live', 'screen mode remains local to the device');
  assert.equal(merged.progress.film.positionSeconds, 250, 'newest progress wins');
  assert.equal(merged.favorites.film.deletedAt, at(20), 'newer favorite deletion wins');
  assert.equal(merged.playlists[0].deletedAt, at(20), 'newer playlist deletion wins');
  assert.equal(merged.addons[0].id, 'a2', 'remote-only entities are retained');

  const readded = empty();
  readded.favorites.film = {
    mediaId: 'film',
    createdAt: at(1),
    updatedAt: at(30),
  };
  const afterReadd = mergeStates(readded, merged);
  assert.equal(afterReadd.favorites.film.deletedAt, undefined, 'newer re-add beats an older tombstone');
}

{
  const local = empty();
  local.progress.episode = {
    mediaId: 'episode',
    positionSeconds: 60,
    durationSeconds: 1800,
    updatedAt: at(10),
    deviceId: 'phone',
    item: {
      id: 'episode',
      title: 'Series · Old episode title',
      source: {
        kind: 'stremio',
        manifestUrl: 'https://example.test/manifest.json',
        mediaType: 'series',
        mediaId: 'tt123',
        videoId: 'tt123:1:1',
      },
    },
  };

  const remote = empty();
  remote.progress.episode = {
    mediaId: 'episode',
    positionSeconds: 420,
    durationSeconds: 1800,
    updatedAt: at(20),
    deviceId: 'tv',
    item: {
      id: 'episode',
      title: 'Series · Pilot',
      subtitle: 'S1 E1',
      source: {
        kind: 'stremio',
        manifestUrl: 'https://example.test/manifest.json',
        mediaType: 'series',
        mediaId: 'tt123',
        videoId: 'tt123:1:1',
      },
    },
  };

  const merged = mergeStates(local, remote);
  assert.equal(merged.progress.episode.positionSeconds, 420, 'newest episode progress wins');
  assert.equal(merged.progress.episode.item.title, 'Series · Pilot', 'resume snapshot follows newest progress');
  assert.equal(merged.progress.episode.item.source.videoId, 'tt123:1:1', 'episode stream identity is preserved');
}

console.log('FILMA sync tests passed.');
