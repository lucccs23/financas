import { beforeEach, describe, expect, it } from "vitest";
import { criarBackendGitHub, deBase64, normalizarRepositorio, paraBase64 } from "./github";

/** Um GitHub de mentira: um repositório com um arquivo, versões por sha. */
function githubFalso(opcoes: { grande?: boolean; chaveValida?: string } = {}) {
  let conteudo: string | null = null;
  let versao = 0;
  const shaAtual = () => (conteudo === null ? null : `sha${versao}`);
  const pedidos: string[] = [];
  /** Simula outra pessoa salvando logo antes da próxima gravação. */
  let intrusa: ((atual: string) => string) | null = null;

  const responder = (status: number, corpo?: unknown) =>
    new Response(corpo === undefined ? null : JSON.stringify(corpo), { status });

  const buscar = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url).replace("https://api.github.com/repos/eu/dados", "");
    const metodo = init?.method ?? "GET";
    pedidos.push(`${metodo} ${u}`);
    const auth = (init?.headers as Record<string, string>).authorization;
    if (auth !== `Bearer ${opcoes.chaveValida ?? "chave-boa"}`) return responder(401);
    if (u === "") return responder(200, { private: true });
    if (u === "/contents/financas.json" && metodo === "GET") {
      if (conteudo === null) return responder(404);
      return responder(200, {
        sha: shaAtual(),
        encoding: opcoes.grande ? "none" : "base64",
        content: opcoes.grande ? "" : paraBase64(conteudo),
      });
    }
    if (u.startsWith("/git/blobs/")) return responder(200, { content: paraBase64(conteudo!) });
    if (u === "/contents/financas.json" && metodo === "PUT") {
      if (intrusa && conteudo !== null) {
        conteudo = intrusa(conteudo);
        versao++;
        intrusa = null;
      }
      const corpo = JSON.parse(String(init!.body)) as { sha?: string; content: string };
      if ((corpo.sha ?? null) !== shaAtual()) return responder(409);
      conteudo = deBase64(corpo.content);
      versao++;
      return responder(200, { content: { sha: shaAtual() } });
    }
    return responder(500);
  }) as typeof fetch;

  return {
    buscar,
    pedidos,
    lido: () => JSON.parse(conteudo ?? "null"),
    outraPessoaSalva: (f: (atual: string) => string) => (intrusa = f),
  };
}

// O teste roda fora do navegador: um localStorage simples, em memória.
const guardado = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => guardado.get(k) ?? null,
    setItem: (k: string, v: string) => void guardado.set(k, String(v)),
    removeItem: (k: string) => void guardado.delete(k),
    clear: () => guardado.clear(),
  },
});

beforeEach(() => localStorage.clear());

