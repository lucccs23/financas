import { faturaDoMes } from "./calc";
import { describe, expect, it } from "vitest";
import { gastosPorCategoria, resumoPessoal } from "./calc";
import {
  lancamentosDaCategoria,
  agruparPorDia,
  composicaoFatura,
  dicasDoMes,
  patrimonio,
  recorrentesPorMes,
  resultadoDoMes,
  ritmoDeGasto,
  saldoCarteira,
} from "./calc-extra";
import { dadosVazios, type Carteira, type Compra, type Dados, type Transacao } from "./types";

const MES = "2026-11";
const R = (n: number) => Math.round(n * 100);

function t(p: Partial<Transacao> & { valor: number; data: string }): Transacao {
  return {
    id: Math.random().toString(36).slice(2),
    perfilId: "eu",
    descricao: "x",
    tipo: "saida",
    categoria: "outros",
    carteiraId: null,
    carteiraDestinoId: null,
    observacao: "",
    ...p,
  };
}

function base(): Dados {
  const d = dadosVazios();
  d.perfis = [{ id: "eu", nome: "Eu", cor: 0, salario: R(5000), orcamentoDiaADia: R(900) }];
  return d;
}

describe("gastos avulsos no resumo do mês", () => {
  it("dentro da reserva: o dia a dia conta pelo reservado", () => {
    const d = base();
    d.transacoes = [t({ valor: R(300), data: "2026-11-05" })];
    const r = resumoPessoal(d, "eu", MES);
    expect(r.gastoAvulso).toBe(R(300));
    expect(r.diaADia).toBe(R(900));
    expect(r.sobra).toBe(R(5000 - 900));
  });
  it("acima da reserva: conta pelo que saiu", () => {
    const d = base();
    d.transacoes = [t({ valor: R(1200), data: "2026-11-05" })];
    expect(resumoPessoal(d, "eu", MES).diaADia).toBe(R(1200));
  });
  it("entradas avulsas somam na renda; transferências não mexem em nada", () => {
    const d = base();
    d.transacoes = [
      t({ valor: R(250), data: "2026-11-02", tipo: "entrada" }),
      t({ valor: R(999), data: "2026-11-02", tipo: "transferencia" }),
    ];
    const r = resumoPessoal(d, "eu", MES);
    expect(r.renda).toBe(R(5250));
    expect(r.gastoAvulso).toBe(0);
  });
  it("categorias: gastos avulsos pela categoria e o resto da reserva como dia a dia", () => {
    const d = base();
    d.transacoes = [
      t({ valor: R(200), data: "2026-11-03", categoria: "lazer" }),
      t({ valor: R(100), data: "2026-11-04", categoria: "transporte" }),
    ];
    const g = Object.fromEntries(gastosPorCategoria(d, "eu", MES).map((x) => [x.categoria, x.valor]));
    expect(g).toEqual({ lazer: R(200), transporte: R(100), "dia-a-dia": R(600) });
    const total = Object.values(g).reduce((a, b) => a + b, 0);
    expect(total).toBe(resumoPessoal(d, "eu", MES).saidas);
  });
});

describe("ritmo de gasto", () => {
  const d = base();
  d.transacoes = [
    t({ valor: R(100), data: "2026-11-01" }),
    t({ valor: R(200), data: "2026-11-05" }),
    t({ valor: R(50), data: "2026-11-20" }),
  ];
  it("no meio do mês", () => {
    const r = ritmoDeGasto(d, "eu", MES, "2026-11-10");
    expect(r.gasto).toBe(R(350));
    expect(r.restante).toBe(R(550));
    expect(r.acumulado).toHaveLength(10);
    expect(r.acumulado[0]).toBe(R(100));
    expect(r.acumulado[9]).toBe(R(300)); // o gasto do dia 20 ainda não aconteceu na linha
    expect(r.ideal).toBe(R(300));
    // 21 dias restantes contando hoje: 550 / 21
    expect(r.porDia).toBe(Math.floor(R(550) / 21));
  });
  it("mês passado mostra o mês inteiro; mês futuro não tem linha", () => {
    expect(ritmoDeGasto(d, "eu", MES, "2026-12-03").acumulado).toHaveLength(30);
    expect(ritmoDeGasto(d, "eu", MES, "2026-10-03").acumulado).toHaveLength(0);
  });
});

