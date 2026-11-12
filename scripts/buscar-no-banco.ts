// Busca as contas, cartões e movimentações no Open Finance (via Pluggy) e
// encaixa no arquivo de dados do app. Roda no GitHub, no repositório PRIVADO
// dos dados (.github/workflows/buscar-no-banco.yml), nunca no navegador: a
// chave secreta da Pluggy não pode ficar exposta.
//
//   npx tsx scripts/buscar-no-banco.ts buscar  <cache.json>
//   npx tsx scripts/buscar-no-banco.ts aplicar <cache.json> <financas.json> <status.json>
//
// Variáveis de ambiente (segredos e variáveis do repositório dos dados):
//   PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET  credenciais da aplicação no painel da Pluggy
//   PLUGGY_CONEXOES  uma conexão por linha: "<id da conexão> = <nome do perfil no app>"
//
// O que é impresso no log fica só em contagens: nada de valores ou descrições.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { normalizar as normalizarBanco } from "../src/lib/dados/operacoes";
import {
  aplicarOpenFinance,
  conferirCartoes,
  type ConexaoBuscada,
  type ContaPluggy,
  nomeDoBanco,
  type StatusOpenFinance,
  type TransacaoPluggy,
} from "../src/lib/open-finance";

/** PLUGGY_API só existe para testar contra uma Pluggy simulada. */
const API = process.env.PLUGGY_API || "https://api.pluggy.ai";
/** Quantos dias para trás buscar a cada vez. O que já veio não se repete. */
const DIAS = 90;

export interface ConexaoNoCache {
  item: string;
  perfil: string;
  /** Nome do banco escrito na configuração (opcional). */
  apelido?: string;
  banco: string;
  situacao: StatusOpenFinance["conexoes"][number]["situacao"];
  atualizadoNoBancoEm: string | null;
  erro: string | null;
  contas: { conta: ContaPluggy; transacoes: TransacaoPluggy[] }[];
}

/**
 * "id = Perfil" por linha (ou separado por vírgula). Opcional: "id = Perfil = Banco"
 * para dar nome ao banco. Sem perfil: o perfil único do app.
 */
export function lerConfiguracao(
  texto: string,
): { item: string; perfil: string; apelido: string }[] {
  return texto
    .split(/[\n,;]+/)
    .map((linha) => linha.trim())
    .filter((linha) => linha && !linha.startsWith("#"))
    .map((linha) => {
      const [item, perfil = "", apelido = ""] = linha.split(/[=:]/).map((p) => p.trim());
      return { item, perfil, apelido };
    })
    .filter((c) => /^[0-9a-f-]{20,}$/i.test(c.item));
}

const semAcento = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

function situacaoDoItem(status: string | undefined): ConexaoNoCache["situacao"] {
  if (status === "UPDATED") return "ok";
  if (status === "UPDATING") return "atualizando";
  if (status === "LOGIN_ERROR" || status === "OUTDATED" || status === "WAITING_USER_INPUT") {
    return "reconectar";
  }
  return "erro";
}

async function pluggy<T>(chave: string, caminho: string): Promise<T> {
  const r = await fetch(`${API}${caminho}`, { headers: { "X-API-KEY": chave } });
  if (r.status === 404 && caminho.startsWith("/items/")) {
    throw new Error("Conexão não encontrada na Pluggy. Confira o id em PLUGGY_CONEXOES.");
  }
  if (!r.ok) throw new Error(`A Pluggy respondeu com erro ${r.status}. Tente de novo mais tarde.`);
  return (await r.json()) as T;
}

