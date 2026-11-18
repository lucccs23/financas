# Regras de revisão

Quem revisa lê este arquivo do `main` (`git show origin/main:REVIEW.md`), nunca da
versão do PR. Registre o commit revisado: se o branch mudar, a revisão perde a validade.

Classifique cada achado como **Importante**, **Detalhe** ou **Já existia**. Diga o
cenário concreto que quebra.

## Sempre importante

- **Dados pessoais:** nomes, lojas, valores, ids, capturas ou registros reais no diff.
  O repositório é público. `dados/` e `.financas/` nunca entram.
- **Dinheiro:** valores em centavos inteiros, sem perder ou criar centavo.
- **Faturas:** cada compra na fatura certa; estorno abate; pagamento quita a fatura
  anterior e não reduz a atual; saldo não pago passa para a seguinte; compra em outra
  moeda entra em reais.
- **Regra do mês:** no mês de hoje, contas e faturas mostram o que está em aberto;
  gastos e transações ficam no mês atual.
- **Privacidade entre perfis:** ninguém recebe dados pessoais de outro perfil.
- **Gravação:** nada de perder alteração de outro aparelho nem de gravar arquivo pela metade.
- **Segredos:** chaves só nos segredos do GitHub, nunca no site, em registros ou no repositório.

## CI

- Código de PR nunca roda com segredos nem com token de escrita.
- `pull_request_target` nunca faz checkout nem executa conteúdo do PR.
- O fluxo de PR não usa cache compartilhado nem publica artefatos.
- Ações externas ficam fixadas por commit.

## Testes

- Mudança de comportamento vem com teste que falharia sem ela.
- Não aceite teste pulado, repetição automática ou espera fixa.
- Teste removido precisa de motivo em `docs/testes-removidos.md`.
