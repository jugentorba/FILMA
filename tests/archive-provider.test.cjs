const assert = require('node:assert/strict');

const {
  FILMA_ARCHIVE_MANIFEST_URL,
  rankArchivePlayableFiles,
} = require('../.sync-test-build/services/stremio.js');
const {
  filmaArchiveProvider,
} = require('../.sync-test-build/services/sourceDiscovery.js');

{
  const provider = filmaArchiveProvider();
  assert.equal(provider.id, 'auto-stremio:com.filma.archive');
  assert.equal(provider.manifestUrl, FILMA_ARCHIVE_MANIFEST_URL);
  assert.equal(provider.enabled, true);
  assert.equal(provider.providesCatalog, true);
  assert.equal(provider.providesMeta, true);
  assert.equal(provider.providesStream, true);
}

{
  const ranked = rankArchivePlayableFiles([
    { name: 'film.ogv', format: 'Ogg Video', source: 'original', size: '350000000' },
    { name: 'film_512kb.mp4', format: 'h.264 MPEG4', source: 'derivative', size: '180000000' },
    { name: 'trailer.mp4', format: 'h.264 MPEG4', source: 'derivative', size: '25000000' },
    { name: 'film.webm', format: 'WebM', source: 'derivative', size: '190000000' },
    { name: 'poster.jpg', format: 'JPEG' },
  ]);

  assert.equal(ranked[0].name, 'film_512kb.mp4');
  assert.equal(ranked.some(file => file.name === 'poster.jpg'), false);
  assert.equal(ranked.findIndex(file => file.name === 'trailer.mp4') >= 0, false);
}

console.log('archive provider tests passed');
