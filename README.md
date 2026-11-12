# Trilha de Mesa

Player local de temas de batalha para RPG de mesa. Você cola links do YouTube, cada link vira um tema, e a música toca em loop com transição suave (crossfade) ao trocar de tema ou de faixa.

## Propósito

O Trilha de Mesa quer ser um player de música universal para RPG de mesa: um só lugar para organizar e tocar a trilha sonora de qualquer sistema, cenário ou campanha, seja ela de fantasia, terror, ficção científica ou qualquer outra coisa.

O projeto é open source e gratuito. A ideia é melhorar a experiência de quem joga sem gastar nada, com um recurso que normalmente só existe em ferramentas pagas: a música certa para cada momento da sessão, com troca suave entre as faixas e sem cortes no meio da cena. Não precisa de conta, assinatura nem chave de API, e seus dados ficam no seu computador.

Contribuições são bem-vindas, seja código, ideias ou relatos de bugs. Veja [como contribuir](CONTRIBUTING.md).

## Instalação

1. **Instale o Node.js.** Baixe a versão **LTS** em [nodejs.org](https://nodejs.org) e instale normalmente. Qualquer versão a partir da 18 funciona. Só precisa fazer isso uma vez.
2. **Baixe o Trilha de Mesa.** Nesta página do GitHub, clique no botão verde **Code** e depois em **Download ZIP**. Extraia o arquivo numa pasta que você vá manter, por exemplo em Documentos.

Não há mais nada para instalar. O app precisa de internet enquanto toca, porque o áudio vem do YouTube.

## Como abrir

Dentro da pasta, dê dois cliques no arquivo do seu sistema:

- **Windows:** `Iniciar (Windows).bat`
- **Mac:** `Iniciar (Mac).command`. Se o sistema bloquear o arquivo, clique com o botão direito, escolha **Abrir** e confirme.
- **Linux:** `Iniciar (Linux).sh`. Se ele abrir num editor de texto, clique com o botão direito e escolha **Executar como programa**, ou rode `./"Iniciar (Linux).sh"` no terminal, dentro da pasta.

Uma janela preta (o servidor) se abre e o navegador abre o app sozinho em http://localhost:5173. **Deixe a janela preta aberta enquanto usa o app.** Para encerrar, feche essa janela.

Por segurança, o app só aceita conexões do próprio computador.

## Seus dados

Seus temas, o volume, o tempo de transição e o ponto em que cada música parou ficam salvos no arquivo `data/trilha-de-mesa.json`, dentro da pasta do app.

- **Backup:** copie esse arquivo.
- **Outro computador:** instale o app lá e coloque a cópia na pasta `data/` dele.
- **Atualizar para uma versão nova:** baixe o ZIP novo e extraia. Antes de apagar a pasta antiga, **copie a pasta `data/` dela para a pasta nova**. Sem isso, a versão nova abre sem os seus temas.

Se você usava a primeira versão do app, que salvava os temas no navegador, eles são copiados para o arquivo automaticamente na primeira vez que você abre a versão nova.

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
- **Transição:** dois players do YouTube trabalham em revezamento. O novo sobe enquanto o atual desce, de um jeito que o volume não "afunda" no meio da troca.
- **Faixa indisponível:** se o dono do vídeo bloqueou a reprodução fora do YouTube, o app avisa e pula para a próxima.
- **Link com vídeo e playlist juntos** (`watch?v=...&list=...`): vale a playlist. Mixes automáticos do YouTube (`list=RD...`) tocam só o vídeo.
- **Marcadores:** o app lê a página pública do vídeo para achar os capítulos oficiais ou os tempos escritos na descrição (como `1:30 Floresta`). Se o vídeo não tiver marcadores, o painel avisa.
- **Salvamento:** as mudanças vão para o arquivo de dados poucos segundos depois de acontecerem. Se o app não conseguir ler o arquivo ao abrir, ele não grava nada naquela sessão, para não apagar seus temas.

## Problemas comuns

| O que acontece                                       | Causa provável e solução                                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| "O Node.js não foi encontrado"                       | O Node.js não está instalado. Veja a [instalação](#instalação).                          |
| "A porta 5173 já está em uso"                        | O app já está aberto em outra janela preta. Use essa ou feche-a antes de abrir de novo.  |
| "Não consegui ler o arquivo de dados"                | A janela preta foi fechada, o app foi aberto pelo `index.html` direto ou o arquivo de dados está corrompido. Nada é salvo nessa sessão: abra pelo arquivo **Iniciar** (ou restaure o backup) e recarregue a página. |
| "Não consegui salvar no arquivo"                     | A janela preta foi fechada, ou o disco está cheio ou sem permissão. Abra de novo pelo arquivo **Iniciar**. |
| Uma faixa é sempre pulada                            | O dono do vídeo desativou a reprodução fora do YouTube. Não há como contornar pelo app.  |
| Playlist não é adicionada                            | Ela é privada, é um mix automático ou o YouTube demorou mais de 15 s para responder.     |
| Marcadores não aparecem                              | O vídeo não tem capítulos, ou o YouTube mudou a página e a leitura parou de funcionar. Se for o segundo caso, [abra uma issue](https://github.com/Naemon4/Trilha-De-Mesa/issues). |
| A transição fica "picotada"                          | A aba do app está em segundo plano e o navegador desacelera o fade. Deixe a aba visível. |

Não achou o seu problema? [Relate um bug](https://github.com/Naemon4/Trilha-De-Mesa/issues/new/choose).

## Para desenvolvedores

```bash
npm start   # http://localhost:5173 (sem npm install: não há dependências)
npm test    # testes com o runner nativo do Node, sem navegador
```

O código segue Clean Architecture, em JavaScript puro, sem framework e sem etapa de build.

- [Arquitetura](docs/ARQUITETURA.md): camadas, fluxo de reprodução, crossfade, persistência, segurança e limitações
- [API e formato de dados](docs/API.md): rotas HTTP e estrutura do `trilha-de-mesa.json`
- [Guia de desenvolvimento](docs/DESENVOLVIMENTO.md): variáveis de ambiente, testes, convenções, receitas e roteiro de teste manual
- [Como contribuir](CONTRIBUTING.md)

## Licença

[MIT](LICENSE). Use, modifique e distribua à vontade, inclusive na sua mesa.

As músicas tocadas pertencem aos seus autores e vêm do YouTube. O Trilha de Mesa não baixa nem redistribui áudio: ele só usa o player oficial incorporado do YouTube.
