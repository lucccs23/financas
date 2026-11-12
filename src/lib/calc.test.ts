import { describe, expect, it } from "vitest";
import {
  alertas,
  gastosPorCategoria,
  registrarRenda,
  rendaNoMes,
  dividir,
  faturaDoMes,
  itensDoMes,
  limiteUsado,
  mesPrimeiraFatura,
  numeroParcela,
  ocorreNoMes,
  resumoCasa,
  resumoMoradia,
  resumoPessoal,
  sugerirTransferencias,
  valorParcela,
} from "./calc";
import { addMes, diffMes, diasNoMes } from "./meses";
import { dadosVazios, type Compra, type Conta, type Dados, type Morador } from "./types";

const MES = "2026-12";

function conta(p: Partial<Conta> & { id: string; valor: number }): Conta {
  return {
    perfilId: null,
    larId: null,
    natureza: "despesa",
    nome: p.id,
    diaVencimento: 5,
    recorrente: true,
    mesInicio: "2026-01",
    mesFim: null,
    estimada: false,
    moradia: false,
    categoria: "outros",
    pagadorId: null,
    participantes: null,
    ...p,
  };
}

function morador(id: string, p: Partial<Morador> = {}): Morador {
  return {
    id,
    larId: "lar",
    nome: id,
    cor: 0,
    perfilId: null,
    peso: 1,
    salarioCompartilhado: null,
    ...p,
  };
}

function compra(p: Partial<Compra> & { id: string; valor: number }): Compra {
  return {
    cartaoId: "k1",
    perfilId: "eu",
    larId: null,
    descricao: p.id,
    parcelas: 1,
    recorrente: false,
    mesPrimeira: MES,
    mesFim: null,
    data: "2026-11-20",
    ...p,
  };
}

/** Cenário da tela de referência: duas pessoas, casa dividida meio a meio. */
function cenarioReferencia(): Dados {
  const d = dadosVazios();
  d.perfis = [{ id: "eu", nome: "Eu", cor: 0, salario: 2_800_000, orcamentoDiaADia: 50_000 }];
  d.lares = [{ id: "lar", nome: "Casa", codigo: "ABC123", criadoPor: "eu" }];
  d.moradores = [morador("m-eu", { perfilId: "eu" }), morador("m-outra", { cor: 1 })];
  const casa = { larId: "lar" };
  d.contas = [
    conta({ id: "aluguel", valor: 480_000, pagadorId: "m-outra", moradia: true, ...casa }),
    conta({ id: "reserva", valor: 400_000, pagadorId: "m-eu", ...casa }),
    conta({ id: "apartamento", valor: 233_254, pagadorId: "m-outra", moradia: true, estimada: true, ...casa }),
    conta({ id: "cartao-casa", valor: 215_000, pagadorId: "m-eu", moradia: true, ...casa }),
    conta({ id: "condominio", valor: 158_000, pagadorId: "m-eu", moradia: true, ...casa }),
    conta({ id: "luz", valor: 34_000, pagadorId: "m-eu", moradia: true, ...casa }),
    conta({ id: "internet", valor: 12_990, pagadorId: "m-eu", moradia: true, ...casa }),
    conta({ id: "pessoais", valor: 1_452_950, perfilId: "eu" }),
  ];
  return d;
}

describe("meses", () => {
  it("soma e subtrai atravessando o ano", () => {
    expect(addMes("2026-12", 1)).toBe("2027-01");
    expect(addMes("2026-01", -1)).toBe("2025-12");
    expect(addMes("2026-03", 14)).toBe("2027-05");
    expect(diffMes("2027-02", "2026-12")).toBe(2);
    expect(diasNoMes("2028-02")).toBe(29);
  });
});

describe("recorrência", () => {
  it("conta única só vale no próprio mês", () => {
    const c = { recorrente: false, mesInicio: MES, mesFim: null };
    expect(ocorreNoMes(c, MES)).toBe(true);
    expect(ocorreNoMes(c, "2027-01")).toBe(false);
  });
  it("conta fixa respeita início e fim", () => {
    const c = { recorrente: true, mesInicio: "2026-03", mesFim: "2026-06" };
    expect(ocorreNoMes(c, "2026-02")).toBe(false);
    expect(ocorreNoMes(c, "2026-03")).toBe(true);
    expect(ocorreNoMes(c, "2026-06")).toBe(true);
    expect(ocorreNoMes(c, "2026-07")).toBe(false);
  });
});

