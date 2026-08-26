const assert = require('node:assert/strict');

const {
  automaticTvPlaylists,
  mergeMovieProviders,
  mergeTvPlaylists,
} = require('../.sync-test-build/services/sourceDiscovery.js');
const {
  catalogCanLoadWithoutSearch,
  catalogLanguageExtra,
  rankStreamsByPreferredAudio,
} = require('../.sync-test-build/services/stremio.js');
const {
  validatePlaybackManifest,
} = require('../.sync-test-build/services/addonValidation.js');

const stamp = '2026-08-25T00:00:00.000Z';

function addon(id, name, manifestUrl) {
  return { id, name, manifestUrl, enabled: true, createdAt: stamp, updatedAt: stamp };
}

function playlist(id, name, url) {
  return { id, name, url, enabled: true, createdAt: stamp, updatedAt: stamp };
}

{
  const ranked = rankStreamsByPreferredAudio([
    { title: 'English 1080p', id: 'en' },
    { title: 'Shqip HD', id: 'sq' },
    { title: 'Français 4K', id: 'fr' },
    { title: 'Deutsch 4K', id: 'de' },
  ], []);
  assert.deepEqual(ranked.map(item => item.id), ['fr', 'sq', 'en', 'de']);
}

{
  const ranked = rankStreamsByPreferredAudio([
    { title: 'Français', id: 'fr' },
    { title: 'Deutsch', id: 'de' },
    { title: 'English', id: 'en' },
  ], ['de', 'fr']);
  assert.deepEqual(ranked.map(item => item.id), ['de', 'fr', 'en']);
}

{
  const currentYear = String(new Date().getFullYear());
  const catalog = {
    type: 'movie',
    id: 'year',
    name: 'New',
    extra: [
      { name: 'genre', options: [currentYear, String(Number(currentYear) - 1)], isRequired: true },
      { name: 'skip' },
    ],
  };
  assert.equal(catalogCanLoadWithoutSearch(catalog, []), true);
  assert.deepEqual(catalogLanguageExtra(catalog, []), { genre: currentYear });
}

{
  const catalog = {
    type: 'movie',
    id: 'language-catalog',
    extra: [{ name: 'language', options: ['English', 'Français'], isRequired: true }],
  };
  assert.deepEqual(catalogLanguageExtra(catalog, ['fr']), { language: 'Français' });
  assert.equal(catalogCanLoadWithoutSearch(catalog, ['fr']), true);
}

{
  const validation = validatePlaybackManifest({
    id: 'example.direct',
    name: ' Example Direct ',
    version: '1.0.0',
    resources: ['catalog', 'stream'],
    types: ['movie', 'series'],
  });
  assert.deepEqual(validation, { valid: true, name: 'Example Direct' });
}

{
  const validation = validatePlaybackManifest({
    id: 'example.catalog-only',
    name: 'Catalog only',
    version: '1.0.0',
    resources: ['catalog', 'meta'],
    types: ['movie'],
  });
  assert.deepEqual(validation, { valid: true, name: 'Catalog only' });
}

{
  const validation = validatePlaybackManifest({
    id: 'example.stream-only',
    name: 'Stream only',
    version: '1.0.0',
    resources: [{ name: 'stream', types: ['movie', 'series'] }],
  });
  assert.deepEqual(validation, { valid: true, name: 'Stream only' });
}

{
  const validation = validatePlaybackManifest({
    id: 'example.subtitles-only',
    name: 'Subtitles only',
    version: '1.0.0',
    resources: ['subtitles'],
    types: ['movie', 'series'],
  });
  assert.deepEqual(validation, { valid: false, reason: 'no-media-resource' });
}

{
  const validation = validatePlaybackManifest({
    id: 'example.channels',
    name: 'Channels',
    version: '1.0.0',
    resources: [{ name: 'stream', types: ['channel'] }],
    types: ['channel'],
  });
  assert.deepEqual(validation, { valid: false, reason: 'unsupported-media-type' });
}

{
  const validation = validatePlaybackManifest({
    id: 'example.resource-types-only',
    name: 'Resource types only',
    version: '1.0.0',
    resources: [{ name: 'stream', types: ['channel'] }],
  });
  assert.deepEqual(validation, { valid: false, reason: 'unsupported-media-type' });
}

{
  const validation = validatePlaybackManifest({
    id: '',
    name: 'Broken',
    version: '1.0.0',
    resources: ['stream'],
    types: ['movie'],
  });
  assert.deepEqual(validation, { valid: false, reason: 'invalid-manifest' });
}

{
  const automatic = automaticTvPlaylists([], 'en');
  assert.deepEqual(
    automatic.map(item => item.url),
    [
      'https://iptv-org.github.io/iptv/countries/al.m3u',
      'https://iptv-org.github.io/iptv/countries/xk.m3u',
      'https://iptv-org.github.io/iptv/countries/fr.m3u',
      'https://iptv-org.github.io/iptv/countries/uk.m3u',
      'https://iptv-org.github.io/iptv/countries/us.m3u',
    ],
  );
  assert.deepEqual(automatic.slice(0, 2).map(item => item.countryGroup), ['Albania', 'Albania']);
}

{
  const automatic = automaticTvPlaylists(['de', 'fr', 'de', 'en'], 'fr');
  assert.deepEqual(
    automatic.map(item => item.id),
    [
      'auto-tv:country:al',
      'auto-tv:country:xk',
      'auto-tv:country:de',
      'auto-tv:country:fr',
      'auto-tv:country:uk',
      'auto-tv:country:us',
    ],
  );
}

{
  const configured = addon('configured', 'Configured provider', 'https://example.com/manifest.json');
  const automatic = addon('automatic', 'Automatic duplicate', 'https://example.com/manifest.json');
  const merged = mergeMovieProviders([configured], [automatic]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'configured');
}

{
  const configured = playlist('configured', 'My TV', 'https://example.com/list.m3u');
  const automatic = playlist('automatic', 'Auto duplicate', 'https://example.com/list.m3u');
  const other = playlist('other', 'Other', 'https://example.com/other.m3u');
  const merged = mergeTvPlaylists([configured], [automatic, other]);
  assert.deepEqual(merged.map(item => item.id), ['configured', 'other']);
}

console.log('source/language tests passed');
