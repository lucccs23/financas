// Contrato entre o app e o lugar onde os dados moram.
// Há três implementações: "computador" (arquivo na pasta do projeto), "nuvem"
// (Supabase) e "github" (arquivo num repositório privado do GitHub).

import type { Dados, Id, Linha, NomeTabela } from "../types";

export interface Sessao {
  userId: Id;
  email: string | null;
}

export interface PerfilLocal {
  id: Id;
  nome: string;
  cor: number;
}

export interface PreviaLar {
  larId: Id;
  nome: string;
  /** Moradores cadastrados que ainda não têm conta no app. */
  vagos: { id: Id; nome: string; cor: number }[];
}

export interface Backend {
  modo: "computador" | "nuvem" | "github";

  /** GitHub: a chave de acesso guardada neste aparelho. */
  conexao?: {
    atual(): { repositorio: string } | null;
    /** Confere a chave lendo o repositório antes de guardar. */
    conectar(repositorio: string, chave: string): Promise<void>;
    desconectar(): Promise<void>;
  };

  /** Preparação antes do primeiro uso (ex.: levar dados antigos para o arquivo). */
  preparar?(): Promise<void>;

  sessao(): Promise<Sessao | null>;
  sair(): Promise<void>;

  /** Nuvem: e-mail e senha. */
  entrar(email: string, senha: string): Promise<void>;
  cadastrar(
    email: string,
    senha: string,
    codigoAcesso: string,
  ): Promise<{ confirmarEmail: boolean }>;

  /** Local: perfis guardados neste navegador. */
  perfisLocais(): Promise<PerfilLocal[]>;
  entrarLocal(perfilId: Id): Promise<void>;
  novoLocal(): Promise<void>;

  /** Tudo o que a pessoa logada pode ver: o que é dela e o que é do lar dela. */
  carregar(): Promise<Dados>;
  inserir<K extends NomeTabela>(tabela: K, linha: Linha<K>): Promise<void>;
  atualizar<K extends NomeTabela>(tabela: K, id: Id, mudancas: Partial<Linha<K>>): Promise<void>;
  remover(tabela: NomeTabela, id: Id): Promise<void>;

  criarLar(args: {
    larId: Id;
    moradorId: Id;
    nome: string;
    moradorNome: string;
    cor: number;
  }): Promise<void>;
  consultarLar(codigo: string): Promise<PreviaLar | null>;
  entrarNoLar(args: {
    codigo: string;
    /** Morador existente a assumir, ou null para entrar como morador novo. */
    moradorId: Id | null;
    novoId: Id;
    nome: string;
    cor: number;
  }): Promise<void>;
  sairDoLar(): Promise<void>;

  /** Local: cópia de segurança e limpeza. */
  exportar?(): Promise<string>;
  importar?(json: string): Promise<void>;
  apagarTudo?(): Promise<void>;
}

export function novoId(): Id {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Reserva para contextos sem crypto.randomUUID (página aberta por http em outro aparelho).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function novoCodigo(): string {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let codigo = "";
  for (let i = 0; i < 6; i++) {
    codigo += letras[Math.floor(Math.random() * letras.length)];
  }
  return codigo;
}
