# Finanças

Controle de finanças para quem divide a casa. Cada pessoa tem o seu perfil, com
renda e contas próprias, e a casa junta as contas que todos dividem.

## Abrir o app

Dê dois cliques no atalho **Finanças** da Área de Trabalho (também está no Menu
Iniciar). O app abre em uma janela própria do Chrome.

- Na primeira vez, e sempre que o código mudar, ele leva uns 30 segundos para
  se preparar e avisa no canto da tela.
- Depois disso, abre na hora: o servidor fica ligado em segundo plano até você
  desligar o computador.
- Para desligar o servidor antes disso, use **Desligar Finanças**, dentro da
  pasta do projeto.
- O atalho usa a porta 3000. Se aparecer um aviso de porta ocupada, feche o
  outro programa (por exemplo, um `npm run dev` aberto) e tente de novo.

Os atalhos chamam [scripts/abrir.ps1](scripts/abrir.ps1) e
[scripts/fechar.ps1](scripts/fechar.ps1). Se algo falhar, os detalhes ficam em
`.financas/servidor.log.erro`.

## Rodar pelo terminal (para quem mexe no código)

Precisa do Node.js instalado. Na pasta do projeto:

```bash
npm install
```

```bash
npm run dev
```

Abra `http://localhost:3000`. Para os testes do motor de cálculo:

```bash
npm test
```

## Onde ficam os dados

| Modo | Onde ficam os dados | Para que serve |
|---|---|---|
| **Computador** (padrão) | No arquivo `dados/financas.json`, dentro desta pasta | Usar em casa: no computador e nos celulares ligados ao mesmo Wi-Fi |
| **GitHub** (site online) | No arquivo `financas.json` de um repositório privado do GitHub | Usar de qualquer lugar pelo site no GitHub Pages, sem o computador ligado |
| **Nuvem** | No Supabase, com login por e-mail e senha | O mesmo, com login por e-mail |

O app do computador usa o modo computador; o site online usa o modo GitHub (ou
o Supabase, se receber as chaves dele). Os modos não se misturam: para levar os
dados de um para o outro, use **Baixar cópia** e **Restaurar cópia**.

No modo computador:

- **Cópias automáticas:** antes da primeira alteração de cada dia, o app guarda
  uma cópia em `dados/copias` (mantém os últimos 30 dias). Para voltar a um dia,
  use **Minha renda > Restaurar cópia** com um desses arquivos.
- **Cópia fora do computador:** em **Minha renda > Baixar cópia**. Vale guardar
  uma de vez em quando num pendrive ou e-mail, caso o computador estrague.
- **Celular:** em **Minha renda > Abrir no celular** aparece o endereço (algo
  como `192.168.0.10:3000`). O computador precisa estar ligado com o app aberto.
  Se o celular não abrir, permita o Node.js no Firewall do Windows em redes
  privadas.
- **Privacidade:** cada pessoa escolhe o próprio perfil sem senha. Quem está no
  Wi-Fi de casa consegue abrir qualquer perfil. Pensado para família.
- **Versões antigas:** quem usava o app antes desta versão tinha os dados só no
  navegador. Ao abrir, eles são levados para o arquivo automaticamente.

## O que o app faz

- **Visão geral:** saldo previsto, contas a pagar, quanto ainda pode gastar no
  dia a dia (com o ritmo do mês e dicas), distribuição dos gastos, divisão da
  casa, cartões, moradia, transações recentes, resultado do mês e reserva.
- **Transações:** gastos e entradas do dia a dia (lanche, Uber, Pix recebido),
  com busca, filtros, visão por categoria, **importação do extrato** em CSV e
  exportação para planilha.
- **Carteiras:** conta do banco, poupança, dinheiro e investimentos, com saldo
  que acompanha as transações, transferências e o **patrimônio** (o que você tem
  menos o que deve no cartão).
- **Contas:** contas fixas e únicas, valor real de cada mês, mudanças que valem
  "a partir deste mês" sem mexer no passado, e os compromissos dos próximos 6
  meses (contas fixas e parcelas).
- **Casa:** moradores com peso na divisão, quem pagou o quê e o menor número de
  Pix para acertar.
