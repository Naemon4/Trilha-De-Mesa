import { createServer } from 'node:http';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { InvalidVideoIdError, fetchChapters as defaultFetchChapters } from './chapters.js';

const MAX_BODY_BYTES = 5 * 1024 * 1024;
const RENAME_RETRIES = 5;
const RENAME_RETRY_MS = 100;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Monta o servidor HTTP do app sem colocá-lo para escutar (facilita os testes).
 * @param {{ publicDir: string, dataFile: string, fetchChapters?: Function, allowAnyHost?: boolean }} options
 */
export function createAppServer({ publicDir, dataFile, fetchChapters = defaultFetchChapters, allowAnyHost = false }) {
  const root = publicDir.endsWith(sep) ? publicDir : publicDir + sep;
  let writeQueue = Promise.resolve();

  return createServer(async (request, response) => {
    try {
      const { pathname } = new URL(request.url, 'http://localhost');
      if (pathname.startsWith('/api/')) {
        // Protege contra DNS rebinding: um site externo não consegue falar com a API
        // usando um domínio próprio que aponta para 127.0.0.1.
        if (!allowAnyHost && !isLoopbackHost(request.headers.host)) throw new HttpError(403, 'Host não permitido');
        if (pathname === '/api/state') await handleState(request, response);
        else if (pathname === '/api/chapters') await handleChapters(request, response);
        else throw new HttpError(404, 'Not found');
      } else {
        await serveStatic(pathname, response);
      }
    } catch (error) {
      if (error instanceof HttpError) {
        send(response, error.status, error.message);
      } else {
        console.error(error);
        send(response, 500, 'Erro interno');
      }
    }
  });

  // ----- API: um único arquivo JSON com temas, configurações e posições -----

  async function handleState(request, response) {
    if (request.method === 'GET') {
      const body = await readFile(dataFile, 'utf8').catch((error) => {
        if (error.code === 'ENOENT') return '{}';
        throw error;
      });
      send(response, 200, body, 'application/json; charset=utf-8');
      return;
    }

    if (request.method === 'PUT') {
      if (!request.headers['content-type']?.startsWith('application/json')) {
        throw new HttpError(415, 'Use application/json');
      }
      const data = parseObject(await readBody(request));
      if (!data) throw new HttpError(400, 'JSON inválido');

      // A fila garante uma gravação por vez, na ordem de chegada. O catch impede
      // que uma falha isolada (disco cheio, arquivo bloqueado) trave as próximas.
      const write = writeQueue.catch(() => {}).then(() => writeAtomically(dataFile, data));
      writeQueue = write;
      await write;
      response.writeHead(204).end();
      return;
    }

    throw new HttpError(405, 'Método não permitido');
  }

  async function handleChapters(request, response) {
    const videoId = new URL(request.url, 'http://localhost').searchParams.get('v') ?? '';
    try {
      const chapters = await fetchChapters(videoId);
      send(response, 200, JSON.stringify({ chapters }), 'application/json; charset=utf-8');
    } catch (error) {
      const status = error instanceof InvalidVideoIdError ? 400 : 502;
      send(response, status, JSON.stringify({ error: error.message }), 'application/json; charset=utf-8');
    }
  }

  // ----- Arquivos estáticos -----

  async function serveStatic(pathname, response) {
    let decoded;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      throw new HttpError(400, 'URL inválida');
    }
    if (decoded.includes('\0')) throw new HttpError(400, 'URL inválida');

    const relativePath = decoded === '/' ? 'index.html' : decoded.slice(1);
    const filePath = normalize(join(root, relativePath));
    if (!filePath.startsWith(root)) throw new HttpError(403, 'Forbidden');

    let body;
    try {
      body = await readFile(filePath);
    } catch {
      throw new HttpError(404, 'Not found');
    }
    const type = CONTENT_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    response
      .writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' })
      .end(body);
  }
}

/** Grava num arquivo temporário e troca, para nunca deixar o JSON pela metade. */
export async function writeAtomically(file, data) {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  await writeFile(temporary, JSON.stringify(data, null, 2));
  await renameWithRetry(temporary, file);
}

// No Windows, antivírus e indexador às vezes seguram o arquivo por alguns milissegundos.
async function renameWithRetry(from, to) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      const retryable = ['EPERM', 'EACCES', 'EBUSY'].includes(error.code);
      if (!retryable || attempt >= RENAME_RETRIES) throw error;
      await new Promise((resolve) => setTimeout(resolve, RENAME_RETRY_MS * (attempt + 1)));
    }
  }
}

function isLoopbackHost(hostHeader = '') {
  const host = hostHeader.toLowerCase().replace(/:\d+$/, '');
  return LOOPBACK_HOSTS.has(host);
}

function parseObject(text) {
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function readBody(request) {
  return new Promise((resolveBody, reject) => {
    const declared = Number(request.headers['content-length']);
    if (declared > MAX_BODY_BYTES) {
      reject(new HttpError(413, 'Corpo grande demais'));
      return;
    }
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, 'Corpo grande demais'));
        request.pause();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function send(response, status, body, type = 'text/plain; charset=utf-8') {
  if (response.headersSent) return;
  response
    .writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
    .end(body);
}
