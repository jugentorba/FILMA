const assert = require('node:assert/strict');
const { favoritesForProfile, progressForProfile, profileMediaKey } = require('../.sync-test-build/services/profiles.js');
const { isPlaybackComplete, shouldShowInContinueWatching } = require('../.sync-test-build/services/progress.js');
const { mergeStates } = require('../.sync-test-build/services/sync.js');
const { LEGACY_TIMESTAMP, normalizeState, normalizeSyncEnvelope } = require('../.sync-test-build/services/stateSchema.js');

const DEFAULT_PROFILE_ID = 'profile-default';
const at = second => `2026-08-25T08:00:${String(second).padStart(2, '0')}.000Z`;
const profile = (id, name, updatedAt = LEGACY_TIMESTAMP) => ({ id, name, createdAt: LEGACY_TIMESTAMP, updatedAt });

function empty(mode = 'movies') {
  return {
    mode,
    activeProfileId: DEFAULT_PROFILE_ID,
    profiles: [profile(DEFAULT_PROFILE_ID, 'Profile 1')],
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
    progress: { film: { mediaId: 'film', positionSeconds: 100, durationSeconds: 1000, updatedAt: at(2), deviceId: 'legacy' } },
    playlists: [{ id: 'p1', name: 'TV', url: 'https://example.test/list.m3u', enabled: true }],
    addons: [{ id: 'a1', name: 'Movies', manifestUrl: 'https://example.test/manifest.json', enabled: true }],
  });

  const favoriteKey = profileMediaKey(DEFAULT_PROFILE_ID, 'film');
  assert.equal(legacy.mode, 'live');
  assert.equal(legacy.activeProfileId, DEFAULT_PROFILE_ID, 'legacy installs migrate into the default profile');
  assert.equal(legacy.profiles.length, 1, 'legacy installs receive one profile');
  assert.equal(legacy.preferences.appLanguage, 'en', 'legacy installs receive a safe UI language default');
  assert.deepEqual(legacy.preferences.preferredAudioLanguages, [], 'legacy installs default to any audio language');
  assert.equal(legacy.preferences.interfaceDensity, 'compact', 'legacy installs use the denser responsive interface');
  assert.equal(legacy.favorites[favoriteKey].profileId, DEFAULT_PROFILE_ID, 'legacy favorites are assigned to the default profile');
  assert.equal(legacy.progress[favoriteKey].profileId, DEFAULT_PROFILE_ID, 'legacy progress is assigned to the default profile');
  assert.equal(legacy.playlists[0].updatedAt, LEGACY_TIMESTAMP);
  assert.equal(legacy.addons[0].updatedAt, LEGACY_TIMESTAMP);
}

{
  const xtream = normalizeState({
    ...empty(),
    playlists: [{
      id: 'xtream-1',
      name: 'Provider TV',
      url: 'https://provider.example',
      enabled: true,
      createdAt: at(1),
      updatedAt: at(2),
      kind: 'xtream',
      credentialsKey: 'filma.iptv.xtream.v1.xtream-1',
    }],
  });

  assert.equal(xtream.playlists[0].kind, 'xtream', 'Xtream source type survives state normalization');
  assert.equal(xtream.playlists[0].credentialsKey, 'filma.iptv.xtream.v1.xtream-1', 'Xtream SecureStore reference survives sync/state migration');
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
  assert.equal(normalized.progress[profileMediaKey(DEFAULT_PROFILE_ID, 'film')].completed, true, 'completed playback survives normalization');
}

{
  const raw = {
    ...empty(),
    activeProfileId: 'kids',
    profiles: [profile(DEFAULT_PROFILE_ID, 'Adults'), profile('kids', 'Kids', at(4))],
    progress: {
      adults: { mediaId: 'movie', profileId: DEFAULT_PROFILE_ID, positionSeconds: 120, durationSeconds: 1000, updatedAt: at(5), deviceId: 'tv' },
      kids: { mediaId: 'movie', profileId: 'kids', positionSeconds: 440, durationSeconds: 1000, updatedAt: at(6), deviceId: 'tablet' },
    },
    favorites: {
      adults: { mediaId: 'movie', profileId: DEFAULT_PROFILE_ID, createdAt: at(1), updatedAt: at(5) },
      kids: { mediaId: 'cartoon', profileId: 'kids', createdAt: at(1), updatedAt: at(6) },
    },
  };
  const normalized = normalizeState(raw);
  assert.equal(normalized.activeProfileId, 'kids');
  assert.equal(progressForProfile(normalized.progress, DEFAULT_PROFILE_ID).movie.positionSeconds, 120, 'adult progress stays in the adult profile');
  assert.equal(progressForProfile(normalized.progress, 'kids').movie.positionSeconds, 440, 'kids progress stays in the kids profile');
  assert.equal(Boolean(favoritesForProfile(normalized.favorites, DEFAULT_PROFILE_ID).movie), true, 'adult favorites remain isolated');
  assert.equal(Boolean(favoritesForProfile(normalized.favorites, 'kids').cartoon), true, 'kids favorites remain isolated');
  assert.equal(favoritesForProfile(normalized.favorites, 'kids').movie, undefined, 'favorites do not leak between profiles');
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
  assert.equal(envelope.schemaVersion, 3, 'legacy cloud envelopes migrate to the profile-aware schema');
}