- **Cartões:** faturas, parcelas, assinaturas e como cada fatura é formada.
  - **Limite:** informe o limite total e o disponível que o app do banco mostra;
    daí em diante, cada compra lançada diminui o disponível e cada fatura paga
    devolve (botão **Conferir limite**).
  - **Importar fatura** em **PDF** ou **CSV**: o app reconhece data, descrição,
    valor e parcelas ("3/10"), sugere a categoria, desmarca compras já lançadas e
    confere a soma com o total escrito no PDF. PDFs com senha pedem a senha na
    hora. O arquivo é lido no próprio aparelho, sem ser enviado.
  - Com muitos cartões, **puxe a faixa com o mouse** (ou use as setas) para ver
    os que ficaram fora da tela.
- **Fluxo de caixa:** 12 meses de entradas e saídas, e para onde foi o dinheiro,
  por categoria, comparando com o mês anterior.
- **Reserva:** metas suas e da casa. Uma conta como "Guardar na reserva" pode
  ser ligada a uma meta: marcar a conta como paga já guarda o valor.
- **Minha renda:** salário e dia a dia com histórico (um aumento vale a partir do
  mês escolhido), cópias de segurança e o endereço para abrir no celular.
- **Fotos:** cada cartão pode ter a foto do cartão ou uma cor com o logo do
  banco. Em **Aparência**, dá para trocar as ilustrações dos painéis. Evite
  fotos que mostrem o número do cartão.
- **Aparência:** tema claro, escuro ou automático, seis cores de destaque e texto
  maior. Vale para cada aparelho.
- **Busca (Ctrl+K)** em telas, contas, transações, compras, cartões e metas, e o
  botão do **olho**, que esconde os valores da tela.

## Ligar ao Supabase (modo nuvem)

> O SQL foi testado num Postgres de teste com as mesmas regras do Supabase
> (cadastro com código, quem vê o quê, entrar e sair da casa), mas ainda não
> num projeto Supabase de verdade.

