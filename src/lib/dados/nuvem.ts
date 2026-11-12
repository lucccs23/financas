// Modo nuvem: Supabase (Postgres + login). As regras de quem vê o quê ficam
// no banco (supabase/schema.sql); aqui só traduzimos nomes e chamamos a API.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { dadosVazios, TABELAS, type Dados, type Id, type Linha, type NomeTabela } from "../types";
import type { Backend, PreviaLar } from "./backend";

const NOME_NO_BANCO: Record<NomeTabela, string> = {
  perfis: "perfil",
  lares: "lar",
  moradores: "morador",
  contas: "conta",
  lancamentos: "lancamento",
  cartoes: "cartao",
  compras: "compra",
  acertos: "acerto",
  metas: "meta",
  aportes: "aporte",
  carteiras: "carteira",
  transacoes: "transacao",
};

type Registro = Record<string, unknown>;

/** orcamentoDiaADia → orcamento_dia_a_dia (só as chaves do primeiro nível). */
export function paraBanco(linha: Registro): Registro {
  return Object.fromEntries(
    Object.entries(linha).map(([k, v]) => [k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase()), v]),
  );
}

/** orcamento_dia_a_dia → orcamentoDiaADia. */
export function doBanco(linha: Registro): Registro {
  return Object.fromEntries(
    Object.entries(linha).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, l: string) => l.toUpperCase()),
      v,
    ]),
  );
}

function conferir(erro: { message: string } | null) {
  if (erro) throw new Error(erro.message);
}

export function criarBackendNuvem(url: string, chave: string): Backend {
  const sb: SupabaseClient = createClient(url, chave);

  return {
    modo: "nuvem",

    async sessao() {
      const { data, error } = await sb.auth.getSession();
      conferir(error);
      const u = data.session?.user;
      return u ? { userId: u.id, email: u.email ?? null } : null;
    },
    async sair() {
      const { error } = await sb.auth.signOut();
      conferir(error);
    },

    async entrar(email, senha) {
      const { error } = await sb.auth.signInWithPassword({
        email,
        password: senha,
      });
      if (error) {
        throw new Error(
          error.message === "Invalid login credentials"
            ? "E-mail ou senha incorretos."
            : error.message === "Email not confirmed"
              ? "Confirme seu e-mail antes de entrar."
              : error.message,
        );
      }
    },
    async cadastrar(email, senha, codigoAcesso) {
      const { data, error } = await sb.auth.signUp({
        email,
        password: senha,
        options: { data: { codigo_acesso: codigoAcesso.trim() } },
      });
      if (error) {
        throw new Error(
          /database error/i.test(error.message)
            ? "Não foi possível criar a conta. Confira o código de acesso."
            : /already registered/i.test(error.message)
              ? "Esse e-mail já tem conta. Use a aba Entrar."
              : error.message,
        );
      }
      return { confirmarEmail: !data.session };
    },

    async perfisLocais() {
      return [];
    },
    async entrarLocal() {
      throw new Error("Perfis sem senha só existem no modo computador.");
    },
    async novoLocal() {
      throw new Error("Perfis sem senha só existem no modo computador.");
    },

    async carregar() {
      const dados = dadosVazios();
      await Promise.all(
        TABELAS.map(async (t) => {
          const { data, error } = await sb.from(NOME_NO_BANCO[t]).select("*");
          conferir(error);
          (dados[t] as unknown[]) = (data ?? []).map((l) => doBanco(l as Registro));
        }),
      );
      return dados as Dados;
    },
    async inserir<K extends NomeTabela>(tabela: K, linha: Linha<K>) {
      const { error } = await sb
        .from(NOME_NO_BANCO[tabela])
        .insert(paraBanco(linha as unknown as Registro));
      conferir(error);
    },
    async atualizar<K extends NomeTabela>(tabela: K, id: Id, mudancas: Partial<Linha<K>>) {
      const { error } = await sb
        .from(NOME_NO_BANCO[tabela])
        .update(paraBanco(mudancas as Registro))
        .eq("id", id);
      conferir(error);
    },
    async remover(tabela, id) {
      const { error } = await sb.from(NOME_NO_BANCO[tabela]).delete().eq("id", id);
      conferir(error);
    },

    async criarLar({ larId, moradorId, nome, moradorNome, cor }) {
      const { error } = await sb.rpc("criar_lar", {
        p_lar_id: larId,
        p_morador_id: moradorId,
        p_nome: nome,
        p_morador_nome: moradorNome,
        p_cor: cor,
      });
      conferir(error);
    },
    async consultarLar(codigo) {
      const { data, error } = await sb.rpc("consultar_lar", {
        p_codigo: codigo,
      });
      conferir(error);
      return (data as PreviaLar | null) ?? null;
    },
    async entrarNoLar({ codigo, moradorId, novoId, nome, cor }) {
      const { error } = await sb.rpc("entrar_no_lar", {
        p_codigo: codigo,
        p_morador_id: moradorId,
        p_novo_id: novoId,
        p_nome: nome,
        p_cor: cor,
      });
      conferir(error);
    },
    async sairDoLar() {
      const { error } = await sb.rpc("sair_do_lar");
      conferir(error);
    },
  };
}
