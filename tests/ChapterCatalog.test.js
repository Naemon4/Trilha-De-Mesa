import test from 'node:test';
import assert from 'node:assert/strict';
import { ChapterCatalog } from '../public/src/application/ChapterCatalog.js';
import { sectionsFromChapters, normalizeLoop, sameLoop, NO_LOOP } from '../public/src/domain/Loop.js';

test('guarda o resultado e não busca duas vezes', async () => {
  let calls = 0;
  const catalog = new ChapterCatalog({ fetchChapters: async () => { calls += 1; return [{ title: 'A', start: 0 }]; } });
  await catalog.get('v');
  await catalog.get('v');
  assert.equal(calls, 1);
});

test('tenta de novo depois de uma falha', async () => {
  let calls = 0;
  const catalog = new ChapterCatalog({ fetchChapters: async () => { calls += 1; if (calls === 1) throw new Error('rede'); return []; } });
  await assert.rejects(() => catalog.get('v'));
  assert.deepEqual(await catalog.get('v'), []);
  assert.equal(calls, 2);
});

test('cada capítulo vai até o início do próximo e o último até o fim', () => {
  const sections = sectionsFromChapters([{ title: 'A', start: 0 }, { title: 'B', start: 90 }, { title: 'C', start: 200 }]);
  assert.deepEqual(sections.map((s) => [s.start, s.end]), [[0, 90], [90, 200], [200, null]]);
});

test('dados de loop inválidos viram "sem loop"', () => {
  assert.equal(normalizeLoop({ type: 'section', start: 50, end: 10 }), NO_LOOP);
  assert.equal(normalizeLoop({ type: 'banana' }), NO_LOOP);
  assert.equal(normalizeLoop(undefined), NO_LOOP);
  assert.ok(sameLoop(normalizeLoop({ type: 'section', start: 5, end: 9 }), normalizeLoop({ type: 'section', start: 5, end: 9, label: 'x' })));
});
