import { describe, expect, it } from "vitest";
import { mesDeReferencia } from "./calc";
import { dadosVazios, type Dados } from "./types";

function comFaturas(vencimentos: number[], pagas: number[] = []): Dados {
  const d = dadosVazios();
  d.perfis.push({ id: "eu", nome: "Eu", cor: 0, salario: 0, orcamentoDiaADia: 0 });
  vencimentos.forEach((dia, i) => {
    const id = `k${i}`;
    d.cartoes.push({
      id,
      perfilId: "eu",
      larId: null,
      nome: `Cartão ${i}`,
      banco: "",
      cor: 0,
      limite: 0,
      diaFechamento: 1,
      diaVencimento: dia,
    });
    d.compras.push({
      id: `c${i}`,
      cartaoId: id,
      perfilId: "eu",
      larId: null,
      descricao: "Compra",
      valor: 10_000,
      parcelas: 1,
      recorrente: false,
      mesPrimeira: "2026-11",
      mesFim: null,
      data: "2026-10-20",
    });
    if (pagas.includes(i)) {
      d.lancamentos.push({
        id: `l${i}`,
        perfilId: "eu",
        larId: null,
        refTipo: "fatura",
        refId: id,
        mes: "2026-11",
        valor: null,
        pago: true,
        pulado: false,
      });
    }
  });
  return d;
}

describe("mês que o app mostra ao abrir", () => {
  it("antes do último vencimento, com fatura em aberto: o mês de hoje", () => {
    expect(mesDeReferencia(comFaturas([7, 9]), "eu", "2026-11-08")).toBe("2026-11");
  });

  it("depois do último vencimento dos cartões: o mês seguinte", () => {
    expect(mesDeReferencia(comFaturas([7, 9]), "eu", "2026-11-10")).toBe("2026-12");
  });

  it("com todas as faturas pagas, mesmo antes do vencimento: o mês seguinte", () => {
    expect(mesDeReferencia(comFaturas([7, 9], [0, 1]), "eu", "2026-11-03")).toBe("2026-12");
    expect(mesDeReferencia(comFaturas([7, 9], [0]), "eu", "2026-11-03")).toBe("2026-11");
  });

  it("sem fatura no mês: o mês de hoje", () => {
    const d = dadosVazios();
    expect(mesDeReferencia(d, "eu", "2026-11-30")).toBe("2026-11");
  });

  it("cartões de outra pessoa não contam", () => {
    const d = comFaturas([7]);
    d.cartoes[0].perfilId = "outra";
    expect(mesDeReferencia(d, "eu", "2026-11-20")).toBe("2026-11");
  });
});
