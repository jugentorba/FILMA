const assert = require('node:assert/strict');

const {
  canonicalMediaKey,
  dedupeMediaItems,
  selectBrowseCatalogs,
} = require('../.sync-test-build/services/mediaDiscovery.js');

const manifestUrl = 'https://v3-cinemeta.strem.io/manifest.json';

function item(id, title, year, poster, sourceUrl = manifestUrl) {
  return {
    id: `addon:${id}`,
    title,
    year,
    poster,
    source: {
      kind: 'stremio',
      manifestUrl: sourceUrl,
      mediaType: 'movie',
      mediaId: id,
    },
  };
}

{
  const first = item('tt1234567', 'Example Movie', 2026, undefined);
  const better = item('tt1234567', 'Example Movie', 2026, 'https://img.example/poster.jpg');
  assert.equal(canonicalMediaKey(first), 'movie:imdb:tt1234567');
  const deduped = dedupeMediaItems([first, better]);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].poster, 'https://img.example/poster.jpg');
}

{
  const archive = item('ia-id', 'Night of Example', 1968, 'https://archive.example/poster.jpg', 'filma://internet-archive/manifest.json');
  const metadata = item('other-id', 'Night of Example', 1968, 'https://meta.example/poster.jpg');
  const deduped = dedupeMediaItems([metadata, archive]);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].source.manifestUrl, 'filma://internet-archive/manifest.json');
}

{
  const catalogs = [
    { type: 'movie', id: 'random', name: 'Other' },
    { type: 'movie', id: 'imdbRating', name: 'Featured' },
    { type: 'series', id: 'imdbRating', name: 'Featured' },
    { type: 'series', id: 'year', name: 'New', extra: [{ name: 'genre', options: ['2026'], isRequired: true }] },
    { type: 'movie', id: 'top', name: 'Popular' },
    { type: 'series', id: 'top', name: 'Popular' },
    { type: 'movie', id: 'year', name: 'New', extra: [{ name: 'genre', options: ['2026'], isRequired: true }] },
  ];
  const selected = selectBrowseCatalogs(catalogs, [], 3);
  assert.deepEqual(
    selected.map(catalog => `${catalog.type}:${catalog.id}`),
    ['movie:top', 'movie:year', 'movie:imdbRating', 'series:top', 'series:year', 'series:imdbRating'],
  );
}

console.log('movies and series discovery tests passed');