describe("divisão", () => {
  it("nunca perde nem cria centavo", () => {
    const partes = dividir(10_000, [["a", 1], ["b", 1], ["c", 1]]);
    expect(partes).toEqual({ a: 3_334, b: 3_333, c: 3_333 });
    expect(Object.values(partes).reduce((x, y) => x + y, 0)).toBe(10_000);
  });
  it("respeita pesos diferentes", () => {
    expect(dividir(100_000, [["a", 2], ["b", 1], ["c", 1]])).toEqual({
      a: 50_000,
      b: 25_000,
      c: 25_000,
    });
  });
  it("ignora quem tem peso zero", () => {
    expect(dividir(9_000, [["a", 1], ["b", 0], ["c", 2]])).toEqual({ a: 3_000, c: 6_000 });
  });
});

describe("cenário da referência (duas pessoas, meio a meio)", () => {
  const d = cenarioReferencia();
  const casa = resumoCasa(d, MES)!;

  it("total das contas da casa", () => {
    expect(casa.total).toBe(1_533_244);
  });
  it("quanto cada um paga do bolso", () => {
    expect(casa.porMorador["m-eu"].pagou).toBe(819_990);
    expect(casa.porMorador["m-outra"].pagou).toBe(713_254);
  });
  it("parte justa de cada um", () => {
    expect(casa.porMorador["m-eu"].parte).toBe(766_622);
    expect(casa.porMorador["m-outra"].parte).toBe(766_622);
  });
  it("acerto: a outra pessoa devolve 533,68", () => {
    expect(casa.pendentes).toEqual([{ deId: "m-outra", paraId: "m-eu", valor: 53_368 }]);
  });
  it("saldo previsto: 28.000 − 7.666,22 − 14.529,50 − 500 = 5.304,28", () => {
    const r = resumoPessoal(d, "eu", MES);
    expect(r.parteCasa).toBe(766_622);
    expect(r.pessoais).toBe(1_452_950);
    expect(r.sobra).toBe(530_428);
    expect(Math.round((r.fracaoSobra ?? 0) * 100)).toBe(19);
  });
  it("moradia: 5.666,22, 20% do salário", () => {
    const m = resumoMoradia(d, "eu", MES, "meu");
    expect(m.total).toBe(566_622);
    expect(Math.round((m.fracao ?? 0) * 100)).toBe(20);
  });
  it("acerto marcado como feito some da lista de pendentes", () => {
    const depois: Dados = {
      ...d,
      acertos: [
        { id: "a1", larId: "lar", mes: MES, deId: "m-outra", paraId: "m-eu", valor: 53_368, feitoEm: "2026-12-06" },
      ],
    };
    const r = resumoCasa(depois, MES)!;
    expect(r.pendentes).toEqual([]);
    expect(r.porMorador["m-eu"].saldo).toBe(0);
  });
});

describe("casa com quatro moradores", () => {
  const d = dadosVazios();
  d.perfis = [{ id: "eu", nome: "Eu", cor: 0, salario: 500_000, orcamentoDiaADia: 0 }];
  d.lares = [{ id: "lar", nome: "Casa", codigo: "XYZ789", criadoPor: "eu" }];
  d.moradores = [
    morador("eu-m", { perfilId: "eu" }),
    morador("mae"),
    morador("ana"),
    morador("bia"),
  ];
  d.contas = [
    conta({ id: "aluguel", valor: 240_000, larId: "lar", pagadorId: "eu-m" }),
    conta({ id: "mercado", valor: 160_000, larId: "lar", pagadorId: "mae" }),
    conta({ id: "luz", valor: 34_001, larId: "lar", pagadorId: "ana" }),
    // Internet só entre quem usa: eu e Ana.
    conta({ id: "internet", valor: 12_990, larId: "lar", pagadorId: "eu-m", participantes: { "eu-m": 1, ana: 1 } }),
  ];
  const casa = resumoCasa(d, MES)!;
  const s = casa.porMorador;

  it("as partes somam exatamente o total", () => {
    const partes = Object.values(s).reduce((x, m) => x + m.parte, 0);
    expect(partes).toBe(casa.total);
    expect(casa.total).toBe(446_991);
  });
  it("conta com participantes próprios não cobra os outros", () => {
    const internet = casa.linhas.find((l) => l.item.nome === "internet")!;
    expect(internet.partes).toEqual({ "eu-m": 6_495, ana: 6_495 });
  });
  it("os saldos somam zero", () => {
    expect(Object.values(s).reduce((x, m) => x + m.saldo, 0)).toBe(0);
  });
  it("os Pix sugeridos zeram todo mundo", () => {
    const saldo = Object.fromEntries(Object.entries(s).map(([id, m]) => [id, m.saldo]));
    for (const t of casa.pendentes) {
      saldo[t.deId] += t.valor;
      saldo[t.paraId] -= t.valor;
    }
    expect(Object.values(saldo).every((v) => v === 0)).toBe(true);
    expect(casa.pendentes.length).toBeLessThanOrEqual(3);
  });
  it("morador com peso zero não entra na divisão padrão", () => {
    const comZero: Dados = {
      ...d,
      moradores: d.moradores.map((m) => (m.id === "bia" ? { ...m, peso: 0 } : m)),
    };
    const r = resumoCasa(comZero, MES)!;
    expect(r.porMorador.bia.parte).toBe(0);
    expect(Object.values(r.porMorador).reduce((x, m) => x + m.parte, 0)).toBe(r.total);
  });
  it("conta sem pagador entra no total, mas fica fora do acerto", () => {
    const semPagador: Dados = {
      ...d,
      contas: [...d.contas, conta({ id: "gas", valor: 12_000, larId: "lar" })],
    };
    const r = resumoCasa(semPagador, MES)!;
    expect(r.semPagador).toBe(12_000);
    expect(Object.values(r.porMorador).reduce((x, m) => x + m.saldo, 0)).toBe(0);
  });
});

