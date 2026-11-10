export const LoopType = Object.freeze({ NONE: 'none', TRACK: 'track', SECTION: 'section' });

/** Segue o fluxo normal (playlist avança, vídeo único repete). */
export const NO_LOOP = Object.freeze({ type: LoopType.NONE });
/** Repete a faixa inteira, sem avançar na playlist. */
export const TRACK_LOOP = Object.freeze({ type: LoopType.TRACK });

/** Repete só um trecho. end nulo significa "até o fim da faixa". */
export function sectionLoop({ start, end = null, label = '' }) {
  if (!Number.isFinite(start) || start < 0) throw new RangeError('Início do trecho inválido.');
  if (end !== null && !(Number.isFinite(end) && end > start)) throw new RangeError('Fim do trecho inválido.');
  return Object.freeze({ type: LoopType.SECTION, start, end, label });
}

/** Cada capítulo vai até o início do próximo; o último vai até o fim. */
export function sectionsFromChapters(chapters) {
  return chapters.map((chapter, index) =>
    sectionLoop({ start: chapter.start, end: chapters[index + 1]?.start ?? null, label: chapter.title }),
  );
}

export function sameLoop(a, b) {
  if (a.type !== b.type) return false;
  return a.type !== LoopType.SECTION || (a.start === b.start && a.end === b.end);
}

/** Valida dados vindos do arquivo, que podem ter sido editados à mão. */
export function normalizeLoop(raw) {
  if (raw?.type === LoopType.TRACK) return TRACK_LOOP;
  if (raw?.type === LoopType.SECTION) {
    try {
      return sectionLoop({ start: raw.start, end: raw.end ?? null, label: String(raw.label ?? '') });
    } catch {
      return NO_LOOP;
    }
  }
  return NO_LOOP;
}
