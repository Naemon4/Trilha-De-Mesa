import { PlayerLoadError, TrackUnavailableError } from '../domain/errors.js';
import { LoopType, NO_LOOP } from '../domain/Loop.js';

export const PlaybackStatus = Object.freeze({ IDLE: 'idle', PLAYING: 'playing', PAUSED: 'paused' });

export const MAX_CROSSFADE_SECONDS = 12;
const STOP_FADE_MAX_MS = 2000;
// Tempo extra para o YouTube carregar a próxima faixa antes do fim da atual.
const LOAD_ALLOWANCE_SECONDS = 2;
const MIN_POSITION_TO_ADVANCE = 1;

/**
 * Orquestra a reprodução: qual tema e faixa tocam, quando avançar ou repetir,
 * o que fazer se uma faixa falhar. Não conhece YouTube nem DOM.
 */
export class PlaybackService {
  #theme = null;
  #requestId = 0;
  #noticeCount = 0;
  #listeners = new Set();
  #progressListeners = new Set();
  #state;

  /** @param {{ engine: import('./ports.js').AudioEngine, settingsRepository: import('./ports.js').SettingsRepository, memory: import('./PlaybackMemory.js').PlaybackMemory }} deps */
  constructor({ engine, settingsRepository, memory }) {
    this.engine = engine;
    this.settingsRepository = settingsRepository;
    this.memory = memory;

    const { volume, crossfadeSeconds } = settingsRepository.load();
    this.#state = {
      status: PlaybackStatus.IDLE,
      loading: false,
      themeId: null,
      trackIndex: 0,
      loop: NO_LOOP,
      volume,
      crossfadeSeconds,
      notice: null,
    };

