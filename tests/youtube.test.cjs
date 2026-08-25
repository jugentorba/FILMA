const assert = require('node:assert/strict');
const { isRtshFilmPlaylistTitle } = require('../.sync-test-build/services/youtube.js');

assert.equal(isRtshFilmPlaylistTitle('Filma shqiptarë të vjetër'), true, 'Albanian film playlists are selected');
assert.equal(isRtshFilmPlaylistTitle('FILM - Prodhime RTSH'), true, 'RTSH film-production playlists are selected');
assert.equal(isRtshFilmPlaylistTitle('Kinostudio Shqipëria e Re'), true, 'Kinostudio playlists are selected');
assert.equal(isRtshFilmPlaylistTitle('Kinemaja shqiptare'), true, 'cinema playlists are selected');
assert.equal(isRtshFilmPlaylistTitle('Lajme dhe aktualitet'), false, 'news playlists are not mixed into the movie row');
assert.equal(isRtshFilmPlaylistTitle('Koncerte nga arkivi'), false, 'music archive playlists are not mixed into the movie row');

console.log('FILMA RTSH archive selection tests passed.');
