const assert = require('node:assert/strict');
const { shouldShowInContinueWatching } = require('../.sync-test-build/services/progress.js');
const { normalizeState } = require('../.sync-test-build/services/stateSchema.js');
const { profileMediaKey } = require('../.sync-test-build/services/profiles.js');

const DEFAULT_PROFILE_ID = 'profile-default';
const timestamp = '2026-08-27T16:00:00.000Z';

const savedOnly = normalizeState({
  mode: 'movies',
  activeProfileId: DEFAULT_PROFILE_ID,
  profiles: [{
    id: DEFAULT_PROFILE_ID,
    name: 'Profile 1',
    createdAt: timestamp,
    updatedAt: timestamp,
  }],
  preferences: {
    appLanguage: 'en',
    preferredAudioLanguages: [],
    interfaceDensity: 'compact',
    updatedAt: timestamp,
  },
  progress: {
    saved: {
      mediaId: 'saved-movie',
      profileId: DEFAULT_PROFILE_ID,
      positionSeconds: 0,
      durationSeconds: 0,
      updatedAt: timestamp,
      deviceId: 'phone',
      item: {
        id: 'saved-movie',
        title: 'Saved Movie',
        poster: 'https://example.test/poster.jpg',
        source: {
          kind: 'stremio',
          manifestUrl: 'https://example.test/manifest.json',
          mediaType: 'movie',
          mediaId: 'tt1234567',
        },
      },
    },
  },
  favorites: {},
  playlists: [],
  addons: [],
});

const progress = savedOnly.progress[profileMediaKey(DEFAULT_PROFILE_ID, 'saved-movie')];
assert.ok(progress, 'saved-only metadata survives normalization');
assert.equal(progress.item.title, 'Saved Movie', 'saved title snapshot remains available for My List');
assert.equal(progress.item.source.mediaId, 'tt1234567', 'saved playback identity remains available');
assert.equal(shouldShowInContinueWatching(progress), false, 'saving without watching does not pollute Continue Watching');

console.log('FILMA library snapshot tests passed.');
