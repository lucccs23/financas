# Proteger o branch `main`

Faça isto **depois** do merge do PR que cria os workflows `CI` e `Guarda das checagens`.
São configurações de segurança da conta: quem aplica é o dono do repositório.

```bash
gh api --method POST repos/lucccs23/financas/rulesets --input .github/rulesets/main.json
```

```bash
gh api --method PUT repos/lucccs23/financas/actions/permissions/fork-pr-contributor-approval -f approval_policy=all_external_contributors
```

## O que passa a valer

- Mudança no `main` só por PR, com as checagens `checar` e `guarda` passando e o branch atualizado.
- Ninguém reescreve nem apaga o `main`.
- Todo PR de pessoa de fora precisa de aprovação antes de rodar no GitHub Actions.
- Não há exigência de aprovação de outra pessoa: o GitHub não deixa aprovar o próprio PR.

## Mudar uma checagem

O `guarda` reprova PRs que mexem em workflows, regras, `verify`, testes de ponta a
ponta e configurações das checagens. Revise o PR. Se concordar, use a opção de
administrador na tela de merge. Só o administrador consegue fazer isso.

## Público ou privado

Este repositório é público, e a proteção é gratuita. No plano gratuito, um repositório
privado não tem proteção de branch aplicada: é o caso do repositório dos dados.
