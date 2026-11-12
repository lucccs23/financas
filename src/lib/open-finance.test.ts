import { describe, expect, it } from "vitest";
import { limiteDoCartao, movimentoAvulso, faturaDoMes } from "./calc";
import { saldoCarteira } from "./calc-extra";
import {
  aplicarOpenFinance,
  categoriaDaPluggy,
  categoriaDoMcc,
  entreContasDoDono,
  nomeBonito,
  nomeDoBanco,
  semParcela,
  type ConexaoBuscada,
  type ContaPluggy,
  type TransacaoPluggy,
} from "./open-finance";
import { dadosVazios, type Dados } from "./types";

const HOJE = "2026-11-11";

function base(): Dados {
  const d = dadosVazios();
  d.perfis.push({ id: "eu", nome: "Eu", cor: 0, salario: 300_000, orcamentoDiaADia: 50_000 });
  return d;
}

const corrente: ContaPluggy = {
  id: "conta-1",
  type: "BANK",
  subtype: "CHECKING_ACCOUNT",
  name: "Conta corrente",
  balance: 1234.56,
};

const cartao: ContaPluggy = {
  id: "cartao-1",
  type: "CREDIT",
  subtype: "CREDIT_CARD",
  name: "Cartão Gold",
  balance: 0,
  creditData: {
    creditLimit: 5000,
    availableCreditLimit: 4100,
    balanceCloseDate: "2026-11-03",
    balanceDueDate: "2026-11-10",
  },
};

const tx = (t: Partial<TransacaoPluggy> & Pick<TransacaoPluggy, "id" | "amount">): TransacaoPluggy => ({
  date: "2026-11-05",
  description: "Algo",
  type: t.amount < 0 ? "DEBIT" : "CREDIT",
  status: "POSTED",
  category: null,
  ...t,
});

const conexao = (contas: ConexaoBuscada["contas"]): ConexaoBuscada[] => [
  { perfilId: "eu", banco: "Banco Teste", contas },
];

