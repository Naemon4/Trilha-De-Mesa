import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChapters, parseDescription } from '../server/chapters.js';

test('lê os capítulos oficiais embutidos na página', () => {
  const html = `x"chapterRenderer":{"title":{"simpleText":"Intro"},"timeRangeStartMillis":0,"thumbnail":{}}},
    {"chapterRenderer":{"title":{"simpleText":"Batalha \\"final\\""},"timeRangeStartMillis":95000}}
    {"chapterRenderer":{"title":{"simpleText":"Intro"},"timeRangeStartMillis":0}}`;
  assert.deepEqual(parseChapters(html), [
    { title: 'Intro', start: 0 },
    { title: 'Batalha "final"', start: 95 },
  ]);
});

test('sem capítulos oficiais, usa os tempos da descrição', () => {
  const description = 'Trilha do jogo\\n0:00 Abertura\\n1:30 - Floresta\\n[01:05:10] Chefe final\\nobrigado por ouvir';
  const html = `..."shortDescription":"${description}","isCrawlable":true...`;
  assert.deepEqual(parseChapters(html), [
    { title: 'Abertura', start: 0 },
    { title: 'Floresta', start: 90 },
    { title: 'Chefe final', start: 3910 },
  ]);
});

test('um único tempo na descrição não conta como marcadores', () => {
  assert.deepEqual(parseDescription('Gravado em 2020\n3:15 minha parte favorita'), []);
});

test('ignora tempos fora de ordem e títulos vazios', () => {
  const chapters = parseDescription('0:00 A\n2:00 B\n1:00 C\n3:00 D');
  assert.deepEqual(chapters.map((c) => c.title), ['A', 'C', 'B', 'D']);
});

test('página sem nada devolve lista vazia', () => {
  assert.deepEqual(parseChapters('<html></html>'), []);
});