{
  const local = empty('live');
  local.profiles.push(profile('kids', 'Kids', at(10)));
  local.activeProfileId = 'kids';
  local.preferences = { appLanguage: 'en', preferredAudioLanguages: ['en'], interfaceDensity: 'compact', updatedAt: at(10) };
  const favoriteKey = profileMediaKey(DEFAULT_PROFILE_ID, 'film');
  local.favorites[favoriteKey] = { mediaId: 'film', profileId: DEFAULT_PROFILE_ID, createdAt: at(1), updatedAt: at(10) };
  local.progress[favoriteKey] = { mediaId: 'film', profileId: DEFAULT_PROFILE_ID, positionSeconds: 100, durationSeconds: 1000, updatedAt: at(10), deviceId: 'phone' };
  local.playlists.push({ id: 'p1', name: 'TV', url: 'https://example.test/list.m3u', enabled: true, createdAt: at(1), updatedAt: at(10) });

  const remote = empty('movies');
  remote.profiles.push(profile('kids', 'Children', at(20)));
  remote.preferences = { appLanguage: 'fr', preferredAudioLanguages: ['fr', 'sq'], interfaceDensity: 'comfortable', updatedAt: at(20) };
  remote.favorites[favoriteKey] = { mediaId: 'film', profileId: DEFAULT_PROFILE_ID, createdAt: at(1), updatedAt: at(20), deletedAt: at(20) };
  remote.progress[favoriteKey] = { mediaId: 'film', profileId: DEFAULT_PROFILE_ID, positionSeconds: 950, durationSeconds: 1000, updatedAt: at(20), deviceId: 'tv', completed: true };
  remote.playlists.push({ id: 'p1', name: 'TV', url: 'https://example.test/list.m3u', enabled: true, createdAt: at(1), updatedAt: at(20), deletedAt: at(20) });
  remote.addons.push({ id: 'a2', name: 'Series', manifestUrl: 'https://example.test/manifest.json', enabled: true, createdAt: at(20), updatedAt: at(20) });

  const merged = mergeStates(local, remote);
  assert.equal(merged.mode, 'live', 'screen mode remains local to the device');
  assert.equal(merged.activeProfileId, 'kids', 'active profile remains local to the device');
  assert.equal(merged.profiles.find(item => item.id === 'kids').name, 'Children', 'newer profile metadata syncs');
  assert.equal(merged.preferences.appLanguage, 'fr', 'newest synchronized preferences win');
  assert.deepEqual(merged.preferences.preferredAudioLanguages, ['fr', 'sq']);
  assert.equal(merged.preferences.interfaceDensity, 'comfortable', 'appearance density follows the newest synchronized preferences');
  assert.equal(merged.progress[favoriteKey].positionSeconds, 950, 'newest progress wins');
  assert.equal(merged.progress[favoriteKey].completed, true, 'newest completed state wins across devices');
  assert.equal(merged.favorites[favoriteKey].deletedAt, at(20), 'newer favorite deletion wins');
  assert.equal(merged.playlists[0].deletedAt, at(20), 'newer playlist deletion wins');
  assert.equal(merged.addons[0].id, 'a2', 'remote-only entities are retained');

  const readded = empty();
  readded.favorites[favoriteKey] = { mediaId: 'film', profileId: DEFAULT_PROFILE_ID, createdAt: at(1), updatedAt: at(30) };
  const afterReadd = mergeStates(readded, merged);
  assert.equal(afterReadd.favorites[favoriteKey].deletedAt, undefined, 'newer re-add beats an older tombstone');
}

{
  const key = profileMediaKey(DEFAULT_PROFILE_ID, 'episode');
  const local = empty();
  local.progress[key] = {
    mediaId: 'episode', profileId: DEFAULT_PROFILE_ID, positionSeconds: 60, durationSeconds: 1800, updatedAt: at(10), deviceId: 'phone',
    item: {
      id: 'episode', title: 'Series · Old episode title',
      source: { kind: 'stremio', manifestUrl: 'https://example.test/manifest.json', mediaType: 'series', mediaId: 'tt123', videoId: 'tt123:1:1' },
    },
  };

  const remote = empty();
  remote.progress[key] = {
    mediaId: 'episode', profileId: DEFAULT_PROFILE_ID, positionSeconds: 420, durationSeconds: 1800, updatedAt: at(20), deviceId: 'tv',
    item: {
      id: 'episode', title: 'Series · Pilot', subtitle: 'S1 E1',
      source: { kind: 'stremio', manifestUrl: 'https://example.test/manifest.json', mediaType: 'series', mediaId: 'tt123', videoId: 'tt123:1:1' },
    },
  };

  const merged = mergeStates(local, remote);
  assert.equal(merged.progress[key].positionSeconds, 420, 'newest episode progress wins');
  assert.equal(merged.progress[key].item.title, 'Series · Pilot', 'resume snapshot follows newest progress');
  assert.equal(merged.progress[key].item.source.videoId, 'tt123:1:1', 'episode stream identity is preserved');

  const persisted = normalizeState(merged);
  assert.equal(persisted.progress[key].item.title, 'Series · Pilot', 'episode title survives state normalization');
  assert.equal(persisted.progress[key].item.source.videoId, 'tt123:1:1', 'episode video id survives state normalization');
}

console.log('FILMA sync, profiles and playback-state tests passed.');
