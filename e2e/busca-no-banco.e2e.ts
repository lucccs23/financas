import { execFile } from "node:child_process";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { promisify } from "node:util";
import { dadosVazios } from "../src/lib/types";
import {
  ARQUIVO,
  entrar,
  expect,
  gravarDados,
  HOJE,
  lerDados,
  test,
  textoCorrido,
} from "./apoio";

const rodar = promisify(execFile);
const ITEM = "aaaaaaaa-0000-4000-8000-000000000001";
const CONTA = "cartao-exemplo";

const compra = (
  id: string,
  date: string,
  description: string,
  amount: number,
  billForecastDate: string,
  extra = {},
) => ({
  id,
  date: `${date}T12:00:00.000Z`,
  description,
  amount,
  type: "DEBIT",
  status: "POSTED",
  category: "Shopping",
  creditCardMetadata: { billForecastDate },
  ...extra,
});

const TRANSACOES = [
  // A fatura que venceu em novembro.
  compra("t0", "2026-10-10", "Loja Antiga", 500, "2026-11"),
  compra("t1", "2026-11-03", "Mercado do Bairro", 100, "2026-12"),
  // Compra internacional: "amount" em dólar, o valor em reais à parte.
  compra("t2", "2026-11-04", "Servico Online", 10, "2026-12", {
    amountInAccountCurrency: 55.5,
    currencyCode: "USD",
  }),
  // Tarifa com rótulo trocado não pode mudar o mês do cartão.
  compra("t3", "2026-11-07", "SEGURO CARTAO", 3.9, "2027-01"),
  {
    ...compra("p1", "2026-11-05", "Pagamento recebido", -300, "2026-12"),
    type: "CREDIT",
    category: "Credit card payment",
  },
];

function pluggySimulada() {
  return createServer((req, res) => {
    const url = new URL(req.url!, "http://x");
    const json = (corpo: unknown, status = 200) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(corpo));
    };
    if (url.pathname === "/auth") return json({ apiKey: "chave-de-teste" });
    if (req.headers["x-api-key"] !== "chave-de-teste") return json({}, 403);
    if (url.pathname === `/items/${ITEM}`) {
      return json({
        id: ITEM,
        status: "UPDATED",
        lastUpdatedAt: `${HOJE}T10:00:00.000Z`,
        connector: { name: "Banco Azul" },
      });
    }
    if (url.pathname === "/accounts") {
      return json({
        results: [
          {
            id: CONTA,
            type: "CREDIT",
            subtype: "CREDIT_CARD",
            name: "Banco Azul",
            marketingName: "Banco Azul",
            balance: 359.4,
            creditData: {
              creditLimit: 5000,
              availableCreditLimit: 4640.6,
              balanceCloseDate: "2026-11-28",
              balanceDueDate: "2026-12-05",
            },
          },
        ],
      });
    }
    if (url.pathname === "/v2/transactions")
      return json({ results: TRANSACOES, next: null });
    // Fatura vencida de 500; só 300 foram pagos: 200 passam para a próxima.
    if (url.pathname === "/bills") {
      return json({
        results: [
          { id: "f1", dueDate: "2026-11-05T00:00:00.000Z", totalAmount: 500 },
        ],
      });
    }
    return json({}, 404);
  });
}

let servidor: Server;
let api = "";

test.beforeAll(async () => {
  servidor = pluggySimulada();
  await new Promise<void>((pronto) => servidor.listen(0, "127.0.0.1", pronto));
  const endereco = servidor.address();
  if (typeof endereco !== "object" || !endereco)
    throw new Error("Pluggy simulada sem porta.");
  api = `http://127.0.0.1:${endereco.port}`;
});

test.afterAll(() => new Promise((fim) => servidor.close(fim)));

test("busca no banco monta a fatura: dólar, tarifa e saldo não pago", async ({
  page,
}) => {
  const d = dadosVazios();
  d.perfis = [
    { id: "ana", nome: "Ana", cor: 0, salario: 300_000, orcamentoDiaADia: 0 },
  ];
  gravarDados(d);

  const cache = path.resolve(".e2e/busca.json");
  const status = path.resolve(".e2e/status.json");
  const tsx = path.resolve("node_modules/tsx/dist/cli.mjs");
  const env = {
    ...process.env,
    PLUGGY_API: api,
    PLUGGY_CLIENT_ID: "teste",
    PLUGGY_CLIENT_SECRET: "teste",
    PLUGGY_CONEXOES: `${ITEM} = Ana`,
    BUSCA_HOJE: HOJE,
  };
  const script = "scripts/buscar-no-banco.ts";
  await rodar(process.execPath, [tsx, script, "buscar", cache], { env });
  await rodar(
    process.execPath,
    [tsx, script, "aplicar", cache, ARQUIVO, status],
    { env },
  );

  expect(lerDados().compras.map((c) => c.descricao)).toContain(
    "Saldo da fatura de nov/26 não pago",
  );

  await entrar(page, "/cartoes");
  const tela = page.getByRole("main");
  await expect(tela).toContainText("Fatura de dezembro");
  await expect(tela).toContainText("Saldo da fatura de nov/26 não pago");
  // 100 + 55,50 (em reais) + 3,90 + 200 de saldo.
  await expect.poll(() => textoCorrido(tela)).toContain("R$359,40");
});