describe("transferências", () => {
  it("um devedor paga dois credores", () => {
    expect(sugerirTransferencias([["a", -300], ["b", 100], ["c", 200]])).toEqual([
      { deId: "a", paraId: "c", valor: 200 },
      { deId: "a", paraId: "b", valor: 100 },
    ]);
  });
  it("sem saldos, sem transferências", () => {
    expect(sugerirTransferencias([["a", 0], ["b", 0]])).toEqual([]);
  });
});

describe("cartões", () => {
  it("parcelas somam o total, com os centavos nas primeiras", () => {
    const c = compra({ id: "tv", valor: 100_000, parcelas: 3 });
    const valores = [0, 1, 2].map((i) => valorParcela(c, addMes(MES, i)));
    expect(valores).toEqual([33_334, 33_333, 33_333]);
    expect(valorParcela(c, addMes(MES, 3))).toBe(0);
    expect(valorParcela(c, addMes(MES, -1))).toBe(0);
    expect(numeroParcela(c, addMes(MES, 1))).toBe(2);
  });
  it("assinatura cobra todo mês até o fim", () => {
    const c = compra({ id: "stream", valor: 3_990, recorrente: true, mesFim: "2027-02" });
    expect(valorParcela(c, "2027-01")).toBe(3_990);
    expect(valorParcela(c, "2027-03")).toBe(0);
  });
  it("fatura soma as parcelas do mês", () => {
    const compras = [
      compra({ id: "a", valor: 60_000, parcelas: 2 }),
      compra({ id: "b", valor: 5_000 }),
      compra({ id: "c", valor: 9_000, cartaoId: "outro" }),
    ];
    expect(faturaDoMes("k1", compras, MES)).toBe(35_000);
    expect(faturaDoMes("k1", compras, addMes(MES, 1))).toBe(30_000);
  });
  it("define a fatura pela data de fechamento", () => {
    const k = { diaFechamento: 28, diaVencimento: 5 };
    expect(mesPrimeiraFatura(k, "2026-11-20")).toBe("2026-12");
    expect(mesPrimeiraFatura(k, "2026-11-29")).toBe("2027-01");
    const mesmoMes = { diaFechamento: 3, diaVencimento: 10 };
    expect(mesPrimeiraFatura(mesmoMes, "2026-11-02")).toBe("2026-11");
    expect(mesPrimeiraFatura(mesmoMes, "2026-11-04")).toBe("2026-12");
  });
  it("fatura vira conta a pagar e libera limite quando paga", () => {
    const d = dadosVazios();
    d.perfis = [{ id: "eu", nome: "Eu", cor: 0, salario: 0, orcamentoDiaADia: 0 }];
    const cartao = {
      id: "k1", perfilId: "eu", larId: null, nome: "Principal", banco: "Banco",
      cor: 0, limite: 500_000, diaFechamento: 28, diaVencimento: 5,
    };
    d.cartoes = [cartao];
    d.compras = [compra({ id: "tv", valor: 300_000, parcelas: 3 })];
    expect(itensDoMes(d, MES).map((i) => [i.nome, i.valor])).toEqual([["Fatura Principal", 100_000]]);
    expect(limiteUsado(cartao, d, MES)).toBe(300_000);
    d.lancamentos = [
      { id: "l1", perfilId: "eu", larId: null, refTipo: "fatura", refId: "k1", mes: MES, valor: null, pago: true, pulado: false },
    ];
    expect(limiteUsado(cartao, d, MES)).toBe(200_000);
  });
});

