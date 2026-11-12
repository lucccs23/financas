// Operações sobre o banco inteiro, sem saber onde ele mora. O servidor do
// computador usa estas funções para gravar no arquivo; as regras são as mesmas
// das funções do Supabase (supabase/schema.sql).

import { dadosVazios, TABELAS, type Dados, type Id, type Linha, type NomeTabela } from "../types";
import { novoCodigo, type PreviaLar } from "./backend";

/** O que a pessoa pode ver: o que é dela e o que é da casa dela. */
export function recortar(banco: Dados, userId: Id): Dados {
  const larId = banco.moradores.find((m) => m.perfilId === userId)?.larId ?? null;
  const doLar = (x: { larId: Id | null }) => larId !== null && x.larId === larId;
  const meuOuDoLar = (x: { perfilId: Id | null; larId: Id | null }) =>
    x.perfilId === userId || doLar(x);
  return {
    perfis: banco.perfis.filter((p) => p.id === userId),
    lares: banco.lares.filter((l) => l.id === larId),
    moradores: banco.moradores.filter((m) => m.larId === larId),
    contas: banco.contas.filter(meuOuDoLar),
    lancamentos: banco.lancamentos.filter(meuOuDoLar),
    cartoes: banco.cartoes.filter(meuOuDoLar),
    compras: banco.compras.filter(meuOuDoLar),
    acertos: banco.acertos.filter(doLar),
    metas: banco.metas.filter(meuOuDoLar),
    aportes: banco.aportes.filter(meuOuDoLar),
    carteiras: banco.carteiras.filter((c) => c.perfilId === userId),
    transacoes: banco.transacoes.filter((t) => t.perfilId === userId),
  };
}

/** Garante todas as tabelas, mesmo em arquivos antigos ou incompletos. */
export function normalizar(lido: Partial<Dados> | null | undefined): Dados {
  const banco = dadosVazios();
  for (const t of TABELAS) {
    if (Array.isArray(lido?.[t])) (banco[t] as unknown[]) = lido[t] as unknown[];
  }
  return banco;
}

export function inserir<K extends NomeTabela>(banco: Dados, tabela: K, linha: Linha<K>) {
  const lista = banco[tabela] as Linha<K>[];
  if (lista.some((x) => x.id === linha.id)) return;
  lista.push(linha);
}

export function atualizar<K extends NomeTabela>(
  banco: Dados,
  tabela: K,
  id: Id,
  mudancas: Partial<Linha<K>>,
) {
  banco[tabela] = (banco[tabela] as Linha<K>[]).map((x) =>
    x.id === id ? { ...x, ...mudancas, id } : x,
  ) as Dados[K];
}

export function remover(banco: Dados, tabela: NomeTabela, id: Id) {
  (banco[tabela] as { id: Id }[]) = (banco[tabela] as { id: Id }[]).filter((x) => x.id !== id);
}

function jaTemCasa(banco: Dados, userId: Id) {
  if (banco.moradores.some((m) => m.perfilId === userId)) {
    throw new Error("Você já faz parte de uma casa.");
  }
}

export function criarLar(
  banco: Dados,
  userId: Id,
  args: {
    larId: Id;
    moradorId: Id;
    nome: string;
    moradorNome: string;
    cor: number;
  },
) {
  jaTemCasa(banco, userId);
  let codigo = novoCodigo();
  while (banco.lares.some((l) => l.codigo === codigo)) codigo = novoCodigo();
  banco.lares.push({
    id: args.larId,
    nome: args.nome,
    codigo,
    criadoPor: userId,
  });
  banco.moradores.push({
    id: args.moradorId,
    larId: args.larId,
    nome: args.moradorNome,
    cor: args.cor,
    perfilId: userId,
    peso: 1,
    salarioCompartilhado: null,
  });
}

export function consultarLar(banco: Dados, codigo: string): PreviaLar | null {
  const lar = banco.lares.find((l) => l.codigo === codigo.trim().toUpperCase());
  if (!lar) return null;
  return {
    larId: lar.id,
    nome: lar.nome,
    vagos: banco.moradores
      .filter((m) => m.larId === lar.id && m.perfilId === null)
      .map((m) => ({ id: m.id, nome: m.nome, cor: m.cor })),
  };
}

export function entrarNoLar(
  banco: Dados,
  userId: Id,
  args: {
    codigo: string;
    moradorId: Id | null;
    novoId: Id;
    nome: string;
    cor: number;
  },
) {
  jaTemCasa(banco, userId);
  const lar = banco.lares.find((l) => l.codigo === args.codigo.trim().toUpperCase());
  if (!lar) throw new Error("Código não encontrado.");
  if (args.moradorId) {
    const m = banco.moradores.find(
      (x) => x.id === args.moradorId && x.larId === lar.id && x.perfilId === null,
    );
    if (!m) throw new Error("Esse morador já foi assumido por outra pessoa.");
    m.perfilId = userId;
    return;
  }
  banco.moradores.push({
    id: args.novoId,
    larId: lar.id,
    nome: args.nome,
    cor: args.cor,
    perfilId: userId,
    peso: 1,
    salarioCompartilhado: null,
  });
}

export function sairDoLar(banco: Dados, userId: Id) {
  for (const m of banco.moradores) {
    if (m.perfilId === userId) {
      m.perfilId = null;
      m.salarioCompartilhado = null;
    }
  }
  for (const c of banco.cartoes) if (c.perfilId === userId) c.larId = null;
  for (const c of banco.compras) if (c.perfilId === userId) c.larId = null;
}
