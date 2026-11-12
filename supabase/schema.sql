-- ═══════════════════════════════════════════════════════════════════════
-- Finanças: banco de dados no Supabase
--
-- Como usar: no painel do Supabase, abra SQL Editor > New query, cole este
-- arquivo inteiro e clique em Run. Rode uma única vez, em um projeto novo.
--
-- ANTES de rodar, troque o código de acesso na linha marcada com "TROQUE".
-- ═══════════════════════════════════════════════════════════════════════


-- ───────── 1. Código de acesso ─────────
-- Só cria conta quem digitar este código no cadastro. Deixe o valor vazio
-- ('') para liberar o cadastro a qualquer pessoa que tenha o link do app.

create table public.config (
  chave text primary key,
  valor text
);
alter table public.config enable row level security; -- sem regras: o app não lê esta tabela

insert into public.config (chave, valor)
values ('codigo_acesso', 'TROQUE-ESTE-CODIGO'); -- TROQUE


-- ───────── 2. Tabelas ─────────
-- Valores em dinheiro são sempre centavos (inteiros). Meses são texto "AAAA-MM".

create table public.perfil (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  cor integer not null default 0,
  salario bigint not null default 0,
  orcamento_dia_a_dia bigint not null default 0,
  -- mudanças de renda: [{ "desde": "AAAA-MM", "salario": 0, "diaADia": 0 }]
  historico jsonb
);

create table public.lar (
  id uuid primary key,
  nome text not null,
  codigo text not null unique,
  criado_por uuid not null references auth.users (id)
);

create table public.morador (
  id uuid primary key,
  lar_id uuid not null references public.lar (id) on delete cascade,
  nome text not null,
  cor integer not null default 0,
  perfil_id uuid unique references auth.users (id) on delete set null,
  peso numeric not null default 1,
  salario_compartilhado bigint
);

create table public.conta (
  id uuid primary key,
  perfil_id uuid references auth.users (id) on delete cascade,
  lar_id uuid references public.lar (id) on delete cascade,
  natureza text not null check (natureza in ('despesa', 'receita')),
  nome text not null,
  valor bigint not null,
  dia_vencimento integer not null,
  recorrente boolean not null,
  mes_inicio text not null,
  mes_fim text,
  estimada boolean not null default false,
  moradia boolean not null default false,
  categoria text not null default 'outros',
  pagador_id uuid references public.morador (id) on delete set null,
  participantes jsonb,
  meta_id uuid, -- ligada à tabela meta mais abaixo
  -- conta pessoal tem perfil_id; conta da casa tem lar_id; nunca os dois
  check ((perfil_id is null) <> (lar_id is null))
);

create table public.lancamento (
  id uuid primary key,
  perfil_id uuid references auth.users (id) on delete cascade,
  lar_id uuid references public.lar (id) on delete cascade,
  ref_tipo text not null check (ref_tipo in ('conta', 'fatura')),
  ref_id uuid not null,
  mes text not null,
  valor bigint,
  pago boolean not null default false,
  pulado boolean not null default false,
  unique (ref_tipo, ref_id, mes),
  check ((perfil_id is null) <> (lar_id is null))
);

create table public.cartao (
  id uuid primary key,
  perfil_id uuid not null references auth.users (id) on delete cascade,
  lar_id uuid references public.lar (id) on delete set null,
  nome text not null,
  banco text not null default '',
  cor integer not null default 0,
  limite bigint not null default 0,
  dia_fechamento integer not null,
  dia_vencimento integer not null,
  limite_ajuste bigint not null default 0, -- acerto para bater com o disponível do banco
  limite_conferido_em date,                -- quando o limite foi conferido com o banco
  imagem text, -- foto do cartão (imagem pequena, em texto)
  logo text,   -- logo do banco (imagem pequena, em texto)
  externo_id text -- item do banco (Open Finance) que originou o cartão
);

create table public.compra (
  id uuid primary key,
  cartao_id uuid not null references public.cartao (id) on delete cascade,
  perfil_id uuid not null references auth.users (id) on delete cascade,
  lar_id uuid references public.lar (id) on delete set null,
  descricao text not null,
  valor bigint not null,
  parcelas integer not null default 1,
  recorrente boolean not null default false,
  mes_primeira text not null,
  mes_fim text,
  data date not null,
  categoria text not null default 'outros',
  externo_id text
);

create table public.acerto (
  id uuid primary key,
  lar_id uuid not null references public.lar (id) on delete cascade,
  mes text not null,
  de_id uuid not null references public.morador (id) on delete cascade,
  para_id uuid not null references public.morador (id) on delete cascade,
  valor bigint not null,
  feito_em date not null
);

create table public.meta (
  id uuid primary key,
  perfil_id uuid references auth.users (id) on delete cascade,
  lar_id uuid references public.lar (id) on delete cascade,
  nome text not null,
  alvo bigint not null default 0,
  cor integer not null default 0,
  check ((perfil_id is null) <> (lar_id is null))
);

