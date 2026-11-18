@AGENTS.md

# Como trabalhar neste repositório

Fale em português. O repositório é público: nunca coloque nomes, lojas, valores,
ids ou outros dados reais em código, testes, capturas, registros, commits ou PRs.

## Fluxo

1. Trabalhe em um branch e entregue por PR. Nunca envie direto para o `main`.
2. Antes de abrir PR, use a skill `verify` e rode `npm run checar` (lint, tipos,
   testes, builds e ponta a ponta). Uma trava impede `gh pr create` se falhar.
3. O merge é do dono do repositório. Não faça merge nem use permissão de administrador.

## Quando algo falha

- Depois de **3 rodadas de conserto sem sucesso**, pare e chame o dono do repositório
  com a falha, o que foi tentado e a hipótese atual.
- **Teste instável:** nunca pule, repita nem acrescente espera. Ache a causa. Se não
  achar, remova o teste e registre o motivo em `docs/testes-removidos.md`.

## Checagens não se editam

As regras de revisão valem pela versão do `main`: leia com
`git show origin/main:REVIEW.md`, não a cópia do seu branch. Uma mudança não pode
afrouxar as próprias checagens. O workflow `guarda` reprova PRs que mexem nelas, e
só o dono do repositório decide se esse tipo de mudança entra.

Uma revisão vale só para o commit revisado: se o branch mudar, revise de novo.
