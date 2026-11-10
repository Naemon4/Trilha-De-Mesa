# API HTTP e formato de dados

O servidor local (`server.js` → `server/app.js`) expõe duas rotas de API, além dos arquivos estáticos de `public/`. Todas as respostas de API usam `Cache-Control: no-store`.

As rotas `/api/*` só respondem quando o cabeçalho `Host` é local (`localhost`, `127.0.0.1` ou `[::1]`, com qualquer porta). Caso contrário, devolvem `403`. Essa checagem é desligada quando o servidor roda com `HOST` diferente de loopback.

## `GET /api/state`

Devolve o conteúdo do arquivo de dados.

| Status | Quando                                            |
| ------ | ------------------------------------------------- |
| 200    | Corpo JSON. Se o arquivo ainda não existe: `{}`.  |
| 500    | Erro ao ler o arquivo (permissão, disco etc.)     |

## `PUT /api/state`

Substitui o arquivo inteiro pelo corpo enviado. O cliente sempre envia o documento completo, não um trecho.

- Cabeçalho obrigatório: `Content-Type: application/json`
- Corpo: um **objeto** JSON (listas e valores soltos são recusados), de até 5 MB

| Status | Quando                                         |
| ------ | ---------------------------------------------- |
| 204    | Gravado com sucesso                            |
| 400    | JSON inválido ou não é um objeto               |
| 413    | Corpo maior que 5 MB                           |
| 415    | `Content-Type` diferente de `application/json` |
| 500    | Falha ao gravar no disco                       |

As gravações são feitas uma de cada vez, na ordem de chegada, escrevendo em `<arquivo>.tmp` e depois renomeando. Se uma falhar, as seguintes continuam funcionando.

Exemplo:

```bash
curl -X PUT http://localhost:5173/api/state \
  -H "Content-Type: application/json" \
  -d '{"themes":[],"settings":{"volume":0.8,"crossfadeSeconds":4},"playback":{}}'
```

## `GET /api/chapters?v=<videoId>`

Busca os capítulos (marcadores) de um vídeo do YouTube.

```json
{ "chapters": [ { "title": "Abertura", "start": 0 }, { "title": "Chefe", "start": 95 } ] }
```

- `start` é em segundos inteiros, em ordem crescente e sem repetição.
- Primeiro usa os capítulos oficiais do vídeo. Se houver menos de 2, procura linhas da descrição que comecem com um tempo (`1:30 Floresta`, `[01:02:03] - Chefe`).
- Uma lista vazia significa "o vídeo não tem marcadores".
- Os resultados ficam em cache na memória do servidor (até 500 vídeos).

| Status | Quando                                                        |
| ------ | ------------------------------------------------------------- |
| 200    | Sucesso (a lista pode estar vazia)                            |
| 400    | `v` não é um ID de vídeo válido (11 caracteres `[A-Za-z0-9_-]`) |
| 502    | O YouTube não respondeu, deu erro ou demorou mais de 10 s     |

## Arquivo de dados

Por padrão fica em `data/trilha-de-mesa.json`. Dá para mudar o local com a variável `DATA_FILE`. A pasta `data/` está no `.gitignore`.

```jsonc
{
  "themes": [
    {
      "id": "mw6yvjx8izgado",          // gerado: timestamp base36 + aleatório
      "name": "HEXATOMBE",             // 1 a 60 caracteres
      "kind": "playlist",              // "video" ou "playlist"
      "tracks": [
        { "videoId": "9LeseDaEyzI", "title": "Abertura (Hexatombe)" }
      ],
      "createdAt": 1793409318448       // ms desde a época Unix
    }
  ],
  "settings": {
    "volume": 0.8,                     // 0 a 1
    "crossfadeSeconds": 4              // 0 a 12
  },
  "playback": {
    "<themeId>": {
      "trackIndex": 0,                 // última faixa tocada
      "positions": { "0": 564 },       // segundo em que cada faixa parou
      "loops": {                       // só faixas com loop diferente do padrão
        "0": { "type": "section", "start": 351, "end": null, "label": "Malevolent Shrine" }
      }
    }
  }
}
```

Observações:

- A ordem de `themes` é a ordem dos cartões na tela e define os atalhos `1` a `9`.
- As chaves de `positions` e `loops` são o índice da faixa dentro do tema.
- `loops[i].type` pode ser `"track"` ou `"section"`. Em `"section"`, `end: null` significa "até o fim da faixa".
- O arquivo pode ser editado à mão com o servidor desligado. Valores inválidos de loop são ignorados ao carregar (`normalizeLoop`), e entradas de temas que não existem mais são removidas de `playback` na inicialização.
- **Backup:** basta copiar o arquivo. Para levar para outro computador, coloque a cópia na pasta `data/` do projeto de lá.