create table public.aporte (
  id uuid primary key,
  meta_id uuid not null references public.meta (id) on delete cascade,
  perfil_id uuid references auth.users (id) on delete cascade,
  lar_id uuid references public.lar (id) on delete cascade,
  valor bigint not null,
  data date not null,
  descricao text not null default '',
  origem text, -- lançamento que gerou o valor guardado (conta paga ligada à meta)
  check ((perfil_id is null) <> (lar_id is null))
);

alter table public.conta
  add constraint conta_meta_fk foreign key (meta_id) references public.meta (id) on delete set null;

-- Carteiras (conta do banco, poupança, dinheiro) e transações avulsas: sempre pessoais.
create table public.carteira (
  id uuid primary key,
  perfil_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  tipo text not null default 'corrente' check (tipo in ('corrente', 'poupanca', 'dinheiro', 'investimento')),
  saldo_inicial bigint not null default 0,
  cor integer not null default 0,
  arquivada boolean not null default false,
  externo_id text
);

create table public.transacao (
  id uuid primary key,
  perfil_id uuid not null references auth.users (id) on delete cascade,
  data date not null,
  descricao text not null,
  valor bigint not null check (valor > 0),
  tipo text not null check (tipo in ('saida', 'entrada', 'transferencia')),
  categoria text not null default 'outros',
  carteira_id uuid references public.carteira (id) on delete set null,
  carteira_destino_id uuid references public.carteira (id) on delete set null,
  observacao text not null default '',
  externo_id text,
  so_saldo boolean not null default false
);

create index on public.morador (lar_id);
create index on public.transacao (perfil_id, data);
create index on public.conta (perfil_id);
create index on public.conta (lar_id);
create index on public.lancamento (perfil_id);
create index on public.lancamento (lar_id);
create index on public.compra (cartao_id);
create index on public.aporte (meta_id);


-- ───────── 3. Quem vê o quê ─────────
-- Regra geral: cada pessoa vê o que é do seu perfil e o que é da sua casa.

-- A casa da pessoa logada (ou null se ela não está em nenhuma).
create or replace function public.meu_lar()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select lar_id from public.morador where perfil_id = auth.uid() limit 1
$$;

alter table public.perfil enable row level security;
alter table public.lar enable row level security;
alter table public.morador enable row level security;
alter table public.conta enable row level security;
alter table public.lancamento enable row level security;
alter table public.cartao enable row level security;
alter table public.compra enable row level security;
alter table public.acerto enable row level security;
alter table public.meta enable row level security;
alter table public.aporte enable row level security;
alter table public.carteira enable row level security;
alter table public.transacao enable row level security;

-- Perfil: só o próprio. Salário e orçamento nunca saem daqui.
create policy perfil_proprio on public.perfil for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Casa: os moradores veem e podem renomear. Criar e entrar é pelas funções da seção 4.
create policy lar_ver on public.lar for select to authenticated
  using (id = public.meu_lar());
create policy lar_renomear on public.lar for update to authenticated
  using (id = public.meu_lar()) with check (id = public.meu_lar());

-- Moradores: qualquer morador da casa cadastra, edita e tira quem não tem conta.
create policy morador_ver on public.morador for select to authenticated
  using (lar_id = public.meu_lar());
create policy morador_criar on public.morador for insert to authenticated
  with check (lar_id = public.meu_lar() and perfil_id is null);
create policy morador_editar on public.morador for update to authenticated
  using (lar_id = public.meu_lar()) with check (lar_id = public.meu_lar());
create policy morador_tirar on public.morador for delete to authenticated
  using (lar_id = public.meu_lar() and perfil_id is null);

-- Contas, situação do mês, metas e movimentações: do perfil ou da casa.
create policy conta_acesso on public.conta for all to authenticated
  using (perfil_id = auth.uid() or lar_id = public.meu_lar())
  with check (perfil_id = auth.uid() or lar_id = public.meu_lar());
create policy lancamento_acesso on public.lancamento for all to authenticated
  using (perfil_id = auth.uid() or lar_id = public.meu_lar())
  with check (perfil_id = auth.uid() or lar_id = public.meu_lar());
create policy meta_acesso on public.meta for all to authenticated
  using (perfil_id = auth.uid() or lar_id = public.meu_lar())
  with check (perfil_id = auth.uid() or lar_id = public.meu_lar());
create policy aporte_acesso on public.aporte for all to authenticated
  using (perfil_id = auth.uid() or lar_id = public.meu_lar())
  with check (perfil_id = auth.uid() or lar_id = public.meu_lar());

-- Cartões e compras: só o dono altera; a casa enxerga os marcados como "da casa".
create policy cartao_dono on public.cartao for all to authenticated
  using (perfil_id = auth.uid())
  with check (perfil_id = auth.uid() and (lar_id is null or lar_id = public.meu_lar()));
create policy cartao_da_casa on public.cartao for select to authenticated
  using (lar_id = public.meu_lar());