describe("carteiras e patrimônio", () => {
  const conta: Carteira = { id: "c1", perfilId: "eu", nome: "Banco", tipo: "corrente", saldoInicial: R(1000), cor: 0, arquivada: false };
  const bolso: Carteira = { id: "c2", perfilId: "eu", nome: "Carteira", tipo: "dinheiro", saldoInicial: 0, cor: 1, arquivada: false };
  const lista = [
    t({ valor: R(300), data: "2026-11-01", carteiraId: "c1" }),
    t({ valor: R(500), data: "2026-11-02", carteiraId: "c1", tipo: "entrada" }),
    t({ valor: R(200), data: "2026-11-03", carteiraId: "c1", tipo: "transferencia", carteiraDestinoId: "c2" }),
  ];
  it("saldo soma entradas, tira saídas e move transferências", () => {
    expect(saldoCarteira(conta, lista)).toBe(R(1000 - 300 + 500 - 200));
    expect(saldoCarteira(bolso, lista)).toBe(R(200));
    expect(saldoCarteira(conta, lista, "2026-11-01")).toBe(R(700));
  });
  it("patrimônio = carteiras + reserva − o que falta pagar nos cartões", () => {
    const d = base();
    d.carteiras = [conta, bolso, { ...bolso, id: "c3", saldoInicial: R(9999), arquivada: true }];
    d.transacoes = lista;
    d.metas = [{ id: "m", perfilId: "eu", larId: null, nome: "Reserva", alvo: 0, cor: 0 }];
    d.aportes = [{ id: "a", metaId: "m", perfilId: "eu", larId: null, valor: R(400), data: "2026-10-01", descricao: "" }];
    d.cartoes = [{ id: "k", perfilId: "eu", larId: null, nome: "K", banco: "", cor: 0, limite: 0, diaFechamento: 28, diaVencimento: 5 }];
    d.compras = [{ id: "x", cartaoId: "k", perfilId: "eu", larId: null, descricao: "TV", valor: R(600), parcelas: 3, recorrente: false, mesPrimeira: MES, mesFim: null, data: "2026-10-20" }];
    const p = patrimonio(d, "eu", MES);
    expect(p).toEqual({ carteiras: R(1200), reserva: R(400), dividaCartoes: R(600), total: R(1000) });
  });
});

describe("resultado, recorrentes e fatura", () => {
  it("resultado compara com o mês anterior", () => {
    const d = base();
    d.transacoes = [t({ valor: R(1400), data: "2026-10-10" })];
    const r = resultadoDoMes(d, "eu", MES);
    expect(r.resultado).toBe(R(4100));
    expect(r.anterior).toBe(R(3600));
    expect(r.variacao).toBeCloseTo(500 / 3600, 5);
  });

  const compras: Compra[] = [
    { id: "p", cartaoId: "k", perfilId: "eu", larId: null, descricao: "Celular", valor: R(900), parcelas: 3, recorrente: false, mesPrimeira: "2026-10", mesFim: null, data: "2026-09-20" },
    { id: "s", cartaoId: "k", perfilId: "eu", larId: null, descricao: "Música", valor: R(20), parcelas: 1, recorrente: true, mesPrimeira: "2026-01", mesFim: null, data: "2025-12-20" },
    { id: "v", cartaoId: "k", perfilId: "eu", larId: null, descricao: "Lanche", valor: R(45), parcelas: 1, recorrente: false, mesPrimeira: MES, mesFim: null, data: "2026-10-22" },
  ];
  it("composição da fatura separa parcelas, assinaturas e avulsas", () => {
    expect(composicaoFatura({ id: "k" }, compras, MES)).toEqual({
      parcelas: R(300),
      assinaturas: R(20),
      avulsas: R(45),
      total: R(365),
      novas: R(45),
      herdadas: R(300),
      estornos: 0,
    });
  });
  it("parcela vinda do banco conta como parcela (e de meses anteriores, se não for a primeira)", () => {
    const doBanco = (id: string, descricao: string, valor: number) => ({
      ...compras[0], id, descricao, valor, parcelas: 1, recorrente: false, mesPrimeira: MES, mesFim: null,
    });
    const c = composicaoFatura(
      { id: "k" },
      [doBanco("a", "Loja · parcela 3/10", R(100)), doBanco("b", "Mercado", R(50)), doBanco("c", "Tênis · parcela 1/5", R(40))],
      MES,
    );
    expect(c).toMatchObject({ parcelas: R(140), avulsas: R(50), novas: R(90), herdadas: R(100), total: R(190) });
  });
  it("lista o que forma uma categoria: transações, compras do cartão e contas", () => {
    const d = base();
    d.cartoes = [{ id: "k", perfilId: "eu", larId: null, nome: "Gold", banco: "Nubank", cor: 0, limite: 0, diaFechamento: 28, diaVencimento: 5 }];
    d.compras = [
      { ...compras[0], id: "c1", descricao: "Mercado X · parcela 2/3", valor: R(30), parcelas: 1, recorrente: false, mesPrimeira: MES, mesFim: null, categoria: "mercado" },
      { ...compras[0], id: "c2", descricao: "Cinema", valor: R(40), parcelas: 1, recorrente: false, mesPrimeira: MES, mesFim: null, categoria: "lazer" },
    ];
    d.transacoes = [
      t({ valor: R(12), data: `${MES}-03`, categoria: "mercado", descricao: "Padaria" }),
      t({ valor: R(99), data: `${MES}-04`, categoria: "mercado", descricao: "Entre contas", soSaldo: true }),
    ];
    const l = lancamentosDaCategoria(d, "eu", MES, "mercado");
    expect(l.map((x) => [x.descricao, x.valor, x.origem])).toEqual([
      ["Mercado X", R(30), "Nubank Gold"],
      ["Padaria", R(12), "Transação"],
    ]);
  });
  it("estorno abate o total sem bagunçar a composição", () => {
    const estorno = { ...compras[0], id: "est", descricao: "Estorno", valor: -R(15), parcelas: 1, recorrente: false, mesPrimeira: MES, mesFim: null };
    const c = composicaoFatura({ id: "k" }, [...compras, estorno], MES);
    expect(c).toMatchObject({ estornos: -R(15), total: R(350), avulsas: R(45), novas: R(45) });
    expect(faturaDoMes("k", [...compras, estorno], MES)).toBe(c.total);
  });
  it("recorrentes dos próximos meses", () => {
    const d = base();
    d.cartoes = [{ id: "k", perfilId: "eu", larId: null, nome: "K", banco: "", cor: 0, limite: 0, diaFechamento: 28, diaVencimento: 5 }];
    d.compras = compras;
    d.contas = [{ id: "acad", perfilId: "eu", larId: null, natureza: "despesa", nome: "Academia", valor: R(100), diaVencimento: 5, recorrente: true, mesInicio: "2026-01", mesFim: null, estimada: false, moradia: false, categoria: "saude", pagadorId: null, participantes: null }];
    expect(recorrentesPorMes(d, "eu", ["2026-11", "2026-12", "2027-01"])).toEqual([
      { mes: "2026-11", contasFixas: R(100), parcelas: R(320) },
      { mes: "2026-12", contasFixas: R(100), parcelas: R(320) },
      { mes: "2027-01", contasFixas: R(100), parcelas: R(20) },
    ]);
  });
  it("agrupa transações por dia, do mais recente", () => {
    const g = agruparPorDia([t({ valor: 1, data: "2026-11-01" }), t({ valor: 2, data: "2026-11-03" }), t({ valor: 3, data: "2026-11-01" })]);
    expect(g.map((x) => [x.data, x.itens.length])).toEqual([["2026-11-03", 1], ["2026-11-01", 2]]);
  });
});

