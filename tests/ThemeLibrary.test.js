import test from 'node:test';
import assert from 'node:assert/strict';
import { ThemeLibrary } from '../public/src/application/ThemeLibrary.js';
import { InvalidLinkError } from '../public/src/domain/errors.js';

function createLibrary({ titles = {}, playlistIds = ['aaaaaaaaaaa', 'bbbbbbbbbbb'] } = {}) {
  let stored = [];
  return new ThemeLibrary({
    repository: { findAll: () => structuredClone(stored), saveAll: (themes) => { stored = structuredClone(themes); } },
    metadata: {
      fetchVideoTitle: async (id) => titles[id] ?? null,
      fetchPlaylistTitle: async () => 'Batalha final',
    },
    playlists: { fetchVideoIds: async () => playlistIds },
  });
}

test('adiciona um vídeo usando o título do YouTube como nome', async () => {
  const library = createLibrary({ titles: { dQw4w9WgXcQ: 'Tema do Lich' } });
  const theme = await library.addFromLink('https://youtu.be/dQw4w9WgXcQ');
  assert.equal(theme.name, 'Tema do Lich');
  assert.equal(theme.kind, 'video');
  assert.equal(library.list().length, 1);
});

test('nome informado pelo usuário tem prioridade', async () => {
  const library = createLibrary({ titles: { dQw4w9WgXcQ: 'Título longo do YouTube' } });
  const theme = await library.addFromLink('https://youtu.be/dQw4w9WgXcQ', '  Vecna  ');
  assert.equal(theme.name, 'Vecna');
});

test('adiciona playlist com todas as faixas e depois preenche os títulos', async () => {
  const library = createLibrary({ titles: { aaaaaaaaaaa: 'Faixa A', bbbbbbbbbbb: 'Faixa B' } });
  const theme = await library.addFromLink('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');
  assert.equal(theme.kind, 'playlist');
  assert.equal(theme.tracks.length, 2);
  assert.equal(theme.tracks[0].title, '');

  await library.hydrateTitles(theme.id);
  assert.deepEqual(library.find(theme.id).tracks.map((t) => t.title), ['Faixa A', 'Faixa B']);
});

test('link inválido não cria tema', async () => {
  const library = createLibrary();
  await assert.rejects(() => library.addFromLink('oi'), InvalidLinkError);
  assert.equal(library.list().length, 0);
});

test('remover e restaurar mantém a posição original', async () => {
  const library = createLibrary();
  const a = await library.addFromLink('https://youtu.be/aaaaaaaaaaa', 'A');
  await library.addFromLink('https://youtu.be/bbbbbbbbbbb', 'B');
  const removed = library.remove(a.id);
  assert.deepEqual(library.list().map((t) => t.name), ['B']);
  library.restore(removed);
  assert.deepEqual(library.list().map((t) => t.name), ['A', 'B']);
});
