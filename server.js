import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { createAppServer } from './server/app.js';

const PUBLIC_DIR = fileURLToPath(new URL('./public/', import.meta.url));
const DATA_FILE = process.env.DATA_FILE
  ? resolve(process.env.DATA_FILE)
  : fileURLToPath(new URL('./data/trilha-de-mesa.json', import.meta.url));
const PORT = Number(process.env.PORT) || 5173;
// Por padrão só este computador acessa o app. HOST=0.0.0.0 libera para a rede local.
const HOST = process.env.HOST || '127.0.0.1';
const IS_LOCAL_ONLY = ['127.0.0.1', 'localhost', '::1'].includes(HOST);

const server = createAppServer({ publicDir: PUBLIC_DIR, dataFile: DATA_FILE, allowAnyHost: !IS_LOCAL_ONLY });

server.listen(PORT, HOST, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Trilha de Mesa rodando em ${url}`);
  if (!IS_LOCAL_ONLY) console.log(`Atenção: acessível pela rede (HOST=${HOST}). Qualquer pessoa na rede pode alterar seus temas.`);
  console.log(`Seus dados ficam em: ${DATA_FILE}`);
  console.log('Para encerrar, feche esta janela ou aperte Ctrl+C.');
  if (process.argv.includes('--open')) openBrowser(url);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`A porta ${PORT} já está em uso. Talvez o app já esteja aberto em outra janela.`);
    console.error('Feche a outra janela ou rode com outra porta, por exemplo: PORT=5174 npm start');
  } else {
    console.error(error.message);
  }
  process.exit(1);
});

function openBrowser(url) {
  const commands = { win32: `start "" "${url}"`, darwin: `open "${url}"` };
  exec(commands[process.platform] ?? `xdg-open "${url}"`);
}