1. Crie uma conta gratuita em [supabase.com](https://supabase.com) e um projeto novo.
2. Abra o arquivo [supabase/schema.sql](supabase/schema.sql) e troque
   `TROQUE-ESTE-CODIGO` por um código seu. Só cria conta no app quem souber esse código.
3. No painel do Supabase, vá em **SQL Editor > New query**, cole o arquivo inteiro e clique em **Run**.
4. Em **Project Settings > API**, copie a URL do projeto e a chave pública
   (aparece como `anon` ou `publishable`). Crie na raiz do projeto um arquivo
   chamado `.env.local` com:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-publica
   ```

5. Opcional, mas deixa o cadastro mais simples: em **Authentication > Sign In /
   Providers > Email**, desligue **Confirm email**. Sem isso, cada pessoa precisa
   clicar em um link enviado por e-mail antes do primeiro acesso.
6. Pare o `npm run dev` e rode de novo. A tela de entrada passa a pedir e-mail e senha.

Nunca use a chave `service_role` no app: ela ignora todas as regras de acesso.

### Como a casa funciona

1. A primeira pessoa cria o perfil, vai em **Casa** e cria a casa.
2. Ela cadastra os moradores pelo nome. Quem não usa o app também entra na divisão.
3. Ela passa o código da casa (seis caracteres, na tela Casa) para os outros.
4. Cada pessoa cria a própria conta, vai em **Casa > Tenho um código** e escolhe
   qual morador ela é.

### O que cada um enxerga

- **Só você:** salário, orçamento do dia a dia, contas pessoais, cartões, metas
  pessoais, carteiras e transações.
- **A casa toda:** moradores, contas da casa, acertos, metas da casa e os cartões
  que o dono marcou como "cartão da casa".
- **Salário:** só aparece para a casa se você ligar a opção em **Minha renda**.

Qualquer morador pode editar as contas da casa e os moradores. O app foi pensado
para pessoas que confiam umas nas outras.

## Publicar online (GitHub Pages)

Para usar de qualquer lugar, pelo celular, sem o computador ligado. Tudo fica no
GitHub, em **dois repositórios**:

- **o do site** (público, porque o GitHub Pages gratuito exige): só o código do
  app. Nada da pasta `dados` vai para lá;
- **o dos dados** (privado): um arquivo `financas.json` com os dados de vocês.
  Cada mudança vira uma versão no histórico, o que também serve de cópia.

Cada aparelho se conecta ao repositório dos dados com uma **chave de acesso**,
informada uma vez. Quem tem a chave vê e muda tudo, então só passe para quem usa
o app.

1. **Repositório dos dados:** no GitHub, crie um repositório **privado** (por
   exemplo `financas-dados`). Pode ser vazio.
2. **Chave de acesso:** em **Settings > Developer settings > Personal access
   tokens > Fine-grained tokens > Generate new token**:
   - **Repository access:** *Only select repositories* e escolha só o dos dados;
   - **Permissions > Repository permissions > Contents:** *Read and write*;
   - escolha a validade (dá para renovar depois) e gere. Copie a chave na hora:
     o GitHub só mostra uma vez.
3. **Repositório do site:** crie um repositório **público** (por exemplo
   `financas`) e envie o projeto para ele.
4. Em **Settings > Pages**, em **Source**, escolha **GitHub Actions**.
5. Opcional: em **Settings > Secrets and variables > Actions > Variables**, crie
   `DADOS_REPO` com `seu-usuario/financas-dados`, para o nome já vir preenchido.
6. A cada envio para a branch `main`, o GitHub gera e publica o site sozinho
   (arquivo [.github/workflows/publicar.yml](.github/workflows/publicar.yml)).
   Acompanhe em **Actions**. O endereço fica
   `https://SEU-USUARIO.github.io/financas/`.
7. Em cada aparelho, abra o endereço, informe o repositório dos dados e cole a
   chave. No celular, use **Adicionar à tela inicial** para abrir como um app.

**Levar os dados do computador:** no app do computador, em **Minha renda**, use
**Baixar cópia**. No site, depois de conectar, crie um perfil qualquer, vá em
**Minha renda > Restaurar cópia** e escolha o arquivo. Os perfis do computador
aparecem para escolher.

Se a chave vencer ou um aparelho for perdido, apague a chave no GitHub, gere
outra e conecte de novo (**Minha renda > Desconectar este aparelho**).

Para testar a versão online no computador antes:

```bash
GITHUB_PAGES=1 NEXT_PUBLIC_BASE_PATH=/financas npx next build
```

O resultado fica na pasta `.next-online`.

**Alternativa com Supabase:** criando também as variáveis `SUPABASE_URL` e
`SUPABASE_ANON_KEY` (veja "Ligar ao Supabase" acima), o site usa o Supabase,
com login por e-mail, em vez do repositório dos dados. Em **Authentication >
URL Configuration**, coloque o endereço do site em **Site URL**.

## Open Finance (bancos automáticos, pelo Meu Pluggy)

Com o site no GitHub, o app pode buscar sozinho as contas, cartões e
movimentações dos bancos, pelo Open Finance oficial. Usa o **Meu Pluggy**,
gratuito para uso pessoal.

**Como funciona:** uma tarefa automática no repositório **privado** dos dados
([scripts/open-finance/buscar-no-banco.yml](scripts/open-finance/buscar-no-banco.yml))
roda às 7h, 13h e 19h e também pelo botão **Buscar agora**, em Carteiras. Ela
pega na Pluggy o que mudou nos últimos 90 dias e grava no `financas.json`. A
chave secreta da Pluggy fica só nos segredos desse repositório, nunca no site.

**O que entra no app:**

- Cada conta do banco vira uma **carteira**, com o saldo igual ao do banco.
- Cada cartão vira um **cartão**, com limite, fechamento e vencimento do banco,
  e o limite livre igual ao do app do banco.
- Extrato vira **Transações**. No cartão, cada lançamento do banco (inclusive
  cada parcela, como "Loja · parcela 3/10") entra na fatura que o banco indica,
  e as compras ainda pendentes da fatura aberta também entram: a fatura do app
  soma o mesmo que o banco manda. Compra cancelada no banco sai do app.
- O que acabou de acontecer pode levar até um dia para chegar: o Meu Pluggy
  atualiza os bancos uma vez por dia. Saldo de fatura anterior paga em parte não
  aparece como lançamento.
- Nada entra duas vezes. O que você já tinha lançado à mão é reconhecido (mesmo
  valor, data próxima) e ligado ao banco em vez de repetido.
- O que já conta em outro lugar entra como **só saldo** (fica no extrato e no
  saldo, mas fora do resumo do mês): pagamento de fatura, dinheiro entre contas
  suas, aplicações, salário já cadastrado em Minha renda e contas fixas de mesmo
  valor (que ficam marcadas como pagas).
- O que veio do banco não pode ser excluído (voltaria na próxima busca). Para
  não contar no mês, use **Tirar do resumo**.

**Configurar (uma vez):**

1. Em **meu.pluggy.ai**, conecte os bancos.
2. Em **dashboard.pluggy.ai**, crie a conta de desenvolvedor, inclua o conector
   **MeuPluggy** na lista de conectores e crie uma **Development Application**.
   Anote o **Client ID** e o **Client Secret**.
3. Na aplicação **Demo** do painel, conecte o **MeuPluggy** uma vez para cada
   banco. Cada conexão tem um **id** (o *item id*): anote todos.
4. No repositório dos dados, em **Settings > Secrets and variables > Actions**:
   - **Secrets:** `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET`;
   - **Variables:** `PLUGGY_CONEXOES`, uma conexão por linha, no formato
     `id-da-conexao = Nome do perfil no app`.
5. Para o botão **Buscar agora**, a chave de acesso do app precisa também da
   permissão **Actions: Read and write** (edite a chave no GitHub).

Para conectar os bancos de outra pessoa da casa, ela faz os passos 1 e 3 na
conta dela do Meu Pluggy, autorizando a mesma aplicação, e você acrescenta as
conexões dela em `PLUGGY_CONEXOES` com o nome do perfil dela.

> O painel de desenvolvedor da Pluggy começa com 15 dias de teste. Pela
> documentação do Meu Pluggy, a busca continua funcionando depois disso; se a
> Pluggy mudar essa condição, só a busca automática para, o resto do app segue
> igual.

## Como as contas são feitas

- **Saldo previsto** = renda − sua parte da casa − contas pessoais − dia a dia.
- **Sua parte da casa** = cada conta dividida pelos pesos dos moradores. Peso 1
  para todos divide por igual; uma conta pode ter participantes próprios.
- **Acerto** = o que cada um pagou do bolso − a parte justa dele. O app sugere o
  menor número de Pix que zera todo mundo.
- **Fatura do cartão** = soma das parcelas que caem naquele mês. A fatura entra
  nas contas a pagar sozinha.
- **Moradia** = sua parte nas contas marcadas como "gasto de moradia", comparada
  com o salário (referência: até 30%).

## Onde mexer

| Quero mudar | Arquivo |
|---|---|
| Nome e logo do app | [src/components/marca.tsx](src/components/marca.tsx) |
| Cores, tema claro e escuro | [src/app/globals.css](src/app/globals.css) |
| Categorias e ícones das contas | [src/lib/categorias.ts](src/lib/categorias.ts) |
| Fórmulas | [src/lib/calc.ts](src/lib/calc.ts), com testes em [src/lib/calc.test.ts](src/lib/calc.test.ts) |
| Leitura do CSV da fatura e palavras que sugerem categorias | [src/lib/importar.ts](src/lib/importar.ts), [src/lib/categorias.ts](src/lib/categorias.ts) |
| Arquivo de dados e cópias diárias | [src/lib/servidor/arquivo.ts](src/lib/servidor/arquivo.ts) |
| Dados no repositório do GitHub | [src/lib/dados/github.ts](src/lib/dados/github.ts) |
| Open Finance: regras de importação | [src/lib/open-finance.ts](src/lib/open-finance.ts), com testes em [src/lib/open-finance.test.ts](src/lib/open-finance.test.ts) |
| Open Finance: busca na Pluggy | [scripts/buscar-no-banco.ts](scripts/buscar-no-banco.ts) |
| Dados de exemplo | [src/lib/exemplo.ts](src/lib/exemplo.ts) |
| Telas | `src/app/*/page.tsx` |
| Formulários | `src/components/formularios-*.tsx` |

## Limites conhecidos

- Ao editar uma conta fixa, você escolhe se a mudança vale "a partir deste mês"
  (o histórico fica) ou "em todos os meses" (corrige um cadastro errado). Para
  mudar o valor de um mês só, clique na conta dentro daquele mês.
- Parcelas de cartão são calculadas sem juros.
- Uma pessoa participa de uma casa por vez.
- A importação lê faturas de cartão em CSV. Extrato da conta corrente, OFX e PDF
  não são lidos.
- Os avisos de vencimento aparecem dentro do app; não há notificação por e-mail ou celular.
