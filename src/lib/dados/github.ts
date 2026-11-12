// Modo GitHub: os dados ficam num arquivo (financas.json) dentro de um
// repositório PRIVADO do GitHub. O site em si fica no GitHub Pages; cada
// aparelho guarda uma chave de acesso que só pode mexer nesse repositório.
// As regras são as mesmas do modo computador (operacoes.ts), e cada mudança
// vira uma versão no histórico do repositório, o que também serve de cópia.

import type { StatusOpenFinance } from "../open-finance";
import { TABELAS, type Dados, type Id, type Linha, type NomeTabela } from "../types";
import { novoId, type Backend } from "./backend";
import * as op from "./operacoes";

const CHAVE_SESSAO = "financas:github:perfil";
const CHAVE_CONEXAO = "financas:github:conexao";
const ARQUIVO = "financas.json";
/** Situação da busca no Open Finance, gravada pela tarefa automática do repositório. */
const ARQUIVO_OPEN_FINANCE = "open-finance.json";
const TAREFA_OPEN_FINANCE = "buscar-no-banco.yml";

export interface ConexaoGitHub {
  /** "usuario/repositorio" */
  repositorio: string;
  chave: string;
}

/** Repositório sugerido na hora de conectar (variável DADOS_REPO do GitHub). */
export const REPOSITORIO_PADRAO = process.env.NEXT_PUBLIC_DADOS_REPO ?? "";

/** Aceita "usuario/repo" ou o endereço completo do repositório. */
export function normalizarRepositorio(texto: string): string | null {
  const limpo = texto
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/i, "");
  return /^[\w.-]+\/[\w.-]+$/.test(limpo) ? limpo : null;
}

/* ───────────── Texto ⇄ base64 (o GitHub entrega e recebe assim) ───────────── */

export function paraBase64(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let binario = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binario);
}

export function deBase64(b64: string): string {
  const binario = atob(b64.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(binario, (c) => c.charCodeAt(0)));
}

/* ───────────────────────── Arquivo no repositório ───────────────────────── */

/** Alguém salvou entre a nossa leitura e a nossa gravação. */
export class Conflito extends Error {}

export interface Lido {
  banco: Dados;
  /** Versão do arquivo no GitHub; null quando ele ainda não existe. */
  sha: string | null;
}

