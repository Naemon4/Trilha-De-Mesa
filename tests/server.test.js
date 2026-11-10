import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { createAppServer } from '../server/app.js';

async function setup(t, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'trilha-'));
  const publicDir = join(dir, 'public');
  await mkdir(publicDir);
  await writeFile(join(publicDir, 'index.html'), '<h1>ok</h1>');
  await writeFile(join(dir, 'segredo.txt'), 'não pode vazar');
  const dataFile = join(dir, 'data', 'estado.json');

  const server = createAppServer({
    publicDir,
    dataFile,
    fetchChapters: async () => [{ title: 'A', start: 0 }],
    ...options,
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.close();
    await rm(dir, { recursive: true, force: true });
  });
  const { port } = server.address();
  return { port, dataFile };
}

/** Requisição crua (sem normalizar a URL), para testar caminhos maliciosos. */
function call(port, { method = 'GET', path = '/', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const options = { host: '127.0.0.1', port, method, path, headers: { host: `localhost:${port}`, ...headers } };
    const req = request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

const json = { 'content-type': 'application/json' };

test('sem arquivo de dados, a API devolve um objeto vazio', async (t) => {
  const { port } = await setup(t);
  const response = await call(port, { path: '/api/state' });
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), {});
});

test('PUT grava o JSON no disco e GET devolve o mesmo conteúdo', async (t) => {
  const { port, dataFile } = await setup(t);
  const state = { themes: [{ id: 'x', name: 'Ação' }] };
  const put = await call(port, { method: 'PUT', path: '/api/state', headers: json, body: JSON.stringify(state) });
  assert.equal(put.status, 204);
  assert.deepEqual(JSON.parse(await readFile(dataFile, 'utf8')), state);
  assert.deepEqual(JSON.parse((await call(port, { path: '/api/state' })).body), state);
});

test('rejeita JSON inválido, listas, content-type errado e método errado', async (t) => {
  const { port } = await setup(t);
  assert.equal((await call(port, { method: 'PUT', path: '/api/state', headers: json, body: '{oops' })).status, 400);
  assert.equal((await call(port, { method: 'PUT', path: '/api/state', headers: json, body: '[]' })).status, 400);
  assert.equal((await call(port, { method: 'PUT', path: '/api/state', body: '{}' })).status, 415);
  assert.equal((await call(port, { method: 'DELETE', path: '/api/state' })).status, 405);
});

test('corpo grande demais devolve 413', async (t) => {
  const { port } = await setup(t);
  const body = JSON.stringify({ big: 'x'.repeat(6 * 1024 * 1024) });
  const response = await call(port, { method: 'PUT', path: '/api/state', headers: json, body })
    .catch(() => ({ status: 413 })); // o servidor pode fechar a conexão antes de ler tudo
  assert.equal(response.status, 413);
});

test('uma gravação que falha não trava as seguintes', async (t) => {
  const { port, dataFile } = await setup(t);
  // Um diretório no lugar do arquivo temporário faz a primeira gravação falhar.
  await mkdir(`${dataFile}.tmp`, { recursive: true });
  const first = await call(port, { method: 'PUT', path: '/api/state', headers: json, body: '{"n":1}' });
  assert.equal(first.status, 500);

  await rm(`${dataFile}.tmp`, { recursive: true });
  const second = await call(port, { method: 'PUT', path: '/api/state', headers: json, body: '{"n":2}' });
  assert.equal(second.status, 204);
  assert.deepEqual(JSON.parse(await readFile(dataFile, 'utf8')), { n: 2 });
});

test('a API recusa hosts que não são locais (DNS rebinding)', async (t) => {
  const { port } = await setup(t);
  const response = await call(port, { path: '/api/state', headers: { host: 'site-malicioso.com' } });
  assert.equal(response.status, 403);
  assert.equal((await call(port, { path: '/api/state', headers: { host: `127.0.0.1:${port}` } })).status, 200);
});

test('allowAnyHost libera a API para outros hosts (uso na rede local)', async (t) => {
  const { port } = await setup(t, { allowAnyHost: true });
  const response = await call(port, { path: '/api/state', headers: { host: '192.168.0.10:5173' } });
  assert.equal(response.status, 200);
});

test('serve arquivos públicos e bloqueia acesso fora da pasta public', async (t) => {
  const { port } = await setup(t);
  assert.equal((await call(port, { path: '/' })).body, '<h1>ok</h1>');
  assert.equal((await call(port, { path: '/nao-existe.js' })).status, 404);
  const escaped = await call(port, { path: '/..%2fsegredo.txt' });
  assert.notEqual(escaped.status, 200);
  assert.doesNotMatch(escaped.body, /vazar/);
  assert.equal((await call(port, { path: '/%E0%A4%A' })).status, 400);
});

test('ID de vídeo inválido devolve 400, e não 502', async (t) => {
  const { fetchChapters } = await import('../server/chapters.js');
  const { port } = await setup(t, { fetchChapters });
  assert.equal((await call(port, { path: '/api/chapters?v=bad' })).status, 400);
});

test('marcadores vêm do gateway injetado', async (t) => {
  const { port } = await setup(t);
  const response = await call(port, { path: '/api/chapters?v=abcdefghijk' });
  assert.deepEqual(JSON.parse(response.body), { chapters: [{ title: 'A', start: 0 }] });
});
