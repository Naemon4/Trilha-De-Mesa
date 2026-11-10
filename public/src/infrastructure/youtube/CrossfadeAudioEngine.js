import { PlayerLoadError } from '../../domain/errors.js';
import { YouTubeDeck } from './YouTubeDeck.js';

const FRAME_MS = 50;
const PROGRESS_MS = 250;
const QUICK_MUTE_MS = 150;
const HALF_PI = Math.PI / 2;

/**
 * Implementa a porta AudioEngine com dois players do YouTube (A e B).
 * A faixa nova sobe em outro player enquanto a atual desce, com curva de
 * potência igual (cos/sin), que mantém o volume percebido constante.
 */
export class CrossfadeAudioEngine {
  #host;
  #decks = null;
  #creating = null;
  #activeIndex = 0;
  #master = 1;
  #fadeToken = 0;
  #progressListeners = new Set();
  #endedListeners = new Set();

  constructor({ host }) {
    this.#host = host;
  }

  get #active() {
    return this.#decks?.[this.#activeIndex];
  }

  get #idle() {
    return this.#decks?.[1 - this.#activeIndex];
  }

  onProgress(listener) {
    this.#progressListeners.add(listener);
  }

  onTrackEnded(listener) {
    this.#endedListeners.add(listener);
  }

  setVolume(volume) {
    this.#master = Math.min(1, Math.max(0, volume));
    this.#decks?.forEach((deck) => this.#setGain(deck, deck.gain));
  }

  pause() {
    this.#decks?.forEach((deck) => deck.pause());
  }

  resume() {
    this.#active?.play();
  }

  async transitionTo(videoId, fadeMs, startSeconds = 0) {
    await this.#ensureDecks();
    const token = ++this.#fadeToken;
    const outgoing = this.#active;
    const incoming = this.#idle;

    await this.#silence(incoming, token);
    if (this.#isStale(token)) return;

    this.#setGain(incoming, 0);
    await incoming.start(videoId, startSeconds);
    if (this.#isStale(token)) return;

    this.#activeIndex = 1 - this.#activeIndex;
    this.#crossfade(outgoing, incoming, fadeMs, token);
  }

  async fadeOut(fadeMs) {
    if (!this.#decks) return;
    const token = ++this.#fadeToken;
    const startGains = this.#decks.map((deck) => deck.gain);

    const completed = await this.#animate(fadeMs, token, (t) => {
      this.#decks.forEach((deck, i) => this.#setGain(deck, startGains[i] * (1 - t)));
    });
    if (completed) this.#decks.forEach((deck) => deck.stop());
  }

  async #crossfade(outgoing, incoming, fadeMs, token) {
    const startGain = outgoing.gain;
    const completed = await this.#animate(fadeMs, token, (t) => {
      this.#setGain(outgoing, startGain * Math.cos(t * HALF_PI));
      this.#setGain(incoming, Math.sin(t * HALF_PI));
    });
    if (completed) outgoing.stop();
  }

  /** Zera rapidamente um deck que ainda estava audível de uma transição interrompida. */
  async #silence(deck, token) {
    if (deck.gain > 0.001) {
      const startGain = deck.gain;
      await this.#animate(QUICK_MUTE_MS, token, (t) => this.#setGain(deck, startGain * (1 - t)));
    }
    if (!this.#isStale(token)) {
      this.#setGain(deck, 0);
      deck.stop();
    }
  }

  /** Roda onFrame(t) com t de 0 a 1. Resolve false se outra transição assumiu o controle. */
  #animate(durationMs, token, onFrame) {
    return new Promise((resolve) => {
      const startedAt = performance.now();
      const step = () => {
        if (this.#isStale(token)) {
          resolve(false);
          return;
        }
        const t = durationMs > 0 ? Math.min(1, (performance.now() - startedAt) / durationMs) : 1;
        onFrame(t);
        if (t >= 1) resolve(true);
        else setTimeout(step, FRAME_MS);
      };
      step();
    });
  }

  #isStale(token) {
    return token !== this.#fadeToken;
  }

  #setGain(deck, gain) {
    deck.gain = gain;
    deck.setVolume(Math.round(this.#master * gain * 100));
  }

  #ensureDecks() {
    this.#creating ??= this.#createDecks().catch((error) => {
      this.#creating = null;
      this.#host.replaceChildren();
      throw new PlayerLoadError('Não consegui carregar o player do YouTube. Verifique sua conexão.', { cause: error });
    });
    return this.#creating;
  }

  async #createDecks() {
    const mounts = [0, 1].map(() => this.#host.appendChild(document.createElement('div')));
    this.#decks = await Promise.all(mounts.map((mount) => YouTubeDeck.create(mount)));
    this.#decks.forEach((deck) => {
      deck.onEnded(() => {
        if (deck === this.#active) this.#endedListeners.forEach((listener) => listener());
      });
    });
    setInterval(() => this.#emitProgress(), PROGRESS_MS);
  }

  #emitProgress() {
    const deck = this.#active;
    if (!deck?.isPlaying) return;
    const progress = { position: deck.position, duration: deck.duration };
    this.#progressListeners.forEach((listener) => listener(progress));
  }
}