describe("modo GitHub", () => {
  it("entende o repositório escrito de vários jeitos", () => {
    expect(normalizarRepositorio("eu/dados")).toBe("eu/dados");
    expect(normalizarRepositorio(" https://github.com/eu/dados.git/ ")).toBe("eu/dados");
    expect(normalizarRepositorio("so-um-nome")).toBeNull();
  });

  it("guarda acentos e emojis sem estragar", () => {
    const texto = "Conta de luz ção 💡";
    expect(deBase64(paraBase64(texto))).toBe(texto);
  });

  it("recusa uma chave inválida e não guarda nada", async () => {
    const gh = githubFalso();
    const b = criarBackendGitHub(gh.buscar);
    await expect(b.conexao!.conectar("eu/dados", "chave-ruim")).rejects.toThrow(/não aceitou/);
    expect(b.conexao!.atual()).toBeNull();
    expect(await b.sessao()).toBeNull();
  });

  it("cria o arquivo no primeiro uso e lê de volta", async () => {
    const gh = githubFalso();
    const b = criarBackendGitHub(gh.buscar);
    await b.conexao!.conectar("https://github.com/eu/dados", "chave-boa");
    expect(b.conexao!.atual()).toEqual({ repositorio: "eu/dados" });
    expect(await b.perfisLocais()).toEqual([]);

    await b.novoLocal();
    const id = (await b.sessao())!.userId;
    await b.inserir("perfis", { id, nome: "Lúcia", cor: 2, salario: 100, orcamentoDiaADia: 10 });
    expect(gh.lido().perfis[0].nome).toBe("Lúcia");

    // Outro aparelho, com a mesma chave, vê o mesmo perfil.
    const outro = criarBackendGitHub(gh.buscar);
    expect(await outro.perfisLocais()).toEqual([{ id, nome: "Lúcia", cor: 2 }]);
    expect((await b.carregar()).perfis).toHaveLength(1);
  });

  it("não perde o que outra pessoa salvou ao mesmo tempo", async () => {
    const gh = githubFalso();
    const b = criarBackendGitHub(gh.buscar);
    await b.conexao!.conectar("eu/dados", "chave-boa");
    await b.novoLocal();
    const id = (await b.sessao())!.userId;
    await b.inserir("perfis", { id, nome: "Eu", cor: 0, salario: 0, orcamentoDiaADia: 0 });

    gh.outraPessoaSalva((atual) => {
      const banco = JSON.parse(atual);
      banco.perfis.push({ id: "irma", nome: "Irmã", cor: 1, salario: 0, orcamentoDiaADia: 0 });
      return JSON.stringify(banco);
    });
    await b.atualizar("perfis", id, { salario: 500 });

    const final = gh.lido();
    expect(final.perfis.map((p: { nome: string }) => p.nome)).toEqual(["Eu", "Irmã"]);
    expect(final.perfis[0].salario).toBe(500);
  });

  it("grava várias mudanças seguidas sem brigar consigo mesmo", async () => {
    const gh = githubFalso();
    const b = criarBackendGitHub(gh.buscar);
    await b.conexao!.conectar("eu/dados", "chave-boa");
    await Promise.all(
      [1, 2, 3].map((n) =>
        b.inserir("perfis", {
          id: `p${n}`,
          nome: `P${n}`,
          cor: 0,
          salario: 0,
          orcamentoDiaADia: 0,
        }),
      ),
    );
    expect(gh.lido().perfis).toHaveLength(3);
    // Feitas ao mesmo tempo, vão numa gravação só.
    expect(gh.pedidos.filter((p) => p.startsWith("PUT"))).toHaveLength(1);
  });

  it("uma mudança recusada não impede as outras do mesmo lote", async () => {
    const gh = githubFalso();
    const b = criarBackendGitHub(gh.buscar);
    await b.conexao!.conectar("eu/dados", "chave-boa");
    await b.entrarLocal("eu");
    const dadosCasa = { larId: "l1", moradorId: "m1", nome: "Casa", moradorNome: "Eu", cor: 0 };
    await b.criarLar(dadosCasa);
    const [repetida, perfil] = await Promise.allSettled([
      b.criarLar({ ...dadosCasa, larId: "l2", moradorId: "m2" }),
      b.inserir("perfis", { id: "eu", nome: "Eu", cor: 0, salario: 0, orcamentoDiaADia: 0 }),
    ]);
    expect(repetida.status).toBe("rejected");
    expect(perfil.status).toBe("fulfilled");
    expect(gh.lido().lares).toHaveLength(1);
    expect(gh.lido().perfis).toHaveLength(1);
  });

  it("lê arquivos acima de 1 MB pelo caminho alternativo", async () => {
    const gh = githubFalso({ grande: true });
    const b = criarBackendGitHub(gh.buscar);
    await b.conexao!.conectar("eu/dados", "chave-boa");
    await b.inserir("perfis", { id: "x", nome: "X", cor: 0, salario: 0, orcamentoDiaADia: 0 });
    const outro = criarBackendGitHub(gh.buscar);
    expect(await outro.perfisLocais()).toHaveLength(1);
    expect(gh.pedidos.some((p) => p.includes("/git/blobs/"))).toBe(true);
  });

  it("desconectar apaga a chave e o perfil deste aparelho", async () => {
    const gh = githubFalso();
    const b = criarBackendGitHub(gh.buscar);
    await b.conexao!.conectar("eu/dados", "chave-boa");
    await b.entrarLocal("p1");
    await b.conexao!.desconectar();
    expect(b.conexao!.atual()).toBeNull();
    expect(await b.sessao()).toBeNull();
  });
});
