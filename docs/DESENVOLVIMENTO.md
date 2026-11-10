# Guia de desenvolvimento

## Requisitos

- Node.js 18 ou mais novo (usa `fetch`, `AbortSignal.timeout` e `node:test` nativos)
- Um navegador moderno, com suporte a ES modules, campos privados (`#`) e `structuredClone`
- Internet, porque o áudio, os títulos e os capítulos vêm do YouTube

O projeto não tem dependências nem etapa de build. Não é preciso rodar `npm install`.

## Rodando

```bash
npm start              # http://localhost:5173
node server.js --open  # também abre o navegador (é o que os arquivos "Iniciar" fazem)
```

### Variáveis de ambiente

| Variável    | Padrão                       | Uso                                                                 |
| ----------- | ---------------------------- | ------------------------------------------------------------------- |
| `PORT`      | `5173`                       | Porta HTTP                                                          |
| `HOST`      | `127.0.0.1`                  | Interface de rede. `0.0.0.0` libera o acesso pela rede local (sem autenticação; use só em redes confiáveis) |
| `DATA_FILE` | `data/trilha-de-mesa.json`   | Caminho do arquivo de dados                                         |

Exemplo para desenvolver sem mexer nos seus temas reais:

```bash
DATA_FILE=/tmp/trilha-dev.json PORT=5174 npm start
```

No PowerShell: `$env:DATA_FILE="$env:TEMP\trilha-dev.json"; $env:PORT=5174; npm start`

> O `localStorage` é separado por origem. Se você mudar a porta, a migração de dados antigos do navegador (`migrateLegacyStorage`) não vai encontrar o que foi salvo na porta 5173.

## Testes

```bash
npm test
```

Usa o runner nativo do Node (`node --test`), que encontra os arquivos em `tests/`. Não precisa de navegador:

| Arquivo                         | Cobre                                                                 |
| ------------------------------- | --------------------------------------------------------------------- |
| `YouTubeLink.test.js`           | Formatos de link aceitos e recusados                                  |
| `ThemeLibrary.test.js`          | Adicionar, renomear, remover/desfazer, títulos                        |
| `PlaybackService.test.js`       | Avanço, loops, retomada, faixas indisponíveis, concorrência           |
| `PlaybackMemory.test.js`        | Posições, perto do fim, limpeza de temas removidos                    |
| `ChapterCatalog.test.js`        | Cache e nova tentativa após falha                                     |
| `chapters.test.js`              | Leitura de capítulos oficiais e da descrição                          |
| `server.test.js`                | API, gravação atômica, fila de escrita, Host, path traversal, limites |
| `JsonFileDocument.test.js`      | Agrupamento das gravações e proteção contra sobrescrever os dados     |

Padrões usados nos testes:

- As portas são substituídas por objetos falsos simples (por exemplo, `FakeEngine` em `PlaybackService.test.js`).
- O servidor é criado com `createAppServer({ publicDir, dataFile, fetchChapters })` numa pasta temporária, escutando na porta `0` (aleatória).
- Código de navegador que usa `window` ou `document` recebe stubs mínimos em `globalThis` antes do `import` dinâmico.

A parte que depende do YouTube real (`CrossfadeAudioEngine`, `YouTubeDeck`, `YouTubePlaylistResolver`) e a interface são testadas manualmente. Veja o roteiro abaixo.

## Roteiro de teste manual

Antes de publicar uma mudança na reprodução ou na interface:

1. Adicionar um vídeo único e uma playlist pública.
2. Tocar, pausar com `Espaço` e trocar de tema com `1`/`2`. A transição deve ser suave.
3. Em uma playlist, usar `N`/`P` e a lista de **Faixas**.
4. Abrir o painel de **Loop** (`L`) num vídeo com capítulos, escolher um trecho e esperar ele voltar ao início.
5. Recarregar a página e tocar o mesmo tema de novo: ele deve retomar no ponto em que parou.
6. Parar o servidor com o app aberto, mudar o volume e ver o aviso de "não consegui salvar". Religar o servidor e confirmar que o valor foi gravado.
7. Remover um tema e usar **Desfazer**.

## Convenções

- **Idioma:** textos da interface, mensagens de erro e comentários em português. Nomes de código (classes, funções, variáveis) em inglês.
- **Módulos:** ES modules (`"type": "module"`), imports com a extensão `.js`.
- **Estado privado:** campos `#privados` nas classes.
- **Imutabilidade:** temas e estado de reprodução são substituídos, não alterados (`{ ...state, ...partial }`).
- **DOM:** sempre via `h()` de `presentation/dom.js`. Não use `innerHTML` com dados vindos do usuário ou do YouTube.
- **Erros de domínio:** estenda `DomainError`. O `App` mostra `error.message` desses erros ao usuário; erros genéricos viram uma mensagem neutra.
- **Regra de dependência:** `domain` e `application` não podem importar de `infrastructure` nem de `presentation`. Se precisar de algo externo, crie ou estenda uma porta em `ports.js`.

## Receitas

### Adicionar uma nova fonte de armazenamento

1. Crie, em `infrastructure/storage/`, uma classe com `findAll()` / `saveAll()` (temas), `load()` / `save()` (configurações e memória), seguindo `ports.js`.
2. Troque a instância em `main.js`. Nenhuma outra camada muda.

### Adicionar um atalho de teclado

Edite `App.#onKeydown` em `presentation/App.js` e acrescente a dica no rodapé (`shortcut(...)` em `App.#build`).

### Mudar limites de reprodução

| Constante                   | Arquivo                    | Significado                                         |
| --------------------------- | -------------------------- | --------------------------------------------------- |
| `MAX_CROSSFADE_SECONDS`     | `PlaybackService.js`       | Máximo do controle de transição (também usado pela barra) |
| `LOAD_ALLOWANCE_SECONDS`    | `PlaybackService.js`       | Folga para o YouTube carregar a próxima faixa       |
| `RESTART_WITHIN_SECONDS`    | `PlaybackMemory.js`        | Abaixo disso, a faixa recomeça do zero              |
| `SAVE_DELAY_MS`             | `JsonPlaybackMemoryRepository.js` | Intervalo de gravação das posições           |
| `MAX_BODY_BYTES`            | `server/app.js`            | Tamanho máximo do `PUT /api/state`                  |

## Solução de problemas

| Sintoma                                              | Causa provável / solução                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| "A porta 5173 já está em uso"                        | O app já está aberto em outra janela. Feche-a ou use `PORT=5174`.                     |
| "Não consegui ler o arquivo de dados"                | O app foi aberto sem o servidor (por exemplo, abrindo o `index.html` direto) ou o JSON está corrompido. Nada é salvo nessa sessão; corrija e recarregue. |
| "Não consegui salvar no arquivo"                     | A janela do servidor foi fechada ou o disco está sem espaço ou sem permissão.         |
| Uma faixa é sempre pulada                            | O dono do vídeo desativou a incorporação. Não há solução pelo app.                    |
| Playlist não é adicionada                            | Ela é privada, é um mix automático ou o YouTube não respondeu em 15 s.                |
| Marcadores não aparecem                              | O vídeo não tem capítulos, ou o YouTube mudou o HTML (veja `server/chapters.js`).      |
| Fade "picotado"                                      | A aba está em segundo plano e o navegador limita os timers. Deixe a aba visível.      |
