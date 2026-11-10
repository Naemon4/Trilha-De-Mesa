import { LoopType, normalizeLoop } from '../domain/Loop.js';

// Se faltar menos que isso para acabar, a faixa recomeça do zero na próxima vez.
const RESTART_WITHIN_SECONDS = 20;

/**
 * Lembra, por tema, qual faixa estava tocando e em que segundo cada faixa parou.
 * Também guarda o modo de loop de cada faixa.
 * Formato: { [themeId]: { trackIndex, positions: { [i]: segundos }, loops: { [i]: loop } } }
 */
export class PlaybackMemory {
  #data;

  /** @param {import('./ports.js').PlaybackMemoryRepository} repository */
  constructor(repository) {
    this.repository = repository;
    const data = repository.load();
    this.#data = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  }

  /** Esquece temas que não existem mais (removidos em sessões anteriores). */
  retainOnly(themeIds) {
    const keep = new Set(themeIds);
    const stale = Object.keys(this.#data).filter((themeId) => !keep.has(themeId));
    if (stale.length === 0) return;
    stale.forEach((themeId) => delete this.#data[themeId]);
    this.repository.save(this.#data);
  }

  lastTrackIndex(themeId, trackCount) {
    const index = this.#data[themeId]?.trackIndex ?? 0;
    return index < trackCount ? index : 0;
  }

  positionOf(themeId, trackIndex) {
    return this.#data[themeId]?.positions?.[trackIndex] ?? 0;
  }

  loopOf(themeId, trackIndex) {
    return normalizeLoop(this.#data[themeId]?.loops?.[trackIndex]);
  }

  setLoop(themeId, trackIndex, loop) {
    const entry = this.#entry(themeId);
    entry.loops ??= {};
    if (loop.type === LoopType.NONE) delete entry.loops[trackIndex];
    else entry.loops[trackIndex] = loop;
    this.repository.save(this.#data);
  }

  /** Marca a faixa que vai tocar agora e o segundo em que ela começa. */
  select(themeId, trackIndex, startSeconds = 0) {
    const entry = this.#entry(themeId);
    entry.trackIndex = trackIndex;
    entry.positions[trackIndex] = Math.floor(startSeconds);
    this.repository.save(this.#data);
  }

  remember(themeId, trackIndex, position, duration) {
    const nearEnd = duration > 0 && duration - position < RESTART_WITHIN_SECONDS;
    const seconds = nearEnd ? 0 : Math.floor(position);
    const entry = this.#entry(themeId);
    if (entry.trackIndex === trackIndex && entry.positions[trackIndex] === seconds) return;

    entry.trackIndex = trackIndex;
    entry.positions[trackIndex] = seconds;
    this.repository.save(this.#data);
  }

  #entry(themeId) {
    const entry = (this.#data[themeId] ??= { trackIndex: 0, positions: {} });
    entry.positions ??= {};
    return entry;
  }
}