async function buscar(cache: string) {
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Faltam PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET.");
  const config = lerConfiguracao(process.env.PLUGGY_CONEXOES ?? "");
  if (!config.length) throw new Error("PLUGGY_CONEXOES está vazia: informe os ids das conexões.");

  const auth = await fetch(`${API}/auth`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!auth.ok) throw new Error(`A Pluggy recusou as credenciais (erro ${auth.status}).`);
  const { apiKey } = (await auth.json()) as { apiKey: string };

  const desde = new Date(Date.now() - DIAS * 86_400_000).toISOString().slice(0, 10);
  const conexoes: ConexaoNoCache[] = [];

  for (const { item, perfil, apelido } of config) {
    const conexao: ConexaoNoCache = {
      item,
      perfil,
      apelido,
      banco: "Banco",
      situacao: "erro",
      atualizadoNoBancoEm: null,
      erro: null,
      contas: [],
    };
    conexoes.push(conexao);
    try {
      const dados = await pluggy<{
        status?: string;
        lastUpdatedAt?: string | null;
        connector?: { name?: string };
      }>(apiKey, `/items/${item}`);
      const conector = dados.connector?.name?.replace(/^\s*meu\s*pluggy\s*[-–:]?\s*/i, "").trim();
      conexao.situacao = situacaoDoItem(dados.status);
      conexao.atualizadoNoBancoEm = dados.lastUpdatedAt ?? null;

      const { results: contas } = await pluggy<{ results: ContaPluggy[] }>(
        apiKey,
        `/accounts?itemId=${item}`,
      );
      for (const conta of contas) {
        const transacoes: TransacaoPluggy[] = [];
        let proxima: string | null = `?accountId=${conta.id}&dateFrom=${desde}`;
        while (proxima) {
          const pagina: { results: TransacaoPluggy[]; next: string | null } = await pluggy(
            apiKey,
            `/v2/transactions${proxima}`,
          );
          transacoes.push(...pagina.results);
          proxima = pagina.next;
        }
        conexao.contas.push({ conta, transacoes });
      }
      conexao.banco =
        apelido || nomeDoBanco(contas) || conector || contas[0]?.marketingName?.trim() || "Banco";
      console.log(
        `Conexão ${conexoes.length}: ${conexao.contas.length} conta(s), ` +
          `${conexao.contas.reduce((s, c) => s + c.transacoes.length, 0)} movimentação(ões).`,
      );
      if (process.env.DIAGNOSTICO) {
        diagnostico(conexao);
        for (const { conta } of conexao.contas.filter((c) => c.conta.type === "CREDIT")) {
          try {
            const faturas = await pluggy<{
              results: { id: string; dueDate: string; totalAmount: number }[];
            }>(apiKey, `/bills?accountId=${conta.id}`);
            for (const f of faturas.results.slice(-6)) {
              console.log(
                `    fatura oficial: vence=${String(f.dueDate).slice(0, 10)} total=${f.totalAmount} id=${f.id.slice(0, 8)}`,
              );
            }
          } catch (e) {
            console.log(`    faturas oficiais: ${e instanceof Error ? e.message : e}`);
          }
        }
      }
    } catch (e) {
      conexao.situacao = "erro";
      conexao.erro = e instanceof Error ? e.message : "Erro desconhecido.";
      console.log(`Conexão ${conexoes.length}: ${conexao.erro}`);
    }
  }
  writeFileSync(cache, JSON.stringify({ buscadoEm: new Date().toISOString(), conexoes }));
}

/**
 * Resumo para conferir cartões com o app do banco (só com DIAGNOSTICO=1): datas
 * do cartão e, por fatura e situação, quantas compras e quanto somam.
 */
