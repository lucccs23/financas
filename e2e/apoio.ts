import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  expect,
  test as base,
  type Locator,
  type Page,
} from "@playwright/test";
import { dadosVazios, type Dados } from "../src/lib/types";

export const ARQUIVO = path.resolve(".e2e/financas.json");
export const HOJE = "2026-11-12";

/** Tudo aqui é inventado: o repositório é público. */
export function dadosDeExemplo(): Dados {
  const d = dadosVazios();
  d.perfis = [
    { id: "ana", nome: "Ana", cor: 0, salario: 300_000, orcamentoDiaADia: 0 },
  ];
  d.carteiras = [
    {
      id: "conta",
      perfilId: "ana",
      nome: "Conta Azul",
      tipo: "corrente",
      saldoInicial: 100_000,
      cor: 0,
      arquivada: false,
    },
  ];
  d.cartoes = [
    {
      id: "azul",
      perfilId: "ana",
      larId: null,
      nome: "Banco Azul",
      banco: "Banco Azul",
      cor: 0,
      limite: 500_000,
      diaFechamento: 28,
      diaVencimento: 5,
    },
  ];
  const compra = (
    id: string,
    descricao: string,
    valor: number,
    mesPrimeira: string,
    data: string,
    categoria: string,
  ) => ({
    id,
    cartaoId: "azul",
    perfilId: "ana",
    larId: null,
    descricao,
    valor,
    parcelas: 1,
    recorrente: false,
    mesPrimeira,
    mesFim: null,
    data,
    categoria,
  });
  d.compras = [
    compra("velha", "Loja Antiga", 30_000, "2026-11", "2026-10-10", "compras"),
    compra(
      "mercado",
      "Mercado do Bairro",
      40_000,
      "2026-12",
      "2026-11-03",
      "mercado",
    ),
    compra(
      "curso",
      "Curso Online",
      10_000,
      "2026-12",
      "2026-11-04",
      "educacao",
    ),
  ];
  // A fatura de novembro já foi paga: a fatura em aberto é a de dezembro.
  d.lancamentos = [
    {
      id: "paga",
      perfilId: "ana",
      larId: null,
      refTipo: "fatura",
      refId: "azul",
      mes: "2026-11",
      valor: null,
      pago: true,
      pulado: false,
    },
  ];
  d.contas = [
    {
      id: "internet",
      perfilId: "ana",
      larId: null,
      natureza: "despesa",
      nome: "Internet",
      valor: 10_000,
      diaVencimento: 20,
      recorrente: true,
      mesInicio: "2026-01",
      mesFim: null,
      estimada: false,
      moradia: false,
      categoria: "internet",
      pagadorId: null,
      participantes: null,
    },
  ];
  d.transacoes = [
    {
      id: "padaria",
      perfilId: "ana",
      data: "2026-11-10",
      descricao: "Padaria da Esquina",
      valor: 2_500,
      tipo: "saida",
      categoria: "alimentacao",
      carteiraId: "conta",
      carteiraDestinoId: null,
      observacao: "",
    },
  ];
  return d;
}

export function gravarDados(dados: Dados) {
  mkdirSync(path.dirname(ARQUIVO), { recursive: true });
  // Troca de uma vez, para o servidor nunca ler o arquivo pela metade.
  writeFileSync(`${ARQUIVO}.novo`, JSON.stringify(dados));
  renameSync(`${ARQUIVO}.novo`, ARQUIVO);
}

export const lerDados = () =>
  JSON.parse(readFileSync(ARQUIVO, "utf8")) as Dados;

/** Cada teste começa com os mesmos dados, a mesma data e sem erros na página. */
export const test = base.extend<{ errosDaPagina: void }>({
  errosDaPagina: [
    async ({ page }, usar) => {
      const erros: string[] = [];
      page.on("pageerror", (e) => erros.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") erros.push(m.text());
      });
      gravarDados(dadosDeExemplo());
      await page.clock.setFixedTime(new Date(`${HOJE}T12:00:00-03:00`));
      await usar();
      expect(erros, "erros no console da página").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export async function entrar(page: Page, caminho = "/") {
  await page.goto(caminho);
  await page.getByRole("button", { name: "Ana" }).click();
  await expect(page.getByRole("main")).toBeVisible();
}

export const painel = (page: Page, titulo: string | RegExp) =>
  page
    .getByRole("main")
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: titulo }) });

/** O texto sem espaços: "R$ 2.400 ,00" vira "R$2.400,00". */
export async function textoCorrido(local: Locator) {
  return (await local.innerText()).replace(/\s+/g, "");
}
