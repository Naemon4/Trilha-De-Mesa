/** Busca marcadores (capítulos) sob demanda e guarda o resultado em memória. */
export class ChapterCatalog {
  #cache = new Map();

  /** @param {import('./ports.js').ChapterGateway} gateway */
  constructor(gateway) {
    this.gateway = gateway;
  }

  /** Rejeita se a busca falhar (e tenta de novo na próxima vez). Resolve [] se não houver marcadores. */
  get(videoId) {
    if (!this.#cache.has(videoId)) {
      const request = this.gateway.fetchChapters(videoId).catch((error) => {
        this.#cache.delete(videoId);
        throw error;
      });
      this.#cache.set(videoId, request);
    }
    return this.#cache.get(videoId);
  }
}