function diagnostico(conexao: ConexaoNoCache) {
  for (const { conta, transacoes } of conexao.contas) {
    const c = conta.creditData;
    console.log(
      `  ${conexao.banco} · ${conta.type}/${conta.subtype} · ${conta.marketingName ?? conta.name}` +
        (c
          ? ` · fecha=${c.balanceCloseDate ?? "-"} vence=${c.balanceDueDate ?? "-"}` +
            ` limite=${c.creditLimit ?? "-"} livre=${c.availableCreditLimit ?? "-"} saldo=${conta.balance}`
          : ` · saldo=${conta.balance}`),
    );
    if (conta.type !== "CREDIT") continue;
    const grupos = new Map<string, { n: number; soma: number; de: string; ate: string }>();
    for (const t of transacoes) {
      const m = t.creditCardMetadata ?? {};
      const chave = `fatura=${m.billForecastDate ?? "?"} ${t.status ?? "POSTED"} ${t.type}`;
      const g = grupos.get(chave) ?? { n: 0, soma: 0, de: "9999", ate: "0000" };
      const dia = String(t.date).slice(0, 10);
      g.n++;
      g.soma += t.amount;
      if (dia < g.de) g.de = dia;
      if (dia > g.ate) g.ate = dia;
      grupos.set(chave, g);
    }
    for (const [chave, g] of [...grupos].sort()) {
      console.log(`    ${chave}: ${g.n} · soma=${g.soma.toFixed(2)} · ${g.de}..${g.ate}`);
    }
    // Amostra das movimentações recentes, campo a campo.
    const recentes = transacoes
      .filter((t) => String(t.date).slice(0, 10) >= "2026-10-25")
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .slice(0, 40);
    for (const t of recentes) {
      const m = (t.creditCardMetadata ?? {}) as Record<string, unknown>;
      console.log(
        `    · ${String(t.date).slice(0, 10)} ${t.status ?? "-"} ${t.type} ${t.amount}` +
          ` parc=${m.installmentNumber ?? "-"}/${m.totalInstallments ?? "-"} tot=${m.totalAmount ?? "-"}` +
          ` compra=${String(m.purchaseDate ?? "-").slice(0, 10)} rot=${m.billForecastDate ?? "-"}` +
          ` post=${m.billPostDate ?? "-"} bill=${String(m.billId ?? "-").slice(0, 8)}` +
          ` cat=${t.category ?? "-"} desc=${t.description.slice(0, 22)}`,
      );
    }
  }
}

function aplicar(cache: string, arquivo: string, arquivoStatus: string) {
  const lido = JSON.parse(readFileSync(cache, "utf8")) as {
    buscadoEm: string;
    conexoes: ConexaoNoCache[];
  };
  if (!existsSync(arquivo)) {
    throw new Error("O arquivo de dados ainda não existe: abra o site e crie um perfil antes.");
  }
  const banco = normalizarBanco(JSON.parse(readFileSync(arquivo, "utf8")));

  const prontas: ConexaoBuscada[] = [];
  for (const c of lido.conexoes) {
    if (c.erro) continue;
    const perfil = c.perfil
      ? banco.perfis.find((p) => semAcento(p.nome) === semAcento(c.perfil))
      : banco.perfis.length === 1
        ? banco.perfis[0]
        : undefined;
    if (!perfil) {
      c.situacao = "erro";
      c.erro = c.perfil
        ? `Não há perfil chamado "${c.perfil}" no app.`
        : "Há mais de um perfil: diga de quem é esta conexão (id = Nome).";
      continue;
    }
    c.perfil = perfil.nome;
    prontas.push({ perfilId: perfil.id, banco: c.banco, contas: c.contas });
  }

  const hoje = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10); // horário de Brasília
  const importado = aplicarOpenFinance(banco, prontas, hoje);
  if (process.env.DIAGNOSTICO) for (const l of conferirCartoes(banco, prontas, hoje)) console.log(l);
  writeFileSync(arquivo, JSON.stringify(banco, null, 1));

  const status: StatusOpenFinance = {
    buscadoEm: lido.buscadoEm,
    conexoes: lido.conexoes.map((c) => ({
      banco: c.banco,
      perfil: c.perfil,
      situacao: c.situacao,
      atualizadoNoBancoEm: c.atualizadoNoBancoEm,
      contas: c.contas.length,
      erro: c.erro,
    })),
    importado,
  };
  writeFileSync(arquivoStatus, JSON.stringify(status, null, 1));
  console.log(
    `Importado: ${importado.transacoes} transação(ões), ${importado.compras} compra(s), ` +
      `${importado.carteirasNovas} carteira(s) e ${importado.cartoesNovos} cartão(ões) novos, ` +
      `${importado.ligadas} já lançada(s) à mão, ${importado.pagas} conta(s) marcada(s) como paga(s).`,
  );
}

async function principal() {
  const [modo, ...args] = process.argv.slice(2);
  if (modo === "buscar" && args[0]) return buscar(args[0]);
  if (modo === "aplicar" && args.length === 3) return aplicar(args[0], args[1], args[2]);
  throw new Error("Uso: buscar <cache.json> | aplicar <cache.json> <financas.json> <status.json>");
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/buscar-no-banco.ts")) {
  principal().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