describe("Open Finance", () => {
  it("cria a carteira com o saldo do banco e não repete nada na segunda vez", () => {
    const d = base();
    const extrato = [
      tx({ id: "a", amount: -42.5, description: "IFOOD *LANCHE", category: "Food delivery" }),
      tx({ id: "b", amount: 150, description: "PIX RECEBIDO FULANO", category: "Transfer - PIX" }),
    ];
    const r1 = aplicarOpenFinance(d, conexao([{ conta: corrente, transacoes: extrato }]), HOJE);
    expect(r1).toMatchObject({ carteirasNovas: 1, transacoes: 2 });

    const carteira = d.carteiras[0];
    expect(carteira).toMatchObject({ nome: "Banco Teste", tipo: "corrente", externoId: "conta-1" });
    expect(saldoCarteira(carteira, d.transacoes)).toBe(123_456);
    expect(d.transacoes.find((t) => t.externoId === "a")).toMatchObject({
      tipo: "saida",
      valor: 4250,
      categoria: "alimentacao",
      soSaldo: false,
    });

    const r2 = aplicarOpenFinance(d, conexao([{ conta: corrente, transacoes: extrato }]), HOJE);
    expect(r2).toMatchObject({ carteirasNovas: 0, transacoes: 0 });
    expect(d.transacoes).toHaveLength(2);
    expect(saldoCarteira(carteira, d.transacoes)).toBe(123_456);
  });

  it("dinheiro entre contas suas (mesmo nome ou CPF) fica só no saldo, sem virar renda", () => {
    const minha = { ...corrente, owner: "Lucas Martins Martinez", taxNumber: "123.456.789-00" };
    const deMim = tx({
      id: "m1",
      amount: 20,
      description: "Transferência Recebida|LUCAS MARTINS MARTINEZ",
      category: "Transfer - PIX",
    });
    const daIrma = tx({
      id: "m2",
      amount: 63,
      description: "Transferência Recebida|Mariane Caroline Martinez",
      category: "Transfer - PIX",
      paymentData: { payer: { name: "Mariane Caroline Martinez", documentNumber: { value: "987.654.321-00" } } },
    });
    const pixPraMim = tx({
      id: "m3",
      amount: -90,
      description: "Pix enviado",
      paymentData: { receiver: { name: "Outro Nome", documentNumber: { value: "12345678900" } } },
    });
    expect(entreContasDoDono(deMim, minha)).toBe(true);
    expect(entreContasDoDono(daIrma, minha)).toBe(false);
    expect(entreContasDoDono(pixPraMim, minha)).toBe(true);

    const d = base();
    aplicarOpenFinance(d, conexao([{ conta: minha, transacoes: [deMim, daIrma, pixPraMim] }]), HOJE);
    const so = (id: string) => d.transacoes.find((t) => t.externoId === id)?.soSaldo;
    expect([so("m1"), so("m2"), so("m3")]).toEqual([true, false, true]);
    expect(movimentoAvulso(d.transacoes, "eu", "2026-11").entradas).toBe(6300);
  });

  it("ignora o que ainda está pendente no banco", () => {
    const d = base();
    aplicarOpenFinance(
      d,
      conexao([{ conta: corrente, transacoes: [tx({ id: "p", amount: -10, status: "PENDING" })] }]),
      HOJE,
    );
    expect(d.transacoes).toHaveLength(0);
  });

  it("não conta em dobro: salário do perfil, fatura paga e dinheiro entre contas suas", () => {
    const d = base();
    aplicarOpenFinance(
      d,
      conexao([
        {
          conta: corrente,
          transacoes: [
            tx({ id: "s", amount: 3000, description: "SALARIO", category: "Salary" }),
            tx({ id: "f", amount: -800, description: "PAGTO FATURA", category: "Credit card payment" }),
            tx({ id: "i", amount: -500, description: "APLICACAO CDB", category: "Fixed income" }),
            tx({ id: "m", amount: -200, description: "PIX MINHA POUPANCA", category: "Same person transfer - PIX" }),
            tx({ id: "g", amount: -30, description: "UBER *TRIP", category: "Taxi and ride-hailing" }),
          ],
        },
      ]),
      HOJE,
    );
    const so = (id: string) => d.transacoes.find((t) => t.externoId === id)?.soSaldo;
    expect([so("s"), so("f"), so("i"), so("m"), so("g")]).toEqual([true, true, true, true, false]);
    // Só o Uber entra no resumo do mês.
    expect(movimentoAvulso(d.transacoes, "eu", "2026-11")).toMatchObject({ entradas: 0, saidas: 3000 });
  });

  it("marca como paga a conta fixa de mesmo valor e não conta o gasto duas vezes", () => {
    const d = base();
    d.contas.push({
      id: "luz",
      perfilId: "eu",
      larId: null,
      natureza: "despesa",
      nome: "Luz",
      valor: 18_990,
      diaVencimento: 10,
      recorrente: true,
      mesInicio: "2026-01",
      mesFim: null,
      estimada: false,
      moradia: true,
      categoria: "luz",
      pagadorId: null,
      participantes: null,
    });
    const r = aplicarOpenFinance(
      d,
      conexao([{ conta: corrente, transacoes: [tx({ id: "l", amount: -189.9, description: "ENEL" })] }]),
      HOJE,
    );
    expect(r.pagas).toBe(1);
    expect(d.lancamentos).toEqual([
      expect.objectContaining({ refTipo: "conta", refId: "luz", mes: "2026-11", pago: true }),
    ]);
    expect(d.transacoes[0]).toMatchObject({ soSaldo: true, observacao: 'Conta "Luz" (marcada como paga)' });
  });

  it("reconhece o que já foi lançado à mão em vez de repetir", () => {
    const d = base();
    d.transacoes.push({
      id: "manual",
      perfilId: "eu",
      data: "2026-11-04",
      descricao: "Lanche",
      valor: 4250,
      tipo: "saida",
      categoria: "alimentacao",
      carteiraId: null,
      carteiraDestinoId: null,
      observacao: "",
    });
    const r = aplicarOpenFinance(
      d,
      conexao([{ conta: corrente, transacoes: [tx({ id: "a", amount: -42.5 })] }]),
      HOJE,
    );
    expect(r).toMatchObject({ ligadas: 1, transacoes: 0 });
    expect(d.transacoes).toHaveLength(1);
    expect(d.transacoes[0]).toMatchObject({ id: "manual", externoId: "a", carteiraId: d.carteiras[0].id });
  });

  it("cartão: cada parcela entra na fatura que o banco indica, e o limite bate com o banco", () => {
    const d = base();
    const parcela = (n: number, mes: string): TransacaoPluggy =>
      tx({
        id: `parc-${n}`,
        amount: -100,
        type: "DEBIT",
        date: `${mes}-02`,
        description: `LOJA X PARC ${String(n).padStart(2, "0")}/10`,
        category: "Clothing",
        creditCardMetadata: {
          installmentNumber: n,
          totalInstallments: 10,
          totalAmount: 1000,
          purchaseDate: "2026-07-20",
          billForecastDate: mes,
        },
      });
    const r = aplicarOpenFinance(
      d,
      conexao([
        {
          conta: cartao,
          transacoes: [
            parcela(3, "2026-09"),
            parcela(4, "2026-10"),
            parcela(5, "2026-11"),
            tx({ id: "uber", amount: 25, type: "DEBIT", date: "2026-11-06", description: "UBER" }),
            tx({ id: "est", amount: 25, type: "CREDIT", date: "2026-11-07", description: "ESTORNO UBER" }),
            tx({ id: "pag", amount: 900, type: "CREDIT", description: "PAGAMENTO RECEBIDO", category: "Credit card payment" }),
          ],
        },
      ]),
      HOJE,
    );
    expect(r).toMatchObject({ cartoesNovos: 1, compras: 5 });
    const k = d.cartoes[0];
    expect(k).toMatchObject({ limite: 500_000, diaFechamento: 3, diaVencimento: 10 });

    const loja = d.compras.filter((c) => c.descricao.startsWith("LOJA X"));
    expect(loja.map((c) => [c.descricao, c.mesPrimeira, c.valor])).toEqual([
      ["LOJA X · parcela 3/10", "2026-09", 10_000],
      ["LOJA X · parcela 4/10", "2026-10", 10_000],
      ["LOJA X · parcela 5/10", "2026-11", 10_000],
    ]);
    expect(loja[0].categoria).toBe("compras");
    // Estorno abate o Uber.
    expect(faturaDoMes(k.id, d.compras, "2026-11")).toBe(10_000);
    // Busca que voltou vazia (falha) não apaga a fatura aberta.
    aplicarOpenFinance(d, conexao([{ conta: cartao, transacoes: [] }]), HOJE);
    expect(faturaDoMes(k.id, d.compras, "2026-11")).toBe(10_000);

    expect(limiteDoCartao(k, d, "2026-11").livre).toBe(410_000);
    expect(k.limiteConferidoEm).toBe(HOJE);
    expect(faturaDoMes(k.id, d.compras, "2026-11")).toBeGreaterThan(0);
  });

  it("descobre o nome do banco e troca nomes genéricos (mas não os que você escolheu)", () => {
    expect(nomeDoBanco([{ name: "Conta", bankData: { transferNumber: "077/0001/1234-5" } }])).toBe("Inter");
    expect(
      nomeDoBanco([{ name: "Nu Pagamentos S.A. - Instituição de Pagamento (Conta Pré-paga)" }]),
    ).toBe("Nubank");
    expect(nomeDoBanco([{ name: "portobank" }])).toBe("Porto Bank");
    // O nome vence o código: a Porto Bank usa o código do Itaú.
    expect(nomeDoBanco([{ name: "portobank", bankData: { transferNumber: "341/0001/1-2" } }])).toBe(
      "Porto Bank",
    );
    expect(nomeDoBanco([{ name: "Conta corrente", bankData: { transferNumber: "0001/123-4" } }])).toBeNull();

    const d = base();
    const generica = { ...corrente, name: "Nu Pagamentos S.A. (Conta Pré-paga)" };
    aplicarOpenFinance(d, [{ perfilId: "eu", banco: "Banco", contas: [{ conta: generica, transacoes: [] }] }], HOJE);
    expect(d.carteiras[0].nome).toBe("Banco");
    aplicarOpenFinance(d, [{ perfilId: "eu", banco: "Nubank", contas: [{ conta: generica, transacoes: [] }] }], HOJE);
    expect(d.carteiras[0].nome).toBe("Nubank");
    // Palpite errado de antes ("Itaú") também é corrigido.
    d.carteiras[0].nome = "Itaú";
    aplicarOpenFinance(d, [{ perfilId: "eu", banco: "Nubank", contas: [{ conta: generica, transacoes: [] }] }], HOJE);
    expect(d.carteiras[0].nome).toBe("Nubank");
    d.carteiras[0].nome = "Minha conta";
    aplicarOpenFinance(d, [{ perfilId: "eu", banco: "Nubank", contas: [{ conta: generica, transacoes: [] }] }], HOJE);
    expect(d.carteiras[0].nome).toBe("Minha conta");
  });

  describe("faturas como os bancos mandam", () => {
    const HOJE2 = "2026-11-12";
    const compra = (
      id: string,
      date: string,
      amount: number,
      rotulo: string,
      extra: Partial<TransacaoPluggy> = {},
    ): TransacaoPluggy =>
      tx({
        id,
        date,
        amount,
        type: "DEBIT",
        description: `LOJA ${id}`,
        status: date >= "2026-10-31" ? "PENDING" : "POSTED",
        creditCardMetadata: { billForecastDate: rotulo },
        ...extra,
      });
    const cartaoSemFechamento = (dueDate: string): ContaPluggy => ({
      ...cartao,
      creditData: { creditLimit: 5000, availableCreditLimit: 4000, balanceCloseDate: null, balanceDueDate: dueDate },
    });

    it("Inter: rótulo é o mês anterior ao vencimento; a fatura aberta (pendente) vai para dezembro", () => {
      const d = base();
      const inter = [
        compra("a", "2026-10-01", 50, "2026-10"),
        compra("b", "2026-10-07", 83.82, "2026-10"),
        compra("c", "2026-11-01", 300, "2026-11"),
        compra("d", "2026-11-07", 271.6, "2026-11"),
      ];
      aplicarOpenFinance(
        d,
        conexao([{ conta: cartaoSemFechamento("2026-11-07"), transacoes: inter }]),
        HOJE2,
      );
      const k = d.cartoes[0];
      expect(faturaDoMes(k.id, d.compras, "2026-12")).toBe(57_160);
      expect(faturaDoMes(k.id, d.compras, "2026-11")).toBe(13_382);
    });

    it("Nubank: fechamento descoberto pelas compras (30) e rótulo já é o mês do vencimento", () => {
      const d = base();
      const nubank = [
        compra("a", "2026-10-29", 100, "2026-11"),
        compra("b", "2026-10-30", 20, "2026-11"),
        compra("c", "2026-10-31", 200, "2026-12"),
        compra("d", "2026-11-10", 300, "2026-12"),
      ];
      aplicarOpenFinance(
        d,
        conexao([{ conta: cartaoSemFechamento("2026-11-09"), transacoes: nubank }]),
        HOJE2,
      );
      const k = d.cartoes[0];
      expect(k).toMatchObject({ diaFechamento: 30, diaVencimento: 9 });
      expect(faturaDoMes(k.id, d.compras, "2026-12")).toBe(50_000);
    });

    it("corrige o fechamento que veio do chute antigo, mas não um dia que você ajustou", () => {
      const d = base();
      const conta = cartaoSemFechamento("2026-11-09");
      const mp = [compra("a", "2026-11-02", 10, "2026-11"), compra("b", "2026-11-06", 20, "2026-12")];
      aplicarOpenFinance(d, conexao([{ conta, transacoes: [] }]), HOJE2);
      expect(d.cartoes[0].diaFechamento).toBe(3); // sem compras: o chute antigo
      aplicarOpenFinance(d, conexao([{ conta, transacoes: mp }]), HOJE2);
      expect(d.cartoes[0].diaFechamento).toBe(2);
      d.cartoes[0].diaFechamento = 5;
      aplicarOpenFinance(d, conexao([{ conta, transacoes: mp }]), HOJE2);
      expect(d.cartoes[0].diaFechamento).toBe(5);
    });

    it("compra que sai de pendente para lançada (com outro id) não se repete; cancelada sai", () => {
      const d = base();
      const conta = cartaoSemFechamento("2026-11-09");
      aplicarOpenFinance(
        d,
        conexao([
          {
            conta,
            transacoes: [
              compra("p1", "2026-11-05", 42, "2026-12"),
              compra("p2", "2026-11-06", 10, "2026-12"),
              compra("p3", "2026-11-06", 10, "2026-12"),
            ],
          },
        ]),
        HOJE2,
      );
      expect(d.compras).toHaveLength(3);
      // Agora: p1 lançada com outro id, uma das duas de R$ 10 foi cancelada.
      const r = aplicarOpenFinance(
        d,
        conexao([
          {
            conta,
            transacoes: [
              { ...compra("p1", "2026-11-05", 42, "2026-12"), id: "x1", status: "POSTED" },
              compra("p2", "2026-11-06", 10, "2026-12"),
            ],
          },
        ]),
        HOJE2,
      );
      expect(r.compras).toBe(0);
      expect(d.compras.map((c) => c.valor).sort()).toEqual([1000, 4200]);
    });

    it("pagamento recebido pelo cartão marca a fatura anterior como paga", () => {
      const d = base();
      const pagamento = tx({
        id: "pg",
        date: "2026-11-09",
        amount: 3500,
        type: "CREDIT",
        description: "Pagamento recebido",
        status: "POSTED",
        creditCardMetadata: { billForecastDate: "2026-12" },
      });
      aplicarOpenFinance(
        d,
        conexao([
          { conta: cartaoSemFechamento("2026-11-09"), transacoes: [compra("a", "2026-11-05", 10, "2026-12"), pagamento] },
        ]),
        HOJE2,
      );
      expect(d.lancamentos).toEqual([
        expect.objectContaining({ refTipo: "fatura", refId: d.cartoes[0].id, mes: "2026-11", pago: true }),
      ]);
      expect(d.compras).toHaveLength(1);
    });

    it("pagamento ainda pendente também paga, e faturas mais antigas que a busca ficam pagas", () => {
      const d = base();
      const pagamento = tx({
        id: "pg",
        date: "2026-11-04",
        amount: 2645.56,
        type: "CREDIT",
        description: "Pagamento recebido",
        status: "PENDING",
        creditCardMetadata: { billForecastDate: "2026-12" },
      });
      aplicarOpenFinance(
        d,
        conexao([
          {
            conta: cartaoSemFechamento("2026-11-09"),
            transacoes: [
              compra("velha", "2026-09-05", 50, "2026-10"),
              compra("a", "2026-10-20", 10, "2026-11"),
              compra("b", "2026-11-05", 20, "2026-12"),
              pagamento,
            ],
          },
        ]),
        HOJE2,
      );
      const pagas = d.lancamentos.filter((l) => l.pago).map((l) => l.mes).sort();
      expect(pagas).toEqual(["2026-10", "2026-11"]);
    });

    it("Inter: \"PAGAMENTO ON LINE\" é pagamento, mesmo classificado como compra", () => {
      const d = base();
      const pagamento = tx({
        id: "pg",
        date: "2026-10-31",
        amount: 133.82,
        type: "CREDIT",
        description: "PAGAMENTO ON LINE",
        category: "Shopping",
        status: "PENDING",
        creditCardMetadata: { billForecastDate: "2026-11" },
      });
      aplicarOpenFinance(
        d,
        conexao([
          { conta: cartaoSemFechamento("2026-11-07"), transacoes: [compra("a", "2026-11-05", 571.6, "2026-11"), pagamento] },
        ]),
        HOJE2,
      );
      expect(d.compras.map((c) => c.valor)).toEqual([57_160]);

      // Se uma versão anterior tinha gravado o pagamento como estorno, ele sai.
      d.compras.push({
        ...d.compras[0],
        id: "velho",
        valor: -13_382,
        mesPrimeira: "2026-11",
        externoId: "pg",
      });
      aplicarOpenFinance(
        d,
        conexao([
          { conta: cartaoSemFechamento("2026-11-07"), transacoes: [compra("a", "2026-11-05", 571.6, "2026-11"), pagamento] },
        ]),
        HOJE2,
      );
      expect(d.compras.map((c) => c.valor)).toEqual([57_160]);
    });

    it("parcelada lançada à mão não aparece em dobro quando as parcelas do banco chegam", () => {
      const d = base();
      const conta = cartaoSemFechamento("2026-11-09");
      aplicarOpenFinance(d, conexao([{ conta, transacoes: [] }]), HOJE2);
      const k = d.cartoes[0];
      d.compras.push({
        id: "minha",
        cartaoId: k.id,
        perfilId: "eu",
        larId: null,
        descricao: "Geladeira",
        valor: 300_000,
        parcelas: 10,
        recorrente: false,
        mesPrimeira: "2026-11",
        mesFim: null,
        data: "2026-10-20",
        categoria: "compras",
      });
      const parcela = (n: number, rot: string) =>
        compra(`g${n}`, `${rot}-01`, 300, rot, {
          description: `MAGAZINE ${n}/10`,
          creditCardMetadata: {
            installmentNumber: n,
            totalInstallments: 10,
            purchaseDate: "2026-10-21",
            billForecastDate: rot,
          },
        });
      for (let i = 0; i < 2; i++) {
        aplicarOpenFinance(
          d,
          conexao([{ conta, transacoes: [parcela(1, "2026-11"), parcela(2, "2026-12")] }]),
          HOJE2,
        );
      }
      expect(d.compras).toHaveLength(1);
      expect(d.compras[0].externoId).toMatch(/\|manual$/);
      expect(faturaDoMes(k.id, d.compras, "2026-12")).toBe(30_000);
    });

    it("autorização pendente antiga e esquecida não entra", () => {
      const d = base();
      aplicarOpenFinance(
        d,
        conexao([
          {
            conta: cartaoSemFechamento("2026-11-09"),
            transacoes: [{ ...compra("v", "2026-08-30", 27.25, "2026-09"), status: "PENDING" }],
          },
        ]),
        HOJE2,
      );
      expect(d.compras).toHaveLength(0);
    });
  });

  it("usa o tipo do estabelecimento (MCC) quando a categoria da Pluggy não diz", () => {
    expect(categoriaDoMcc(5411)).toBe("mercado");
    expect(categoriaDoMcc(5542)).toBe("transporte");
    expect(categoriaDoMcc(5912)).toBe("saude");
    expect(categoriaDoMcc(5814)).toBe("alimentacao");
    expect(categoriaDoMcc(9999)).toBeNull();
    expect(categoriaDaPluggy(null, "PG *XPTO", "saida", { mcc: 5812 })).toBe("alimentacao");
    // "Shopping" é vago: o MCC de posto vence.
    expect(categoriaDaPluggy("Shopping", "AUTO POSTO", "saida", { mcc: 5541 })).toBe("transporte");
    // Categoria específica da Pluggy continua valendo.
    expect(categoriaDaPluggy("Groceries", "X", "saida", { mcc: 5812 })).toBe("mercado");
    expect(categoriaDaPluggy(null, "LOJA 123", "saida", { ramo: "Pharmacy" })).toBe("saude");
  });

  it("cartão se chama pelo banco; o nome comercial só com mais de um cartão no banco", () => {
    const d = base();
    const gold = { ...cartao, id: "nu-gold", marketingName: "gold" };
    aplicarOpenFinance(d, [{ perfilId: "eu", banco: "Nubank", contas: [{ conta: gold, transacoes: [] }] }], HOJE);
    expect(d.cartoes[0].nome).toBe("Nubank");
    // Nome automático de uma versão anterior ("gold") vira o do banco; o seu fica.
    d.cartoes[0].nome = "gold";
    aplicarOpenFinance(d, [{ perfilId: "eu", banco: "Nubank", contas: [{ conta: gold, transacoes: [] }] }], HOJE);
    expect(d.cartoes[0].nome).toBe("Nubank");
    d.cartoes[0].nome = "Cartão da mãe";
    aplicarOpenFinance(d, [{ perfilId: "eu", banco: "Nubank", contas: [{ conta: gold, transacoes: [] }] }], HOJE);
    expect(d.cartoes[0].nome).toBe("Cartão da mãe");
    // Dois cartões no mesmo banco: o nome comercial diferencia.
    const d2 = base();
    const outro = { ...cartao, id: "nu-ultra", marketingName: "ULTRAVIOLETA" };
    aplicarOpenFinance(
      d2,
      [{ perfilId: "eu", banco: "Nubank", contas: [{ conta: gold, transacoes: [] }, { conta: outro, transacoes: [] }] }],
      HOJE,
    );
    expect(d2.cartoes.map((c) => c.nome)).toEqual(["Nubank Gold", "Nubank Ultravioleta"]);
  });

  it("RecargaPay é transferência, Mercado Livre não é supermercado, IOF é tarifa", () => {
    expect(categoriaDaPluggy("Services", "Recargapay *Lucasmart", "saida")).toBe("transferencia");
    expect(categoriaDaPluggy(null, "MERCADOLIVRE*LOJA", "saida")).toBe("compras");
    expect(categoriaDaPluggy(null, "Confianca Max", "saida")).not.toBe("assinatura");
    expect(categoriaDaPluggy(null, "Supermercado Tauste", "saida")).toBe("mercado");
    expect(categoriaDaPluggy(null, "IOF de compra internacional", "saida")).toBe("tarifa");
    expect(categoriaDaPluggy(null, "Dl *Sgl Telegram Premium", "saida")).toBe("assinatura");
  });

  it("arruma o nome do cartão que vem todo em maiúsculas ou minúsculas", () => {
    expect(nomeBonito("GOLD")).toBe("Gold");
    expect(nomeBonito("gold")).toBe("Gold");
    expect(nomeBonito("MERCADO PAGO")).toBe("Mercado Pago");
    expect(nomeBonito("Ultravioleta")).toBe("Ultravioleta");
  });

  it("traduz categorias e limpa a parcela da descrição", () => {
    expect(categoriaDaPluggy("Groceries", "ASSAI", "saida")).toBe("mercado");
    expect(categoriaDaPluggy("Gas stations", "SHELL", "saida")).toBe("transporte");
    expect(categoriaDaPluggy("Electricity", "ENEL", "saida")).toBe("luz");
    expect(categoriaDaPluggy(null, "NETFLIX.COM", "saida")).toBe("assinatura");
    expect(categoriaDaPluggy("Salary", "SALARIO", "entrada")).toBe("renda");
    expect(semParcela("MERCADO LIVRE 02/12")).toBe("MERCADO LIVRE");
    expect(semParcela("LOJA PARC 3 de 6")).toBe("LOJA");
    expect(semParcela("PADARIA 2000")).toBe("PADARIA 2000");
  });
});
