# Trilha de Mesa

Player local de temas de batalha para RPG de mesa. Você cola links do YouTube, cada link vira um tema, e a música toca em loop com transição suave (crossfade) ao trocar de tema ou de faixa.

## Propósito

O Trilha de Mesa quer ser um player de música universal para RPG de mesa: um só lugar para organizar e tocar a trilha sonora de qualquer sistema, cenário ou campanha, seja ela de fantasia, terror, ficção científica ou qualquer outra coisa.

O projeto é open source e gratuito. A ideia é melhorar a experiência de quem joga sem gastar nada, com um recurso que normalmente só existe em ferramentas pagas: a música certa para cada momento da sessão, com troca suave entre as faixas e sem cortes no meio da cena. Não precisa de conta, assinatura nem chave de API, e seus dados ficam no seu computador.

Contribuições são bem-vindas, seja código, ideias ou relatos de bugs. Veja [como contribuir](CONTRIBUTING.md).

## Como rodar

Duplo clique em **Iniciar (Windows).bat**, **Iniciar (Mac).command** ou **Iniciar (Linux).sh**. O servidor liga e o navegador abre sozinho. No Mac, se o sistema bloquear o arquivo, clique com o botão direito, escolha Abrir e confirme.

Requer Node.js 18 ou mais novo e internet (o áudio vem do YouTube). Não há dependências para instalar.

Ou pelo terminal:

```bash
npm start
```

Abra http://localhost:5173 no navegador. Por segurança, o app só aceita conexões deste computador. Porta, endereço e local do arquivo de dados podem ser mudados por variáveis de ambiente (veja o [guia de desenvolvimento](docs/DESENVOLVIMENTO.md#variáveis-de-ambiente)).

Seus temas, volume, tempo de transição e o ponto em que cada música parou ficam salvos em `data/trilha-de-mesa.json`, dentro da pasta do projeto. Para fazer backup ou levar para outro computador, copie esse arquivo. Se você usava a versão anterior (que salvava no navegador), os temas antigos são copiados para o arquivo automaticamente na primeira vez.

## Como usar

1. Cole o link de um vídeo ou de uma playlist e clique em **Adicionar tema**. O nome é opcional.
2. Clique na capa do cartão para tocar. Clique de novo para pausar.
3. Em playlists, use **Faixas** para ver a lista e tocar qualquer uma.
4. Ao voltar para um tema, ele retoma na faixa e no segundo em que parou, mesmo depois de fechar o app. Trocar de faixa pelos botões ou pelo avanço automático sempre começa do início. Se faltavam menos de 20 segundos para acabar, a faixa recomeça do zero.
5. Clique em **Loop** na barra de baixo (ou aperte `L`) para escolher como a faixa atual se repete:
   - **Seguir a playlist**: o comportamento normal. Em vídeo único aparece como **Faixa toda** e repete o vídeo inteiro.
   - **Repetir esta faixa** (só em playlists): fica na mesma faixa até você mudar. Os botões de próxima e anterior continuam funcionando.
   - **Trechos**: se o vídeo tem marcadores (capítulos) no YouTube, cada um aparece na lista. Escolha um e só aquele trecho fica em loop, voltando ao início dele com a mesma transição suave.
   
   O loop escolhido fica salvo por faixa. A faixa com trecho sempre começa pelo trecho.
6. Ajuste **Volume** e **Transição** (0 a 12 s) na barra de baixo. Os valores ficam salvos.

Atalhos: `Espaço` pausa, `1` a `9` toca o tema, `N` próxima faixa, `P` faixa anterior, `L` loop da faixa.

## Como funciona

- **Loop:** faixa única repete a si mesma. Playlist toca em ordem e recomeça no fim.
- **Transição:** dois players do YouTube trabalham em revezamento. O novo sobe enquanto o atual desce (curva de potência igual, para o volume não "pular").
- **Faixa indisponível:** se o dono do vídeo bloqueou a reprodução fora do YouTube, o app avisa e pula para a próxima.
- **Link com vídeo e playlist juntos** (`watch?v=...&list=...`): vale a playlist. Mixes automáticos (`list=RD...`) tocam só o vídeo.
- **Marcadores:** o player do YouTube não informa capítulos, então o servidor local lê a página pública do vídeo (capítulos oficiais ou os tempos escritos na descrição, como `1:30 Floresta`). Se o vídeo não tiver marcadores, o painel avisa. Se o YouTube mudar o formato da página, essa busca pode parar de achar marcadores.
- **Salvamento:** o navegador envia as mudanças ao servidor local, que grava o JSON de forma segura (arquivo temporário e troca). A posição é gravada a cada poucos segundos. Mantenha a janela do servidor aberta enquanto usa. Se o app não conseguir ler o arquivo ao abrir, ele não grava nada naquela sessão, para não apagar seus temas.
- **Dica:** deixe a aba aberta no navegador. Se ela ficar em segundo plano, o navegador pode deixar o fade menos suave.

## Arquitetura (Clean Architecture)

As dependências apontam sempre para dentro: presentation e infrastructure conhecem a aplicação, mas a aplicação e o domínio não conhecem ninguém.

```
server.js           Inicializa o servidor local (porta, host, arquivo de dados)
server/app.js       Rotas: arquivos estáticos e API do JSON
server/chapters.js  Leitura de marcadores da página do YouTube
public/src
  domain/          Regras puras: YouTubeLink, Theme, Loop, erros
  application/     Casos de uso: ThemeLibrary, PlaybackService, PlaybackMemory, ChapterCatalog
                   ports.js define os contratos (AudioEngine, repositórios, gateways)
  infrastructure/  Detalhes: player do YouTube, crossfade, oEmbed, arquivo JSON
  presentation/    Interface: App (controlador), componentes, helpers de DOM
  main.js          Raiz de composição: monta tudo e injeta as dependências
```

Para trocar uma peça, basta implementar a porta correspondente. Exemplo: guardar os temas em um banco de dados em vez do arquivo JSON.

## Documentação

- [Arquitetura](docs/ARQUITETURA.md): camadas, fluxo de reprodução, crossfade, persistência, segurança e limitações
- [API e formato de dados](docs/API.md): rotas HTTP e estrutura do `trilha-de-mesa.json`
- [Guia de desenvolvimento](docs/DESENVOLVIMENTO.md): configuração, testes, convenções, receitas e solução de problemas

## Testes

```bash
npm test
```

Cobrem o parser de links, o catálogo de temas, a memória de posição, a leitura de marcadores, a lógica de reprodução (avanço, loops, retomada, falhas), o servidor (API, gravação, segurança) e o salvamento no navegador, sem precisar de navegador.

## Contribuindo

Veja o [guia de contribuição](CONTRIBUTING.md). Bugs e ideias podem ser enviados pelas issues do repositório.

## Licença

[MIT](LICENSE). Use, modifique e distribua à vontade, inclusive na sua mesa.

As músicas tocadas pertencem aos seus autores e vêm do YouTube. O Trilha de Mesa não baixa nem redistribui áudio: ele só usa o player oficial incorporado do YouTube.
