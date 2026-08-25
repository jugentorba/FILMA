const assert = require('node:assert/strict');

const {
  mergeLiveChannels,
  parseM3U,
} = require('../.sync-test-build/services/m3u.js');

{
  const first = parseM3U(`#EXTM3U
#EXTINF:-1 tvg-id="news.fr" group-title="News",News FR
http://example.com/news.m3u8`);
  const second = parseM3U(`#EXTM3U
#EXTINF:-1 tvg-id="news.fr" group-title="News",News FR HD
https://backup.example.com/news.m3u8`);
  const merged = mergeLiveChannels([first, second]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].url, 'https://backup.example.com/news.m3u8');
  assert.deepEqual(merged[0].alternateUrls, ['http://example.com/news.m3u8']);
}

{
  const channels = parseM3U(`#EXTM3U
#EXTINF:-1 tvg-id="sport1.xk" group-title="Kosovo",Sport 1
https://example.com/sport1.m3u8
#EXTINF:-1 tvg-id="general.xk" group-title="Kosovo",General TV
https://example.com/general.m3u8`);

  assert.equal(channels[0].group, 'Sports');
  assert.equal(channels[1].group, 'Kosovo');
}

{
  const channel = {
    id: 'one',
    name: 'Channel One',
    group: 'General',
    tvgId: 'channel.one',
    url: 'https://example.com/one.m3u8',
  };
  const duplicate = { ...channel, id: 'two' };
  const merged = mergeLiveChannels([[channel], [duplicate]]);

  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].alternateUrls, []);
}

console.log('m3u merge tests passed');