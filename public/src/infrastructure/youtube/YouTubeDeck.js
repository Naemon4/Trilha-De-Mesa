import { TrackUnavailableError } from '../../domain/errors.js';
import { loadYouTubeApi } from './loadYouTubeApi.js';

const PlayerState = Object.freeze({ ENDED: 0, PLAYING: 1 });
const READY_TIMEOUT_MS = 15000;
const START_TIMEOUT_MS = 15000;

/** Um "toca-discos": envolve um YT.Player e expõe só o que o motor precisa. */
export class YouTubeDeck {
  /** Volume relativo desta deck (0 a 1), controlado pelo motor de crossfade. */
  gain = 0;

  #player;
  #waiters = new Set();
  #endedListeners = new Set();

  static async create(mountElement) {
    const YT = await loadYouTubeApi();
    const deck = new YouTubeDeck();

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('O player demorou demais para iniciar.')), READY_TIMEOUT_MS);
      deck.#player = new YT.Player(mountElement, {
        width: '200',
        height: '200',
        playerVars: {
          controls: 0,
          disablekb: 1,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            clearTimeout(timer);
            resolve();
          },
          onStateChange: (event) => deck.#handleState(event.data),
          onError: () => deck.#handleError(),
        },
      });
    });
    return deck;
  }

  /** Carrega o vídeo e resolve quando ele realmente começa a tocar. */
  start(videoId, startSeconds = 0) {
    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject, timer: null };
      waiter.timer = setTimeout(
        () => this.#settle(waiter, new TrackUnavailableError('Tempo esgotado ao carregar a faixa.')),
        START_TIMEOUT_MS,
      );
      this.#waiters.add(waiter);
      this.#player.loadVideoById({ videoId, startSeconds });
    });
  }

  play() {
    this.#player.playVideo();
  }

  pause() {
    this.#player.pauseVideo();
  }

  stop() {
    this.#player.stopVideo();
  }

  setVolume(percent) {
    this.#player.setVolume(percent);
  }

  get isPlaying() {
    return this.#player.getPlayerState?.() === PlayerState.PLAYING;
  }

  get position() {
    return this.#player.getCurrentTime?.() ?? 0;
  }

  get duration() {
    return this.#player.getDuration?.() ?? 0;
  }

  onEnded(listener) {
    this.#endedListeners.add(listener);
  }

  #handleState(state) {
    if (state === PlayerState.PLAYING) {
      for (const waiter of [...this.#waiters]) this.#settle(waiter);
    } else if (state === PlayerState.ENDED) {
      for (const listener of this.#endedListeners) listener();
    }
  }

  #handleError() {
    const error = new TrackUnavailableError('Esta faixa não pode ser tocada fora do YouTube.');
    for (const waiter of [...this.#waiters]) this.#settle(waiter, error);
  }

  #settle(waiter, error) {
    clearTimeout(waiter.timer);
    this.#waiters.delete(waiter);
    if (error) waiter.reject(error);
    else waiter.resolve();
  }
}