create policy compra_dono on public.compra for all to authenticated
  using (perfil_id = auth.uid())
  with check (perfil_id = auth.uid() and (lar_id is null or lar_id = public.meu_lar()));
create policy compra_da_casa on public.compra for select to authenticated
  using (lar_id = public.meu_lar());

-- Carteiras e transações: só a própria pessoa.
create policy carteira_dono on public.carteira for all to authenticated
  using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());
create policy transacao_dono on public.transacao for all to authenticated
  using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

-- Acertos: da casa.
create policy acerto_acesso on public.acerto for all to authenticated
  using (lar_id = public.meu_lar()) with check (lar_id = public.meu_lar());

grant select, insert, update, delete on
  public.perfil, public.lar, public.morador, public.conta, public.lancamento,
  public.cartao, public.compra, public.acerto, public.meta, public.aporte,
  public.carteira, public.transacao
to authenticated;
revoke all on public.config from anon, authenticated;


-- ───────── 4. Criar, entrar e sair de uma casa ─────────
-- Estas ações mexem em linhas que a pessoa ainda não pode ver (ela só vê a
-- casa depois de entrar), por isso rodam como funções com permissão própria.

create or replace function public.criar_lar(
  p_lar_id uuid, p_morador_id uuid, p_nome text, p_morador_nome text, p_cor integer
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta primeiro.';
  end if;
  if public.meu_lar() is not null then
    raise exception 'Você já faz parte de uma casa.';
  end if;
  insert into public.lar (id, nome, codigo, criado_por)
  values (p_lar_id, p_nome, upper(substr(md5(gen_random_uuid()::text), 1, 6)), auth.uid());
  insert into public.morador (id, lar_id, nome, cor, perfil_id)
  values (p_morador_id, p_lar_id, p_morador_nome, p_cor, auth.uid());
end
$$;

-- Devolve o nome da casa e os moradores ainda sem conta, para a pessoa escolher quem ela é.
create or replace function public.consultar_lar(p_codigo text)
returns json
language sql stable security definer
set search_path = public
as $$
  select json_build_object(
    'larId', l.id,
    'nome', l.nome,
    'vagos', coalesce(
      (select json_agg(json_build_object('id', m.id, 'nome', m.nome, 'cor', m.cor))
         from public.morador m
        where m.lar_id = l.id and m.perfil_id is null),
      '[]'::json
    )
  )
  from public.lar l
  where l.codigo = upper(trim(p_codigo))
    and auth.uid() is not null
$$;

create or replace function public.entrar_no_lar(
  p_codigo text, p_morador_id uuid, p_novo_id uuid, p_nome text, p_cor integer
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_lar uuid;
  v_linhas integer;
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta primeiro.';
  end if;
  if public.meu_lar() is not null then
    raise exception 'Você já faz parte de uma casa.';
  end if;
  select id into v_lar from public.lar where codigo = upper(trim(p_codigo));
  if v_lar is null then
    raise exception 'Código não encontrado.';
  end if;
  if p_morador_id is not null then
    update public.morador set perfil_id = auth.uid()
     where id = p_morador_id and lar_id = v_lar and perfil_id is null;
    get diagnostics v_linhas = row_count;
    if v_linhas = 0 then
      raise exception 'Esse morador já foi assumido por outra pessoa.';
    end if;
  else
    insert into public.morador (id, lar_id, nome, cor, perfil_id)
    values (p_novo_id, v_lar, p_nome, p_cor, auth.uid());
  end if;
end
$$;

-- A pessoa sai, mas continua na divisão como morador sem conta.
create or replace function public.sair_do_lar()
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  update public.cartao set lar_id = null where perfil_id = auth.uid();
  update public.compra set lar_id = null where perfil_id = auth.uid();
  update public.morador set perfil_id = null, salario_compartilhado = null
   where perfil_id = auth.uid();
end
$$;

revoke execute on function
  public.criar_lar(uuid, uuid, text, text, integer),
  public.consultar_lar(text),
  public.entrar_no_lar(text, uuid, uuid, text, integer),
  public.sair_do_lar()
from public, anon;
grant execute on function
  public.meu_lar(),
  public.criar_lar(uuid, uuid, text, text, integer),
  public.consultar_lar(text),
  public.entrar_no_lar(text, uuid, uuid, text, integer),
  public.sair_do_lar()
to authenticated;


-- ───────── 5. Conferir o código de acesso no cadastro ─────────

create or replace function public.conferir_codigo_acesso()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_esperado text;
begin
  select valor into v_esperado from public.config where chave = 'codigo_acesso';
  if v_esperado is null or v_esperado = '' then
    return new;
  end if;
  if coalesce(new.raw_user_meta_data ->> 'codigo_acesso', '') <> v_esperado then
    raise exception 'Código de acesso inválido.';
  end if;
  return new;
end
$$;

create trigger conferir_codigo_acesso
  before insert on auth.users
  for each row execute function public.conferir_codigo_acesso();

-- Para trocar o código depois:
--   update public.config set valor = 'NOVO-CODIGO' where chave = 'codigo_acesso';
