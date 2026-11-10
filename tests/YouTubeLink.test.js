import test from 'node:test';
import assert from 'node:assert/strict';
import { YouTubeLink } from '../public/src/domain/YouTubeLink.js';
import { InvalidLinkError } from '../public/src/domain/errors.js';

const VIDEO = 'dQw4w9WgXcQ';
const PLAYLIST = 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf';

test('reconhece os formatos comuns de link de vídeo', () => {
  const links = [
    `https://www.youtube.com/watch?v=${VIDEO}`,
    `https://youtu.be/${VIDEO}?t=10`,
    `https://m.youtube.com/watch?v=${VIDEO}&feature=share`,
    `https://music.youtube.com/watch?v=${VIDEO}`,
    `youtube.com/embed/${VIDEO}`,
    `https://www.youtube.com/shorts/${VIDEO}`,
  ];
  for (const link of links) {
    const parsed = YouTubeLink.parse(link);
    assert.equal(parsed.videoId, VIDEO, link);
    assert.equal(parsed.isPlaylist, false, link);
  }
});

test('reconhece playlists, com ou sem vídeo no link', () => {
  const onlyList = YouTubeLink.parse(`https://www.youtube.com/playlist?list=${PLAYLIST}`);
  assert.equal(onlyList.playlistId, PLAYLIST);
  assert.equal(onlyList.isPlaylist, true);

  const videoInList = YouTubeLink.parse(`https://www.youtube.com/watch?v=${VIDEO}&list=${PLAYLIST}`);
  assert.equal(videoInList.isPlaylist, true);
});

test('mix automático do YouTube é tratado como vídeo único', () => {
  const parsed = YouTubeLink.parse(`https://www.youtube.com/watch?v=${VIDEO}&list=RD${VIDEO}`);
  assert.equal(parsed.isPlaylist, false);
  assert.equal(parsed.videoId, VIDEO);
});

test('rejeita links que não são do YouTube ou não têm vídeo', () => {
  for (const bad of ['', 'banana', 'https://vimeo.com/123', 'https://www.youtube.com/', 'https://evil.com/?youtube.com']) {
    assert.throws(() => YouTubeLink.parse(bad), InvalidLinkError, bad);
  }
});