describe("valores por mês e avisos", () => {
  const d = dadosVazios();
  d.perfis = [{ id: "eu", nome: "Eu", cor: 0, salario: 0, orcamentoDiaADia: 0 }];
  d.contas = [
    conta({ id: "luz", valor: 30_000, perfilId: "eu", diaVencimento: 12, estimada: true }),
    conta({ id: "academia", valor: 12_000, perfilId: "eu", diaVencimento: 31 }),
  ];

  it("valor real do mês substitui o estimado", () => {
    const comValor: Dados = {
      ...d,
      lancamentos: [
        { id: "l1", perfilId: "eu", larId: null, refTipo: "conta", refId: "luz", mes: MES, valor: 34_210, pago: false, pulado: false },
      ],
    };
    const luz = itensDoMes(comValor, MES).find((i) => i.nome === "luz")!;
    expect(luz.valor).toBe(34_210);
    expect(luz.estimada).toBe(false);
    expect(itensDoMes(comValor, "2027-01").find((i) => i.nome === "luz")!.valor).toBe(30_000);
  });
  it("mês pulado tira a conta da lista", () => {
    const pulada: Dados = {
      ...d,
      lancamentos: [
        { id: "l1", perfilId: "eu", larId: null, refTipo: "conta", refId: "luz", mes: MES, valor: null, pago: false, pulado: true },
      ],
    };
    expect(itensDoMes(pulada, MES).map((i) => i.nome)).toEqual(["academia"]);
  });
  it("vencimento no dia 31 cai no último dia em mês curto", () => {
    expect(itensDoMes(d, "2027-02").find((i) => i.nome === "academia")!.dia).toBe(28);
  });
  it("avisa o que vence em até 5 dias e o que atrasou", () => {
    const lista = alertas(d, "eu", "2026-12-10");
    // Novembro inteiro ficou aberto (atrasado) e a luz de dezembro vence em 2 dias.
    expect(lista.map((a) => [a.item.nome, a.mes, a.dias])).toEqual([
      ["luz", "2026-11", -28],
      ["academia", "2026-11", -10],
      ["luz", "2026-12", 2],
    ]);
  });
});

describe("histórico de renda", () => {
  const base = { salario: 500_000, orcamentoDiaADia: 50_000, historico: null };

  it("sem histórico, vale o valor atual em todos os meses", () => {
    expect(rendaNoMes(base, "2020-01")).toEqual({ salario: 500_000, diaADia: 50_000 });
  });
  it("aumento a partir de um mês não muda os meses anteriores", () => {
    const historico = registrarRenda(base, "2026-11", 600_000, 60_000);
    const p = { ...base, salario: 600_000, orcamentoDiaADia: 60_000, historico };
    expect(rendaNoMes(p, "2026-10")).toEqual({ salario: 500_000, diaADia: 50_000 });
    expect(rendaNoMes(p, "2026-11")).toEqual({ salario: 600_000, diaADia: 60_000 });
    expect(rendaNoMes(p, "2027-05")).toEqual({ salario: 600_000, diaADia: 60_000 });
  });
  it("registrar de novo num mês anterior descarta as mudanças posteriores", () => {
    const h1 = registrarRenda(base, "2026-11", 600_000, 50_000);
    const h2 = registrarRenda({ ...base, historico: h1 }, "2026-09", 550_000, 50_000);
    expect(h2.map((h) => [h.desde, h.salario])).toEqual([
      ["0000-01", 500_000],
      ["2026-09", 550_000],
    ]);
  });
  it("o saldo previsto usa o salário de cada mês", () => {
    const d = dadosVazios();
    d.perfis = [
      {
        id: "eu",
        nome: "Eu",
        cor: 0,
        salario: 600_000,
        orcamentoDiaADia: 0,
        historico: registrarRenda(base, "2026-11", 600_000, 0),
      },
    ];
    expect(resumoPessoal(d, "eu", "2026-10").renda).toBe(500_000);
    expect(resumoPessoal(d, "eu", "2026-11").renda).toBe(600_000);
  });
});

describe("gastos por categoria", () => {
  const d = cenarioReferencia();
  d.perfis[0].orcamentoDiaADia = 50_000;
  d.cartoes = [
    { id: "k1", perfilId: "eu", larId: null, nome: "Cartão", banco: "", cor: 0, limite: 0, diaFechamento: 28, diaVencimento: 5 },
  ];
  d.compras = [
    compra({ id: "mercado", valor: 30_000, categoria: "mercado" }),
    compra({ id: "cinema", valor: 10_000, categoria: "lazer" }),
  ];
  const g = Object.fromEntries(gastosPorCategoria(d, "eu", MES).map((x) => [x.categoria, x.valor]));

  it("abre a fatura pelas categorias das compras", () => {
    expect(g.mercado).toBe(30_000);
    expect(g.lazer).toBe(10_000);
    expect(g.cartao).toBeUndefined();
  });
  it("usa a parte da pessoa nas contas da casa", () => {
    // No cenário todas as contas são "outros": parte da casa (7.666,22) + pessoais (14.529,50).
    expect(g.outros).toBe(766_622 + 1_452_950);
  });
  it("soma exatamente as saídas do mês", () => {
    const total = Object.values(g).reduce((a, b) => a + b, 0);
    expect(total).toBe(resumoPessoal(d, "eu", MES).saidas);
  });
});
