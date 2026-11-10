import test from 'node:test';
import assert from 'node:assert/strict';
import { PlaybackMemory } from '../public/src/application/PlaybackMemory.js';

function createMemory(initial = {}) {
  const saved = [];
  const memory = new PlaybackMemory({ load: () => initial, save: (data) => saved.push(structuredClone(data)) });
  return { memory, saved };
}

test('começa sem lembrança: faixa 0, segundo 0', () => {
  const { memory } = createMemory();
  assert.equal(memory.lastTrackIndex('t', 5), 0);
  assert.equal(memory.positionOf('t', 0), 0);
});

test('lembra faixa e segundo (arredondado para baixo)', () => {
  const { memory } = createMemory();
  memory.remember('t', 2, 75.9, 300);
  assert.equal(memory.lastTrackIndex('t', 5), 2);
  assert.equal(memory.positionOf('t', 2), 75);
});

test('perto do fim a faixa recomeça do zero', () => {
  const { memory } = createMemory();
  memory.remember('t', 0, 285, 300);
  assert.equal(memory.positionOf('t', 0), 0);
});

test('ignora índice de faixa que não existe mais', () => {
  const { memory } = createMemory({ t: { trackIndex: 9, positions: {} } });
  assert.equal(memory.lastTrackIndex('t', 3), 0);
});

test('não grava de novo quando o segundo não mudou', () => {
  const { memory, saved } = createMemory();
  memory.remember('t', 0, 10.1, 300);
  memory.remember('t', 0, 10.6, 300);
  assert.equal(saved.length, 1);
});

test('restaura o que já estava salvo', () => {
  const { memory } = createMemory({ t: { trackIndex: 1, positions: { 1: 33 } } });
  assert.equal(memory.lastTrackIndex('t', 4), 1);
  assert.equal(memory.positionOf('t', 1), 33);
});

test('retainOnly esquece temas que não existem mais', () => {
  const { memory, saved } = createMemory({
    vivo: { trackIndex: 1, positions: { 1: 30 } },
    removido: { trackIndex: 0, positions: { 0: 10 } },
  });
  memory.retainOnly(['vivo']);
  assert.deepEqual(saved, [{ vivo: { trackIndex: 1, positions: { 1: 30 } } }]);
  assert.equal(memory.positionOf('removido', 0), 0);

  memory.retainOnly(['vivo']);
  assert.equal(saved.length, 1, 'sem mudanças, não grava de novo');
});

test('tolera dados salvos sem o campo positions', () => {
  const { memory } = createMemory({ t: { trackIndex: 0 } });
  memory.remember('t', 0, 42, 300);
  assert.equal(memory.positionOf('t', 0), 42);
});
