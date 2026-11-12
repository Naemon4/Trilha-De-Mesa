# Como contribuir

Obrigado pelo interesse no Trilha de Mesa! O projeto é open source e feito para a comunidade de RPG de mesa. Toda ajuda conta: código, ideias, relatos de bugs, documentação ou só contar como você usa o app nas suas sessões.

## Relatando bugs e sugerindo ideias

Abra uma [issue](../../issues) e conte:

- o que você fez, o que esperava e o que aconteceu;
- sistema operacional, navegador e versão do Node.js (`node --version`);
- se possível, o link do vídeo ou da playlist do YouTube envolvido.

## Enviando código

1. Faça um fork e crie um branch a partir de `main`.
2. Rode o projeto com `npm start`. Não há dependências para instalar.
3. Faça a mudança seguindo as [convenções](docs/DESENVOLVIMENTO.md#convenções):
   - textos da interface e comentários em português, nomes de código em inglês;
   - respeite as camadas (`domain` e `application` não importam `infrastructure` nem `presentation`);
   - sem dependências externas, a não ser que haja um bom motivo discutido numa issue.
4. Adicione ou ajuste testes em `tests/` e confirme que `npm test` passa. O CI roda os mesmos testes no Node 18, 20 e 22, em Ubuntu e Windows. O código precisa continuar funcionando no Node 18.
5. Se mexeu na reprodução ou na interface, siga o [roteiro de teste manual](docs/DESENVOLVIMENTO.md#roteiro-de-teste-manual). O CI não roda no Mac: se mexeu em `Iniciar (Mac).command`, teste num Mac ou peça ajuda no pull request.
6. Abra o pull request explicando o que mudou e por quê.

## Antes de começar

- Leia a [arquitetura](docs/ARQUITETURA.md) para entender como as peças se encaixam.
- Para mudanças grandes, abra uma issue antes para conversarmos sobre a ideia.
- Nunca inclua o seu `data/trilha-de-mesa.json` no commit. Ele já está no `.gitignore`.

## Código de conduta

Seja gentil e respeitoso, como numa boa mesa de jogo. Críticas são ao código, nunca às pessoas.
