import { describe, expect, it } from "vitest";
import {
  gastoPorDiaDaSemana,
  gastoPorMes,
  gastosDoPeriodo,
  nomeDoLugar,
  numerosDoMes,
  ondeMaisGasta,
  tendenciaPorCategoria,
} from "./analises";
import type { Dados } from "./types";

const base: Dados = {
  perfis: [{ id: "eu", nome: "Lucas" } as Dados["perfis"][number]],
  lares: [],
  moradores: [],
  contas: [],
  lancamentos: [],
  cartoes: [
    {
      id: "nu",
      perfilId: "eu",
      larId: null,
      nome: "Nubank",
      limite: 0,
      diaFechamento: 30,
      diaVencimento: 9,
    } as Dados["cartoes"][number],
  ],
  compras: [],
  acertos: [],
  metas: [],
  aportes: [],
  carteiras: [],
  transacoes: [],
};

const compra = (o: Partial<Dados["compras"][number]>) =>
  ({
    id: Math.random().toString(36),
    cartaoId: "nu",
    perfilId: "eu",
    larId: null,
    descricao: "Loja",
    valor: 10_000,
    parcelas: 1,
    recorrente: false,
    mesPrimeira: "2026-12",
    mesFim: null,
    data: "2026-11-05",
    categoria: "compras",
    ...o,
  }) as Dados["compras"][number];

const saida = (o: Partial<Dados["transacoes"][number]>) =>
  ({
    id: Math.random().toString(36),
    perfilId: "eu",
    carteiraId: null,
    tipo: "saida",
    valor: 5_000,
    data: "2026-11-10",
    descricao: "Supermercado Tauste",
    categoria: "mercado",
    soSaldo: false,
    ...o,
  }) as Dados["transacoes"][number];

describe("análises", () => {
  it("conta cada gasto no mês em que aconteceu, não no da fatura", () => {
    const d: Dados = {
      ...base,
      compras: [
        compra({
          descricao: "Loja",
          data: "2026-11-05",
          mesPrimeira: "2026-12",
        }),
        // Parcela 3/6 de compra antiga, na fatura de dezembro: conta em novembro.
        compra({
          descricao: "Airbnb · parcela 3/6",
          data: "2026-08-01",
          mesPrimeira: "2026-12",
          valor: 2_000,
        }),
        // Parcelada do app (3x), começou na fatura de novembro.
        compra({
          descricao: "TV",
          data: "2026-10-20",
          mesPrimeira: "2026-11",
          parcelas: 3,
          valor: 30_000,
        }),
      ],
      transacoes: [saida({}), saida({ soSaldo: true, valor: 99_999 })],
    };
    const gastos = gastosDoPeriodo(d, "eu", ["2026-10", "2026-11"]);
    const nov = gastoPorMes(gastos, ["2026-10", "2026-11"]);
    // Outubro: 1ª parcela da TV (10.000). Novembro: Loja 10.000 + Airbnb 2.000
    // + TV parcela 2 (fatura de dez → nov) 10.000 + mercado 5.000.
    expect(nov.map((m) => m.total)).toEqual([10_000, 27_000]);
    expect(nov[1].conta).toBe(5_000);
  });

  it("assinatura conta todo mês", () => {
    const d: Dados = {
      ...base,
      compras: [
        compra({
          descricao: "Netflix",
          recorrente: true,
          mesPrimeira: "2026-09",
          data: "2026-08-20",
        }),
      ],
    };
    const gastos = gastosDoPeriodo(d, "eu", ["2026-09", "2026-10", "2026-11"]);
    expect(
      gastoPorMes(gastos, ["2026-09", "2026-10", "2026-11"]).map(
        (m) => m.total,
      ),
    ).toEqual([10_000, 10_000, 10_000]);
  });

  it("nome do lugar sem parcela nem asterisco", () => {
    expect(nomeDoLugar("Recargapay *Lucasmart · parcela 2/3")).toBe(
      "Recargapay Lucasmart",
    );
    expect(nomeDoLugar("SUPERMERCADO TAUSTE")).toBe("Supermercado Tauste");
  });

  it("onde mais gasta, tendência e números do mês", () => {
    const d: Dados = {
      ...base,
      transacoes: [
        saida({ data: "2026-11-02", valor: 7_000 }),
        saida({ data: "2026-11-09", valor: 3_000 }),
        saida({
          data: "2026-11-03",
          descricao: "Uber",
          categoria: "transporte",
          valor: 2_000,
        }),
        saida({ data: "2026-10-10", valor: 5_000 }),
      ],
    };
    const meses = ["2026-10", "2026-11"];
    const gastos = gastosDoPeriodo(d, "eu", meses);
    const lugares = ondeMaisGasta(gastos, "2026-11");
    expect(lugares[0]).toMatchObject({
      onde: "Supermercado Tauste",
      total: 10_000,
      vezes: 2,
      ticketMedio: 5_000,
    });

    const t = tendenciaPorCategoria(gastos, meses);
    expect(t[0]).toMatchObject({
      categoria: "mercado",
      valores: [5_000, 10_000],
      media: 5_000,
      variacao: 1,
    });

    const n = numerosDoMes(gastos, meses, 10);
    expect(n).toMatchObject({
      total: 12_000,
      mediaAnterior: 5_000,
      porDia: 1_200,
      quantos: 3,
    });
    expect(n.maior?.valor).toBe(7_000);

    // 02/11 e 09/11 são segundas: média por segunda = 10.000 / 2.
    const dias = Array.from(
      { length: 14 },
      (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`,
    );
    expect(gastoPorDiaDaSemana(gastos, dias)[1]).toMatchObject({
      total: 10_000,
      media: 5_000,
    });
  });
});
