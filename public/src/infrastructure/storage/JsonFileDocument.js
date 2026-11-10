const API_URL = '/api/state';
const RETRY_MS = 5000;
// Limite do navegador para requisições "keepalive" (enviadas ao fechar a aba).
const KEEPALIVE_LIMIT_BYTES = 60000;

/**
 * Cópia em memória do arquivo JSON que o servidor guarda no disco.
 * Leituras são imediatas; gravações são agrupadas e enviadas em segundo plano.
 * Enquanto o arquivo não for lido com sucesso, nada é gravado: assim uma falha
 * na leitura nunca sobrescreve os dados reais com um estado vazio.
 */
export class JsonFileDocument {
  #url;
  #data = {};
  #timer = null;
  #dueAt = Infinity;
  #dirty = false;
  #loaded = false;
  #sending = Promise.resolve();
  #errorListeners = new Set();

  constructor({ url = API_URL } = {}) {
    this.#url = url;
    window.addEventListener('pagehide', () => this.flush({ unloading: true }));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush();
    });
  }

  async load() {
    const response = await fetch(this.#url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    this.#data = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    this.#loaded = true;
  }

  /** false se o arquivo não pôde ser lido; nesse caso as mudanças ficam só na memória. */
  get canSave() {
    return this.#loaded;
  }

  get(key, fallback) {
    return key in this.#data ? structuredClone(this.#data[key]) : fallback;
  }

  set(key, value, { delayMs = 300 } = {}) {
    this.#data[key] = value;
    this.#dirty = true;
    this.#schedule(delayMs);
  }

  onError(listener) {
    this.#errorListeners.add(listener);
  }

  flush({ unloading = false } = {}) {
    clearTimeout(this.#timer);
    this.#timer = null;
    this.#dueAt = Infinity;
    if (!this.#dirty || !this.#loaded) return;
    this.#dirty = false;

    const body = JSON.stringify(this.#data);
    const send = () => this.#send(body, unloading && byteLength(body) < KEEPALIVE_LIMIT_BYTES);
    this.#sending = unloading ? send() : this.#sending.then(send);
  }

  async #send(body, keepalive) {
    try {
      const response = await fetch(this.#url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      this.#dirty = true;
      this.#schedule(RETRY_MS);
      this.#errorListeners.forEach((listener) => listener(error));
    }
  }

  /** Mantém só o agendamento mais próximo. */
  #schedule(delayMs) {
    const dueAt = Date.now() + delayMs;
    if (this.#timer !== null && this.#dueAt <= dueAt) return;
    clearTimeout(this.#timer);
    this.#dueAt = dueAt;
    this.#timer = setTimeout(() => this.flush(), delayMs);
  }
}

function byteLength(text) {
  return new TextEncoder().encode(text).length;
}
