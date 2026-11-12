import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import * as op from "../dados/operacoes";
import type { Conta, Dados } from "../types";

const pasta = mkdtempSync(path.join(tmpdir(), "financas-teste-"));
const arquivo = path.join(pasta, "financas.json");
let lerBanco: () => Promise<Dados>;
let alterarBanco: <T>(f: (b: Dados) => T, copiaAntes?: string) => Promise<T>;

beforeAll(async () => {
  process.env.FINANCAS_ARQUIVO = arquivo;
  ({ lerBanco, alterarBanco } = await import("./arquivo"));
});

const conta = (id: string, perfilId: string | null, larId: string | null): Conta => ({
  id,
  perfilId,
  larId,
  natureza: "despesa",
  nome: id,
  valor: 100,
  diaVencimento: 5,
  recorrente: true,
  mesInicio: "2026-01",
  mesFim: null,
  estimada: false,
  moradia: false,
  categoria: "outros",
  pagadorId: null,
  participantes: null,
});

describe("arquivo de dados", () => {
  it("começa vazio quando o arquivo não existe", async () => {
    const b = await lerBanco();
    expect(b.perfis).toEqual([]);
    expect(b.contas).toEqual([]);
  });

  it("não perde nada com muitas gravações ao mesmo tempo", async () => {
    await Promise.all(
      Array.from({ length: 60 }, (_, i) =>
        alterarBanco((b) => op.inserir(b, "contas", conta(`c${i}`, "eu", null))),
      ),
    );
    const b = await lerBanco();
    expect(b.contas).toHaveLength(60);
    expect(JSON.parse(readFileSync(arquivo, "utf8")).contas).toHaveLength(60);
  });

  it("guarda uma cópia do dia antes de alterar", async () => {
    await alterarBanco((b) => op.remover(b, "contas", "c0"));
    const copias = readdirSync(path.join(pasta, "copias"));
    expect(copias).toHaveLength(1);
    expect(copias[0]).toMatch(/^financas-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it("guarda uma cópia do momento antes de apagar tudo", async () => {
    await alterarBanco((b) => {
      b.contas = [];
    }, "apagar");
    const extra = readdirSync(path.join(pasta, "copias")).filter((n) => n.includes("antes-de-apagar"));
    expect(extra).toHaveLength(1);
    expect(JSON.parse(readFileSync(path.join(pasta, "copias", extra[0]), "utf8")).contas.length).toBeGreaterThan(0);
  });

  it("não deixa arquivo temporário para trás", () => {
    expect(readdirSync(pasta).filter((n) => n.endsWith(".tmp"))).toEqual([]);
  });

  it("um erro numa alteração não trava as próximas", async () => {
    await expect(
      alterarBanco(() => {
        throw new Error("falha de teste");
      }),
    ).rejects.toThrow("falha de teste");
    await alterarBanco((b) => op.inserir(b, "contas", conta("depois", "eu", null)));
    expect((await lerBanco()).contas.some((c) => c.id === "depois")).toBe(true);
  });

  it("avisa com clareza quando o arquivo foi estragado", async () => {
    writeFileSync(arquivo, "{ isto não é json");
    await expect(lerBanco()).rejects.toThrow(/copias/);
  });
});

describe("regras de visibilidade e casa", () => {
  const banco = (): Dados => {
    const b = op.normalizar(null);
    b.perfis = [
      { id: "a", nome: "A", cor: 0, salario: 1, orcamentoDiaADia: 0 },
      { id: "b", nome: "B", cor: 1, salario: 2, orcamentoDiaADia: 0 },
      { id: "c", nome: "C", cor: 2, salario: 3, orcamentoDiaADia: 0 },
    ];
    op.criarLar(b, "a", { larId: "lar", moradorId: "ma", nome: "Casa", moradorNome: "A", cor: 0 });
    b.moradores.push({ id: "mae", larId: "lar", nome: "Mãe", cor: 3, perfilId: null, peso: 1, salarioCompartilhado: null });
    b.contas = [conta("casa", null, "lar"), conta("pessoal-a", "a", null)];
    return b;
  };

  it("cada um vê só o próprio perfil e as contas da casa", () => {
    const b = banco();
    op.entrarNoLar(b, "b", { codigo: b.lares[0].codigo, moradorId: "mae", novoId: "x", nome: "B", cor: 1 });
    const vistoPorB = op.recortar(b, "b");
    expect(vistoPorB.perfis.map((p) => p.id)).toEqual(["b"]);
    expect(vistoPorB.contas.map((c) => c.id)).toEqual(["casa"]);
    const vistoPorC = op.recortar(b, "c");
    expect(vistoPorC.contas).toEqual([]);
    expect(vistoPorC.moradores).toEqual([]);
  });

  it("código aceita minúsculas e espaços; morador já assumido é recusado", () => {
    const b = banco();
    const codigo = ` ${b.lares[0].codigo.toLowerCase()} `;
    expect(op.consultarLar(b, codigo)?.vagos.map((v) => v.nome)).toEqual(["Mãe"]);
    op.entrarNoLar(b, "b", { codigo, moradorId: "mae", novoId: "x", nome: "B", cor: 1 });
    expect(() =>
      op.entrarNoLar(b, "c", { codigo, moradorId: "mae", novoId: "y", nome: "C", cor: 2 }),
    ).toThrow(/assumido/);
    expect(() => op.criarLar(b, "b", { larId: "l2", moradorId: "m2", nome: "X", moradorNome: "B", cor: 1 })).toThrow(/já faz parte/);
  });

  it("sair da casa mantém o morador, sem conta", () => {
    const b = banco();
    op.entrarNoLar(b, "b", { codigo: b.lares[0].codigo, moradorId: null, novoId: "mb", nome: "B", cor: 1 });
    op.sairDoLar(b, "b");
    expect(b.moradores.find((m) => m.id === "mb")?.perfilId).toBeNull();
    expect(op.recortar(b, "b").contas).toEqual([]);
  });

  it("atualizar não troca o id e inserir não duplica", () => {
    const b = banco();
    op.atualizar(b, "contas", "casa", { id: "outro", valor: 999 } as Partial<Conta>);
    expect(b.contas.find((c) => c.id === "casa")?.valor).toBe(999);
    op.inserir(b, "contas", conta("casa", null, "lar"));
    expect(b.contas.filter((c) => c.id === "casa")).toHaveLength(1);
  });
});
