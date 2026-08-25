const assert = require('node:assert/strict');
const { normalizeState } = require('../.sync-test-build/services/stateSchema.js');

const state = normalizeState({
  mode: 'live',
  playlists: [{
    id: 'file-playlist-1',
    name: 'Imported channels',
    url: 'file:///filma-playlists/imported.m3u',
    enabled: true,
    createdAt: '2026-08-25T18:00:00.000Z',
    updatedAt: '2026-08-25T18:00:01.000Z',
    kind: 'file',
  }],
});

assert.equal(state.playlists.length, 1, 'imported playlist survives state normalization');
assert.equal(state.playlists[0].kind, 'file', 'local playlist type is preserved');
assert.equal(state.playlists[0].url, 'file:///filma-playlists/imported.m3u', 'persistent file URI is preserved');

console.log('FILMA local playlist state tests passed.');