export function arquivoNoGitHub(conexao: ConexaoGitHub, buscar: typeof fetch = fetch) {
  const base = `https://api.github.com/repos/${conexao.repositorio}`;

  async function pedir(caminho: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await buscar(`${base}${caminho}`, {
        ...init,
        cache: "no-store",
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${conexao.chave}`,
          "x-github-api-version": "2022-11-28",
          ...(init.body ? { "content-type": "application/json" } : {}),
        },
      });
    } catch {
      throw new Error("Sem internet: não consegui falar com o GitHub.");
    }
  }

  function falha(r: Response): Error {
    if (r.status === 401) {
      return new Error(
        "O GitHub não aceitou essa chave. Confira se ela foi copiada inteira, se não venceu, ou crie uma nova.",
      );
    }
    if (r.status === 403 || r.status === 404) {
      return new Error(
        "A chave não tem acesso a esse repositório. Confira o nome do repositório e as permissões da chave.",
      );
    }
    return new Error(`O GitHub recusou o pedido (erro ${r.status}). Tente de novo em instantes.`);
  }

  return {
    async ler(): Promise<Lido> {
      const r = await pedir(`/contents/${ARQUIVO}`);
      if (r.status === 404) {
        // O arquivo ainda não existe (primeiro uso) ou o repositório não está ao alcance.
        const repo = await pedir("");
        if (!repo.ok) throw falha(repo);
        return { banco: op.normalizar(null), sha: null };
      }
      if (!r.ok) throw falha(r);
      const info = (await r.json()) as {
        sha: string;
        content?: string;
        encoding?: string;
      };
      let conteudo = info.encoding === "base64" ? info.content : undefined;
      if (!conteudo) {
        // Acima de 1 MB (fotos de cartão), o conteúdo vem à parte.
        const b = await pedir(`/git/blobs/${info.sha}`);
        if (!b.ok) throw falha(b);
        conteudo = ((await b.json()) as { content: string }).content;
      }
      let lido: Partial<Dados>;
      try {
        lido = JSON.parse(deBase64(conteudo));
      } catch {
        throw new Error(`O arquivo ${ARQUIVO} do repositório não é um arquivo de dados válido.`);
      }
      return { banco: op.normalizar(lido), sha: info.sha };
    },

    async gravar(banco: Dados, sha: string | null, mensagem: string): Promise<string> {
      const r = await pedir(`/contents/${ARQUIVO}`, {
        method: "PUT",
        body: JSON.stringify({
          message: mensagem,
          content: paraBase64(JSON.stringify(banco, null, 1)),
          ...(sha ? { sha } : {}),
        }),
      });
      if (r.status === 409 || r.status === 422) throw new Conflito();
      if (!r.ok) throw falha(r);
      return ((await r.json()) as { content: { sha: string } }).content.sha;
    },

    async lerStatusOpenFinance(): Promise<StatusOpenFinance | null> {
      const r = await pedir(`/contents/${ARQUIVO_OPEN_FINANCE}`);
      if (r.status === 404) return null;
      if (!r.ok) throw falha(r);
      const info = (await r.json()) as { content?: string };
      try {
        return JSON.parse(deBase64(info.content ?? "")) as StatusOpenFinance;
      } catch {
        return null;
      }
    },

    async buscarNoBanco(): Promise<void> {
      const r = await pedir(`/actions/workflows/${TAREFA_OPEN_FINANCE}/dispatches`, {
        method: "POST",
        body: JSON.stringify({ ref: "main" }),
      });
      if (r.ok) return;
      if (r.status === 404) {
        throw new Error(
          "A busca no banco ainda não está instalada no repositório dos dados (falta o arquivo da tarefa).",
        );
      }
      if (r.status === 403) {
        throw new Error(
          'A chave não pode iniciar a busca. No GitHub, edite a chave e dê a permissão "Actions: Read and write".',
        );
      }
      throw falha(r);
    },
  };
}

/* ───────────────────────── Guardado neste aparelho ───────────────────────── */

function ler(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function lerConexao(): ConexaoGitHub | null {
  const texto = ler(CHAVE_CONEXAO);
  if (!texto) return null;
  try {
    const c = JSON.parse(texto) as ConexaoGitHub;
    return c.repositorio && c.chave ? c : null;
  } catch {
    return null;
  }
}

/* ───────────────────────── Backend ───────────────────────── */

interface Pedido {
  mensagem: string;
  mudar: (banco: Dados) => unknown;
  ok: (resultado: unknown) => void;
  falhou: (erro: unknown) => void;
}

export function criarBackendGitHub(buscar: typeof fetch = (...a) => fetch(...a)): Backend {
  let cache: Lido | null = null;
  /** Mudanças esperando para ir ao GitHub. As que chegam juntas viram uma gravação só. */
  let espera: Pedido[] = [];
  let gravando = false;

  function arquivo() {
    const conexao = lerConexao();
    if (!conexao) throw new Error("Este aparelho não está conectado ao GitHub.");
    return arquivoNoGitHub(conexao, buscar);
  }

  async function obter(novo: boolean): Promise<Lido> {
    if (!cache || novo) cache = await arquivo().ler();
    return cache;
  }

  function exigirSessao(): Id {
    const id = ler(CHAVE_SESSAO);
    if (!id) throw new Error("Ninguém está logado.");
    return id;
  }

  /**
   * Lê, aplica a mudança e grava. Mudanças feitas ao mesmo tempo vão juntas
   * (o GitHub limita quantas gravações por minuto aceita). Se outra pessoa
   * salvou no meio, refaz tudo por cima da versão dela.
   */
  function alterar<T>(mensagem: string, mudar: (banco: Dados) => T): Promise<T> {
    return new Promise<T>((ok, falhou) => {
      espera.push({ mensagem, mudar, ok: ok as (v: unknown) => void, falhou });
      if (!gravando) void esvaziar();
    });
  }

  async function esvaziar() {
    gravando = true;
    try {
      while (espera.length) {
        // Um instante para juntar o que foi pedido ao mesmo tempo.
        await new Promise((r) => setTimeout(r, 0));
        const lote = espera;
        espera = [];
        await gravarLote(lote);
      }
    } finally {
      gravando = false;
    }
  }

  async function gravarLote(lote: Pedido[]) {
    for (let tentativa = 0; tentativa < 4; tentativa++) {
      let atual: Lido;
      try {
        atual = await obter(tentativa > 0);
      } catch (e) {
        for (const p of lote) p.falhou(e);
        return;
      }
      const banco = structuredClone(atual.banco);
      const validos: { pedido: Pedido; resultado: unknown }[] = [];
      for (const pedido of lote) {
        // As regras recusam antes de mexer em qualquer coisa (ex.: "já faz parte
        // de uma casa"), então uma recusa não deixa nada pela metade.
        try {
          validos.push({ pedido, resultado: pedido.mudar(banco) });
        } catch (e) {
          pedido.falhou(e);
        }
      }
      if (!validos.length) return;
      const mensagem =
        validos.length === 1 ? validos[0].pedido.mensagem : `${validos.length} mudanças`;
      try {
        const sha = await arquivo().gravar(banco, atual.sha, mensagem);
        cache = { banco, sha };
        for (const v of validos) v.pedido.ok(v.resultado);
        return;
      } catch (e) {
        if (!(e instanceof Conflito)) {
          for (const v of validos) v.pedido.falhou(e);
          return;
        }
        lote = validos.map((v) => v.pedido);
      }
    }
    const erro = new Error("Outra pessoa estava salvando ao mesmo tempo. Tente de novo.");
    for (const p of lote) p.falhou(erro);
  }

  return {
    modo: "github",

    openFinance: {
      status: () => arquivo().lerStatusOpenFinance(),
      buscarAgora: () => arquivo().buscarNoBanco(),
    },

    conexao: {
      atual() {
        const c = lerConexao();
        return c ? { repositorio: c.repositorio } : null;
      },
      async conectar(repositorio, chave) {
        const repo = normalizarRepositorio(repositorio);
        if (!repo) throw new Error('Escreva o repositório como "usuario/nome".');
        const conexao = { repositorio: repo, chave: chave.trim() };
        if (!conexao.chave) throw new Error("Cole a chave de acesso do GitHub.");
        cache = await arquivoNoGitHub(conexao, buscar).ler();
        localStorage.setItem(CHAVE_CONEXAO, JSON.stringify(conexao));
      },
      async desconectar() {
        cache = null;
        localStorage.removeItem(CHAVE_CONEXAO);
        localStorage.removeItem(CHAVE_SESSAO);
      },
    },

    async sessao() {
      if (!lerConexao()) return null;
      const id = ler(CHAVE_SESSAO);
      return id ? { userId: id, email: null } : null;
    },
    async sair() {
      localStorage.removeItem(CHAVE_SESSAO);
    },

    async entrar() {
      throw new Error("Login por e-mail só existe no modo nuvem.");
    },
    async cadastrar() {
      throw new Error("Cadastro por e-mail só existe no modo nuvem.");
    },

    async perfisLocais() {
      const { banco } = await obter(true);
      return banco.perfis.map((p) => ({ id: p.id, nome: p.nome, cor: p.cor }));
    },
    async entrarLocal(perfilId) {
      localStorage.setItem(CHAVE_SESSAO, perfilId);
    },
    async novoLocal() {
      localStorage.setItem(CHAVE_SESSAO, novoId());
    },

    async carregar() {
      const id = exigirSessao();
      const { banco } = await obter(true);
      return op.recortar(banco, id);
    },
    async inserir<K extends NomeTabela>(tabela: K, linha: Linha<K>) {
      await alterar(`Adiciona em ${tabela}`, (b) => op.inserir(b, tabela, linha));
    },
    async atualizar<K extends NomeTabela>(tabela: K, id: Id, mudancas: Partial<Linha<K>>) {
      await alterar(`Atualiza ${tabela}`, (b) => op.atualizar(b, tabela, id, mudancas));
    },
    async remover(tabela, id) {
      await alterar(`Remove de ${tabela}`, (b) => op.remover(b, tabela, id));
    },

    async criarLar(dados) {
      const id = exigirSessao();
      await alterar("Cria a casa", (b) => op.criarLar(b, id, dados));
    },
    async consultarLar(codigo) {
      return op.consultarLar((await obter(true)).banco, codigo);
    },
    async entrarNoLar(dados) {
      const id = exigirSessao();
      await alterar("Entra na casa", (b) => op.entrarNoLar(b, id, dados));
    },
    async sairDoLar() {
      const id = exigirSessao();
      await alterar("Sai da casa", (b) => op.sairDoLar(b, id));
    },

    async exportar() {
      return JSON.stringify((await obter(true)).banco, null, 2);
    },
    async importar(json) {
      const novo = op.normalizar(JSON.parse(json) as Partial<Dados>);
      if (!novo.perfis.length) throw new Error("O arquivo não tem nenhum perfil.");
      await alterar("Restaura uma cópia", (b) => {
        for (const t of TABELAS) (b[t] as unknown[]) = novo[t];
      });
      localStorage.removeItem(CHAVE_SESSAO);
    },
    async apagarTudo() {
      await alterar("Apaga tudo", (b) => {
        for (const t of TABELAS) (b[t] as unknown[]) = [];
      });
      localStorage.removeItem(CHAVE_SESSAO);
    },
  };
}
