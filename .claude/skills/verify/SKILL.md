---
name: verify
description: Sobe o app Finanças e testa de ponta a ponta as funções principais, como um usuário. Use antes de commitar ou abrir PR, e sempre que precisar confirmar que uma mudança funciona de verdade.
---

# Verificar o app

Só diga que algo funciona depois de ver funcionando. Teste passando não substitui
olhar a mudança no app quando ela aparece na tela.

## 1. Rode as checagens

```bash
npm run checar
```

Isso roda, nesta ordem, e para na primeira falha: lint, tipos, testes, build do
site e os testes de ponta a ponta (`e2e/`).

Os testes de ponta a ponta sobem o app em `http://127.0.0.1:3210`, com um arquivo
de dados próprio (`.e2e/financas.json`) e a data fixa em 12/11/2026. Eles usam o
app como uma pessoa:

- abrem todas as telas, sem erro no console;
- conferem a regra do mês: contas e faturas em aberto de dezembro, gastos de novembro;
- lançam um gasto e uma compra no cartão, e conferem depois de recarregar;
- marcam uma fatura como paga;
- arrastam o menu;
- navegam no celular e conferem que nenhuma tela sobra para o lado;
- rodam a busca no banco contra uma Pluggy simulada.

Para repetir só esta parte: `npm run e2e`.
Em caso de falha, veja a captura e o rastro em `.e2e/resultados/`.

## 2. Olhe a sua mudança

Se a mudança aparece na tela e o fluxo ainda não tem teste, acrescente um em
`e2e/`. Para olhar de perto, rode
`npx playwright test --headed`.

## 3. Regras

- **Só dados inventados.** O repositório é público: nada de nomes, lojas, valores
  ou ids reais em testes, capturas, registros ou mensagens de commit. Nunca use
  `dados/`, `.financas/`, nem o site publicado com a chave de alguém para testar.
- **Três rodadas.** Se as checagens ainda falharem depois de 3 rodadas de conserto,
  pare e chame o dono do repositório com a falha, o que foi tentado e a hipótese atual.
- **Teste instável.** Nunca pule, repita nem acrescente espera. Ache a causa. Se não
  achar, remova o teste e registre o motivo em `docs/testes-removidos.md`.
- **Relate o que aconteceu.** Diga o que passou, o que falhou e o que não foi testado.
