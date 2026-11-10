import test from 'node:test';
import assert from 'node:assert/strict';
import { PlaybackService, PlaybackStatus } from '../public/src/application/PlaybackService.js';
import { PlaybackMemory } from '../public/src/application/PlaybackMemory.js';
import { TrackUnavailableError } from '../public/src/domain/errors.js';

class FakeEngine {
  transitions = [];
  fadeOuts = [];
  unavailable = new Set();

  setVolume() {}
  pause() {}
  resume() {}
  onProgress(listener) { this.emitProgress = listener; }
  onTrackEnded(listener) { this.emitEnded = listener; }
  async transitionTo(videoId, fadeMs, startSeconds) {
    this.transitions.push({ videoId, fadeMs, startSeconds });
    if (this.unavailable.has(videoId)) throw new TrackUnavailableError('indisponível');
  }
  async fadeOut(ms) { this.fadeOuts.push(ms); }
}

const settingsRepository = { load: () => ({ volume: 0.5, crossfadeSeconds: 4 }), save() {} };
const tick = () => new Promise((resolve) => setImmediate(resolve));
const theme = (...ids) => ({ id: 't1', name: 'Tema', kind: 'playlist', tracks: ids.map((videoId) => ({ videoId, title: '' })) });

function setup() {
  const engine = new FakeEngine();
  const memory = new PlaybackMemory({ load: () => ({}), save() {} });
  const service = new PlaybackService({ engine, settingsRepository, memory });
  return { engine, service };
}

test('toca a primeira faixa com o tempo de transição configurado', async () => {
  const { engine, service } = setup();
  await service.playTheme(theme('a', 'b'));
  assert.deepEqual(engine.transitions, [{ videoId: 'a', fadeMs: 4000, startSeconds: 0 }]);
  assert.equal(service.getState().status, PlaybackStatus.PLAYING);
  assert.equal(service.getState().loading, false);
});

test('avança para a próxima faixa perto do fim, e dá a volta na playlist', async () => {
  const { engine, service } = setup();
  await service.playTheme(theme('a', 'b'), 1);

  engine.emitProgress({ position: 30, duration: 200 });
  await tick();
  assert.equal(engine.transitions.length, 1, 'ainda longe do fim');

  engine.emitProgress({ position: 195, duration: 200 });
  await tick();
  assert.equal(engine.transitions.at(-1).videoId, 'a');
  assert.equal(service.getState().trackIndex, 0);
});

test('tema de uma faixa só repete a mesma faixa em loop', async () => {
  const { engine, service } = setup();
  await service.playTheme(theme('a'));
  engine.emitProgress({ position: 195, duration: 200 });
  await tick();
  assert.deepEqual(engine.transitions.map((t) => t.videoId), ['a', 'a']);
});

test('não dispara várias transições seguidas para o mesmo fim de faixa', async () => {
  const { engine, service } = setup();
  await service.playTheme(theme('a', 'b'));
  engine.emitProgress({ position: 195, duration: 200 });
  engine.emitProgress({ position: 195.3, duration: 200 });
  engine.emitEnded();
  await tick();
  assert.equal(engine.transitions.length, 2);
});

test('pula faixas indisponíveis e avisa o usuário', async () => {
  const { engine, service } = setup();
  engine.unavailable.add('a');
  await service.playTheme(theme('a', 'b'));
  assert.deepEqual(engine.transitions.map((t) => t.videoId), ['a', 'b']);
  assert.equal(service.getState().trackIndex, 1);
  assert.match(service.getState().notice.message, /indisponível/i);
});

test('para tudo se nenhuma faixa do tema funciona', async () => {
  const { engine, service } = setup();
  engine.unavailable.add('a').add('b');
  await service.playTheme(theme('a', 'b'));
  assert.equal(service.getState().status, PlaybackStatus.IDLE);
  assert.match(service.getState().notice.message, /nenhuma faixa/i);
});

test('stop leva ao estado ocioso com fade-out', async () => {
  const { engine, service } = setup();
  await service.playTheme(theme('a'));
  service.stop();
  assert.equal(service.getState().status, PlaybackStatus.IDLE);
  assert.deepEqual(engine.fadeOuts, [2000]);
});

test('pausa e retoma', async () => {
  const { service } = setup();
  await service.playTheme(theme('a'));
  service.togglePause();
  assert.equal(service.getState().status, PlaybackStatus.PAUSED);
  service.togglePause();
  assert.equal(service.getState().status, PlaybackStatus.PLAYING);
});

test('volta ao tema no segundo em que ele parou', async () => {
  const { engine, service } = setup();
  await service.playTheme(theme('a', 'b'));
  engine.emitProgress({ position: 42.7, duration: 200 });
  service.stop();

  await service.playTheme(theme('a', 'b'));
  assert.deepEqual(engine.transitions.at(-1), { videoId: 'a', fadeMs: 4000, startSeconds: 42 });
});

test('volta para a faixa da playlist em que estava, no segundo certo', async () => {
  const { engine, service } = setup();
  await service.playTheme(theme('a', 'b', 'c'), 1);
  engine.emitProgress({ position: 30, duration: 200 });

  await service.playTheme({ ...theme('x'), id: 't2' });
  await service.playTheme(theme('a', 'b', 'c'));
  assert.deepEqual(engine.transitions.at(-1), { videoId: 'b', fadeMs: 4000, startSeconds: 30 });
});

