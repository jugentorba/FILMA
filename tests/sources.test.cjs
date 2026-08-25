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
  const automatic = automaticTvPlaylists([], 'en');
  assert.deepEqual(
    automatic.map(item => item.url),
    [
      'https://iptv-org.github.io/iptv/languages/fra.m3u',
      'https://iptv-org.github.io/iptv/languages/sqi.m3u',
      'https://iptv-org.github.io/iptv/languages/eng.m3u',
    ],
  );
}

{
  const automatic = automaticTvPlaylists(['de', 'fr', 'de', 'en'], 'fr');
  assert.deepEqual(automatic.map(item => item.id), ['auto-tv:deu', 'auto-tv:fra', 'auto-tv:eng']);
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
