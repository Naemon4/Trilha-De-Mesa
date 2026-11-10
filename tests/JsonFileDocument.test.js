import test from 'node:test';
import assert from 'node:assert/strict';

// JsonFileDocument roda no navegador; aqui simulamos window, document e fetch.
globalThis.window ??= { addEventListener() {} };
globalThis.document ??= { addEventListener() {}, visibilityState: 'visible' };
const { JsonFileDocument } = await import('../public/src/infrastructure/storage/JsonFileDocument.js');

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

function fakeFetch(t, { loadOk = true, data = {} } = {}) {
  const puts = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (options.method === 'PUT') {
      puts.push(JSON.parse(options.body));
      return { ok: true };
    }
    if (!loadOk) throw new Error('servidor fora do ar');
    return { ok: true, json: async () => data };
  };
  t.after(() => {
    globalThis.fetch = original;
  });
  return puts;
}

test('se a leitura falhar, nunca sobrescreve o arquivo com dados vazios', async (t) => {
  const puts = fakeFetch(t, { loadOk: false });
  const store = new JsonFileDocument();
  await assert.rejects(store.load());
  assert.equal(store.canSave, false);

  store.set('themes', []);
  store.flush();
  await settle();
  assert.deepEqual(puts, []);
});

test('depois de carregar, grava as mudanças junto com o que já existia', async (t) => {
  const puts = fakeFetch(t, { data: { settings: { volume: 0.5 } } });
  const store = new JsonFileDocument();
  await store.load();
  store.set('themes', [{ id: 'a' }]);
  store.flush();
  await settle();
  assert.deepEqual(puts, [{ settings: { volume: 0.5 }, themes: [{ id: 'a' }] }]);
});