test('clicar numa faixa específica retoma o ponto daquela faixa', async () => {
  const { engine, service } = setup();
  const playlist = theme('a', 'b');
  await service.playTheme(playlist, 0);
  engine.emitProgress({ position: 50, duration: 200 });
  await service.playTheme(playlist, 1);
  await service.playTheme(playlist, 0);
  assert.equal(engine.transitions.at(-1).startSeconds, 50);
});

test('próxima faixa e avanço automático sempre começam do zero', async () => {
  const { engine, service } = setup();
  const playlist = theme('a', 'b');
  await service.playTheme(playlist, 1);
  engine.emitProgress({ position: 100, duration: 200 });
  await service.playTheme(playlist, 0);
  await service.next();
  assert.equal(engine.transitions.at(-1).videoId, 'b');
  assert.equal(engine.transitions.at(-1).startSeconds, 0);
});

import { TRACK_LOOP, NO_LOOP, sectionLoop } from '../public/src/domain/Loop.js';

test('loop de faixa numa playlist repete a mesma faixa em vez de avançar', async () => {
  const { engine, service } = setup();
  await service.playTheme(theme('a', 'b'), 0);
  await service.setLoop(TRACK_LOOP);

  engine.emitProgress({ position: 195, duration: 200 });
  await tick();
  assert.deepEqual(engine.transitions.map((t) => t.videoId), ['a', 'a']);
  assert.equal(engine.transitions.at(-1).startSeconds, 0);
  assert.equal(service.getState().trackIndex, 0);
});

test('o botão de próxima ainda sai do loop de faixa', async () => {
  const { engine, service } = setup();
  await service.playTheme(theme('a', 'b'), 0);
  await service.setLoop(TRACK_LOOP);
  await service.next();
  assert.equal(engine.transitions.at(-1).videoId, 'b');
});

test('loop volta a seguir a playlist quando desativado', async () => {
  const { engine, service } = setup();
  await service.playTheme(theme('a', 'b'), 0);
  await service.setLoop(TRACK_LOOP);
  await service.setLoop(NO_LOOP);
  engine.emitProgress({ position: 195, duration: 200 });
  await tick();
  assert.equal(engine.transitions.at(-1).videoId, 'b');
});

test('escolher um trecho pula para o início dele', async () => {
  const { engine, service } = setup();
  await service.playTheme(theme('a'), 0);
  await service.setLoop(sectionLoop({ start: 60, end: 120, label: 'Refrão' }));
  assert.deepEqual(engine.transitions.at(-1), { videoId: 'a', fadeMs: 4000, startSeconds: 60 });
});

test('ao chegar no fim do trecho, volta para o início dele', async () => {
  const { engine, service } = setup();
  await service.playTheme(theme('a'), 0);
  await service.setLoop(sectionLoop({ start: 60, end: 120 }));

  engine.emitProgress({ position: 90, duration: 300 });
  await tick();
  assert.equal(engine.transitions.length, 2, 'meio do trecho: nada acontece');

  engine.emitProgress({ position: 115, duration: 300 });
  await tick();
  assert.equal(engine.transitions.length, 3);
  assert.equal(engine.transitions.at(-1).startSeconds, 60);
});

test('trecho até o fim da faixa volta ao início do trecho, não ao zero', async () => {
  const { engine, service } = setup();
  await service.playTheme(theme('a'), 0);
  await service.setLoop(sectionLoop({ start: 100, end: null }));
  engine.emitProgress({ position: 295, duration: 300 });
  await tick();
  assert.equal(engine.transitions.at(-1).startSeconds, 100);
});

test('trecho muito curto não fica em disparo contínuo', async () => {
  const { engine, service } = setup();
  await service.playTheme(theme('a'), 0);
  await service.setLoop(sectionLoop({ start: 60, end: 66 }));
  engine.emitProgress({ position: 61, duration: 300 });
  await tick();
  assert.equal(engine.transitions.length, 2, 'ainda no começo do trecho curto');
});

test('faixa com trecho salvo começa nele ao ser escolhida de novo', async () => {
  const { engine, service } = setup();
  const playlist = theme('a', 'b');
  await service.playTheme(playlist, 1);
  await service.setLoop(sectionLoop({ start: 40, end: 90 }));
  await service.playTheme(playlist, 0);
  await service.next();
  assert.deepEqual(engine.transitions.at(-1), { videoId: 'b', fadeMs: 4000, startSeconds: 40 });
});

test('retomar fora do trecho salvo começa no início do trecho', async () => {
  const { engine, service } = setup();
  const playlist = theme('a');
  await service.playTheme(playlist, 0);
  await service.setLoop(sectionLoop({ start: 60, end: 120 }));
  engine.emitProgress({ position: 100, duration: 300 });
  service.stop();
  await service.playTheme(playlist);
  assert.equal(engine.transitions.at(-1).startSeconds, 100, 'dentro do trecho, retoma');
});