    engine.setVolume(volume);
    engine.onProgress((progress) => this.#handleProgress(progress));
    engine.onTrackEnded(() => this.#advance());
  }

  getState() {
    return this.#state;
  }

  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  subscribeProgress(listener) {
    this.#progressListeners.add(listener);
    return () => this.#progressListeners.delete(listener);
  }

  /** Sem trackIndex, volta para a faixa e o segundo em que o tema parou da última vez. */
  async playTheme(theme, trackIndex) {
    this.#theme = theme;
    const index = trackIndex ?? this.memory.lastTrackIndex(theme.id, theme.tracks.length);
    await this.#transitionTo(index, { resume: true });
  }

  togglePause() {
    const { status, loading } = this.#state;
    if (loading) return;
    if (status === PlaybackStatus.PLAYING) {
      this.engine.pause();
      this.#patch({ status: PlaybackStatus.PAUSED });
    } else if (status === PlaybackStatus.PAUSED) {
      this.engine.resume();
      this.#patch({ status: PlaybackStatus.PLAYING });
    }
  }

  next() {
    if (!this.#theme) return;
    return this.#transitionTo(this.#shiftIndex(1));
  }

  previous() {
    if (!this.#theme) return;
    return this.#transitionTo(this.#shiftIndex(-1));
  }

  stop() {
    this.#requestId += 1;
    this.#theme = null;
    this.engine.fadeOut(Math.min(this.#fadeMs(), STOP_FADE_MAX_MS)).catch(() => {});
    this.#patch({ status: PlaybackStatus.IDLE, loading: false, themeId: null, trackIndex: 0, loop: NO_LOOP });
  }

  /** Define o loop da faixa atual (e o lembra para as próximas vezes). */
  setLoop(loop) {
    const { themeId, trackIndex, status, loading } = this.#state;
    if (!this.#theme || status === PlaybackStatus.IDLE || loading) return;

    this.memory.setLoop(themeId, trackIndex, loop);
    this.#patch({ loop });
    if (loop.type === LoopType.SECTION) return this.#transitionTo(trackIndex);
  }

  setVolume(volume) {
    const value = clamp(volume, 0, 1);
    this.engine.setVolume(value);
    this.#patch({ volume: value });
    this.#saveSettings();
  }

  setCrossfade(seconds) {
    this.#patch({ crossfadeSeconds: clamp(seconds, 0, MAX_CROSSFADE_SECONDS) });
    this.#saveSettings();
  }

  async #transitionTo(index, { attempts = 0, resume = false } = {}) {
    const requestId = ++this.#requestId;
    const theme = this.#theme;
    const loop = this.memory.loopOf(theme.id, index);
    const startSeconds = resume ? this.#resumePosition(theme.id, index, loop) : startPoint(loop);
    this.memory.select(theme.id, index, startSeconds);
    this.#patch({ status: PlaybackStatus.PLAYING, loading: true, themeId: theme.id, trackIndex: index, loop });

    try {
      await this.engine.transitionTo(theme.tracks[index].videoId, this.#fadeMs(), startSeconds);
      if (requestId !== this.#requestId) return;
      this.#patch({ loading: false });
    } catch (error) {
      if (requestId !== this.#requestId) return;
      await this.#recoverFrom(error, index, attempts);
    }
  }

  async #recoverFrom(error, index, attempts) {
    const canSkip = error instanceof TrackUnavailableError && attempts + 1 < this.#theme.tracks.length;
    if (canSkip) {
      this.#notify('Faixa indisponível. Pulando para a próxima.');
      await this.#transitionTo(this.#shiftIndex(1, index), { attempts: attempts + 1 });
      return;
    }
    this.stop();
    this.#notify(errorMessage(error));
  }

  /** Fim da faixa (ou do trecho): repete se houver loop, senão vai para a próxima. */
  #advance() {
    const { status, loading, loop, trackIndex } = this.#state;
    if (!this.#theme || loading || status !== PlaybackStatus.PLAYING) return;
    const index = loop.type === LoopType.NONE ? this.#shiftIndex(1) : trackIndex;
    this.#transitionTo(index);
  }

  #handleProgress({ position, duration }) {
    const { status, loading, loop, crossfadeSeconds } = this.#state;
    if (status !== PlaybackStatus.PLAYING || loading) return;

    for (const listener of this.#progressListeners) listener({ position, duration });
    this.memory.remember(this.#state.themeId, this.#state.trackIndex, position, duration);

    const lead = crossfadeSeconds + LOAD_ALLOWANCE_SECONDS;
    if (loop.type === LoopType.SECTION && loop.end !== null) {
      const effectiveLead = Math.min(lead, (loop.end - loop.start) / 2);
      if (loop.end - position <= effectiveLead) this.#advance();
      return;
    }

    if (duration <= 0 || position < MIN_POSITION_TO_ADVANCE) return;
    if (duration - position <= Math.min(lead, duration / 2)) this.#advance();
  }

  /** Ao voltar para a faixa, retoma de onde parou, mas sempre dentro do trecho em loop. */
  #resumePosition(themeId, index, loop) {
    const position = this.memory.positionOf(themeId, index);
    if (loop.type !== LoopType.SECTION) return position;
    const outside = position < loop.start || (loop.end !== null && position >= loop.end);
    return outside ? loop.start : position;
  }

  #shiftIndex(step, from = this.#state.trackIndex) {
    const total = this.#theme.tracks.length;
    return (from + step + total) % total;
  }

  #fadeMs() {
    return this.#state.crossfadeSeconds * 1000;
  }

  #notify(message) {
    this.#patch({ notice: { id: ++this.#noticeCount, message } });
  }

  #saveSettings() {
    const { volume, crossfadeSeconds } = this.#state;
    this.settingsRepository.save({ volume, crossfadeSeconds });
  }

  #patch(partial) {
    this.#state = { ...this.#state, ...partial };
    for (const listener of this.#listeners) listener(this.#state);
  }
}

function startPoint(loop) {
  return loop.type === LoopType.SECTION ? loop.start : 0;
}

function errorMessage(error) {
  if (error instanceof PlayerLoadError) return error.message;
  if (error instanceof TrackUnavailableError) return 'Nenhuma faixa deste tema pôde ser tocada.';
  return 'Algo deu errado ao tocar. Tente de novo.';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}
