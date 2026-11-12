import { describe, expect, it } from "vitest";
import { limiteDoCartao, movimentoAvulso, faturaDoMes } from "./calc";
import { saldoCarteira } from "./calc-extra";
import {
  aplicarOpenFinance,
  categoriaDaPluggy,
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

  it("cartão: compra parcelada vira uma compra só, na fatura certa, e o limite bate com o banco", () => {
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
    expect(r).toMatchObject({ cartoesNovos: 1, compras: 3 });
    const k = d.cartoes[0];
    expect(k).toMatchObject({ limite: 500_000, diaFechamento: 3, diaVencimento: 10 });

    const loja = d.compras.find((c) => c.parcelas === 10)!;
    expect(loja).toMatchObject({ descricao: "LOJA X", valor: 100_000, mesPrimeira: "2026-07", categoria: "compras" });
    expect(d.compras.filter((c) => c.parcelas === 10)).toHaveLength(1);
    // Estorno abate o Uber.
    expect(d.compras.map((c) => c.valor).sort((a, b) => a - b)).toEqual([-2500, 2500, 100_000]);

    expect(limiteDoCartao(k, d, "2026-11").livre).toBe(410_000);
    expect(k.limiteConferidoEm).toBe(HOJE);
    expect(faturaDoMes(k.id, d.compras, "2026-11")).toBeGreaterThan(0);
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
