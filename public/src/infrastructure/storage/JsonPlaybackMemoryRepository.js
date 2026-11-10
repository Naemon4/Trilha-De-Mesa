// A posição muda o tempo todo, então a gravação em disco é espaçada.
const SAVE_DELAY_MS = 3000;

export class JsonPlaybackMemoryRepository {
  constructor(document) {
    this.document = document;
  }

  load() {
    return this.document.get('playback', {});
  }

  save(memory) {
    this.document.set('playback', memory, { delayMs: SAVE_DELAY_MS });
  }
}