describe("dicas", () => {
  const fmt = (c: number) => `R$ ${(c / 100).toFixed(2)}`;
  it("avisa quando o ritmo de gasto está alto e quando a categoria subiu", () => {
    const d = base();
    d.transacoes = [
      t({ valor: R(600), data: "2026-11-05", categoria: "lazer" }),
      t({ valor: R(100), data: "2026-10-05", categoria: "lazer" }),
    ];
    const ids = dicasDoMes(d, "eu", MES, "2026-11-10", fmt, (c) => c).map((x) => x.id);
    expect(ids).toContain("ritmo");
    expect(ids).toContain("categoria");
  });
  it("elogia quando está tudo dentro do planejado", () => {
    const d = base();
    d.transacoes = [t({ valor: R(100), data: "2026-11-05" })];
    const dicas = dicasDoMes(d, "eu", MES, "2026-11-10", fmt, (c) => c);
    expect(dicas[0]).toMatchObject({ id: "no-ritmo", tom: "bom" });
  });
});

describe("limite do cartão conferido com o banco", () => {
  it("informar o disponível do banco ajusta o livre, e novas compras continuam descontando", async () => {
    const { limiteDoCartao, ajusteParaDisponivel } = await import("./calc");
    const d = base();
    const cartao = { id: "k", perfilId: "eu", larId: null, nome: "K", banco: "", cor: 0, limite: R(5000), diaFechamento: 28, diaVencimento: 5 };
    d.cartoes = [cartao];
    d.compras = [{ id: "a", cartaoId: "k", perfilId: "eu", larId: null, descricao: "TV", valor: R(600), parcelas: 3, recorrente: false, mesPrimeira: MES, mesFim: null, data: "2026-10-20" }];
    expect(limiteDoCartao(cartao, d, MES).livre).toBe(R(4400));
    // O banco mostra 4.569,74 disponíveis (há compras que não foram lançadas no app).
    const ajuste = ajusteParaDisponivel(cartao, d, MES, R(4569.74));
    const conferido = { ...cartao, limiteAjuste: ajuste };
    d.cartoes = [conferido];
    expect(limiteDoCartao(conferido, d, MES).livre).toBe(R(4569.74));
    // Nova compra de 100 reduz o disponível.
    d.compras.push({ id: "b", cartaoId: "k", perfilId: "eu", larId: null, descricao: "Livro", valor: R(100), parcelas: 1, recorrente: false, mesPrimeira: "2026-12", mesFim: null, data: "2026-11-11" });
    expect(limiteDoCartao(conferido, d, MES).livre).toBe(R(4469.74));
    // Pagar a fatura de novembro devolve os 200 da parcela.
    d.lancamentos = [{ id: "l", perfilId: "eu", larId: null, refTipo: "fatura", refId: "k", mes: MES, valor: null, pago: true, pulado: false }];
    expect(limiteDoCartao(conferido, d, MES).livre).toBe(R(4669.74));
  });
});
