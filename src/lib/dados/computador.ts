// Modo computador: os dados ficam num arquivo na pasta do projeto
// (dados/financas.json), gravado pelo servidor que roda no computador.
// Qualquer aparelho da casa que abra o app pelo Wi-Fi vê os mesmos dados.
// Cada aparelho só lembra qual perfil está usando.

import type { Dados, Id, Linha, NomeTabela } from "../types";
import { novoId, type Backend, type PerfilLocal, type PreviaLar } from "./backend";

const CHAVE_SESSAO = "quinhao:sessao";
/** Onde as versões antigas do app guardavam tudo, no próprio navegador. */
const CHAVE_ANTIGA = "quinhao:banco:v1";

function lerSessao(): Id | null {
  try {
    return localStorage.getItem(CHAVE_SESSAO);
  } catch {
    return null;
  }
}

function exigirSessao(): Id {
  const id = lerSessao();
  if (!id) throw new Error("Ninguém está logado.");
  return id;
}

async function pedir<T>(url: string, corpo?: unknown): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(url, {
      method: corpo === undefined ? "GET" : "POST",
      headers: corpo === undefined ? undefined : { "content-type": "application/json" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      cache: "no-store",
    });
  } catch {
    throw new Error("Sem conexão com o computador onde o app está ligado.");
  }
  const dados = (await resposta.json().catch(() => ({}))) as T & {
    erro?: string;
  };
  if (!resposta.ok) throw new Error(dados.erro ?? "Não foi possível falar com o servidor.");
  return dados;
}

const acao = (nome: string, extra: Record<string, unknown> = {}) =>
  pedir<{ ok: true }>("/api/dados", {
    acao: nome,
    userId: lerSessao(),
    ...extra,
  });

export function criarBackendComputador(): Backend {
  return {
    modo: "computador",

    /** Na primeira vez, leva para o arquivo o que estava guardado só neste navegador. */
    async preparar() {
      let antigo: string | null = null;
      try {
        antigo = localStorage.getItem(CHAVE_ANTIGA);
      } catch {
        return;
      }
      if (!antigo) return;
      let dados: Partial<Dados>;
      try {
        dados = JSON.parse(antigo);
      } catch {
        return;
      }
      if (!dados.perfis?.length) return;
      const { aplicou } = await pedir<{ aplicou: boolean }>("/api/dados", {
        acao: "importar",
        dados,
        soSeVazio: true,
      });
      // Se o computador já tinha dados, nada é misturado: o que estava no navegador
      // continua guardado nele, intacto.
      if (!aplicou) return;
      localStorage.setItem(`${CHAVE_ANTIGA}:levado-para-o-computador`, antigo);
      localStorage.removeItem(CHAVE_ANTIGA);
    },

    async sessao() {
      const id = lerSessao();
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
      return pedir<PerfilLocal[]>("/api/dados?perfis=1");
    },
    async entrarLocal(perfilId) {
      localStorage.setItem(CHAVE_SESSAO, perfilId);
    },
    async novoLocal() {
      localStorage.setItem(CHAVE_SESSAO, novoId());
    },

    async carregar() {
      return pedir<Dados>(`/api/dados?perfil=${encodeURIComponent(exigirSessao())}`);
    },
    async inserir<K extends NomeTabela>(tabela: K, linha: Linha<K>) {
      await acao("inserir", { tabela, linha });
    },
    async atualizar<K extends NomeTabela>(tabela: K, id: Id, mudancas: Partial<Linha<K>>) {
      await acao("atualizar", { tabela, id, mudancas });
    },
    async remover(tabela, id) {
      await acao("remover", { tabela, id });
    },

    async criarLar(dados) {
      await acao("criarLar", { dados });
    },
    async consultarLar(codigo) {
      return pedir<PreviaLar | null>("/api/dados", {
        acao: "consultarLar",
        codigo,
      });
    },
    async entrarNoLar(dados) {
      await acao("entrarNoLar", { dados });
    },
    async sairDoLar() {
      await acao("sairDoLar");
    },

    async exportar() {
      const resposta = await fetch("/api/dados?copia=1", { cache: "no-store" });
      if (!resposta.ok) throw new Error("Não foi possível gerar a cópia.");
      return resposta.text();
    },
    async importar(json) {
      await pedir("/api/dados", { acao: "importar", dados: JSON.parse(json) });
      localStorage.removeItem(CHAVE_SESSAO);
    },
    async apagarTudo() {
      await acao("apagar");
      localStorage.removeItem(CHAVE_SESSAO);
    },
  };
}
