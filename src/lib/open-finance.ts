// Open Finance (via Pluggy): encaixa nos dados do app o que veio do banco.
//
// Regras:
// - Cada conta do banco vira uma carteira; cada cartão vira um cartão. O saldo
//   da carteira e o limite livre do cartão passam a bater com o banco.
// - Extrato da conta vira Transações; compras do cartão viram Compras (uma por
//   compra, mesmo parcelada).
// - Nada entra duas vezes: o que já veio antes é reconhecido pelo id do banco,
//   e o que você já tinha lançado à mão é ligado ao item do banco em vez de
//   repetido.
// - O que já conta em outro lugar entra como "só saldo" (fica no extrato e no
//   saldo, mas fora do resumo do mês): pagamento de fatura, dinheiro entre
//   contas suas, aplicações, salário já cadastrado no perfil e contas fixas já
//   cadastradas (que ficam marcadas como pagas).

import {
  ajusteParaDisponivel,
  chaveLancamento,
  comprasDaFatura,
  faturaDoMes,
  indexarLancamentos,
  mesPrimeiraFatura,
  ocorreNoMes,
  rendaNoMes,
} from "./calc";
import { saldoCarteira } from "./calc-extra";
import { sugerirCategoria } from "./categorias";
import { novoId } from "./dados/backend";
import { addMes } from "./meses";
import type { Carteira, Cartao, Compra, Conta, Dados, Id, Mes, Transacao } from "./types";

/* ───────────────────────── O que a Pluggy entrega ───────────────────────── */

export interface ContaPluggy {
  id: string;
  type: "BANK" | "CREDIT";
  subtype?: "CHECKING_ACCOUNT" | "SAVINGS_ACCOUNT" | "CREDIT_CARD" | string;
  name: string;
  marketingName?: string | null;
  balance: number;
  /** transferNumber costuma vir como "código do banco/agência/conta" (ex.: "077/0001/123-4"). */
  bankData?: { transferNumber?: string | null } | null;
  creditData?: {
    creditLimit?: number | null;
    availableCreditLimit?: number | null;
    balanceCloseDate?: string | null;
    balanceDueDate?: string | null;
  } | null;
}

export interface TransacaoPluggy {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "DEBIT" | "CREDIT";
  status?: "PENDING" | "POSTED";
  category?: string | null;
  creditCardMetadata?: {
    installmentNumber?: number | null;
    totalInstallments?: number | null;
    totalAmount?: number | null;
    purchaseDate?: string | null;
    /** Mês da fatura (AAAA-MM) em que esta cobrança cai. */
    billForecastDate?: string | null;
  } | null;
}

/** Uma conexão (um banco no Meu Pluggy), já ligada a um perfil do app. */
export interface ConexaoBuscada {
  perfilId: Id;
  banco: string;
  contas: { conta: ContaPluggy; transacoes: TransacaoPluggy[] }[];
}

export interface ResumoImportacao {
  carteirasNovas: number;
  cartoesNovos: number;
  transacoes: number;
  compras: number;
  /** Lançamentos feitos à mão que foram reconhecidos no banco (não repetidos). */
  ligadas: number;
  /** Contas e faturas marcadas como pagas ao achar o pagamento no extrato. */
  pagas: number;
}

/** Situação da última busca, gravada em open-finance.json ao lado dos dados. */
export interface StatusOpenFinance {
  buscadoEm: string;
  conexoes: {
    banco: string;
    perfil: string;
    situacao: "ok" | "atualizando" | "reconectar" | "erro";
    atualizadoNoBancoEm: string | null;
    contas: number;
    erro: string | null;
  }[];
  importado: ResumoImportacao | null;
}

/* ───────────────────────── Nome do banco ───────────────────────── */

/** Código do banco (COMPE) → nome curto. */
const CODIGOS: Record<string, string> = {
  "001": "Banco do Brasil",
  "033": "Santander",
  "077": "Inter",
  "102": "XP",
  "104": "Caixa",
  "197": "Stone",
  "208": "BTG",
  "212": "Original",
  "237": "Bradesco",
  "260": "Nubank",
  "280": "Will Bank",
  "290": "PagBank",
  "323": "Mercado Pago",
  "335": "Digio",
  "336": "C6 Bank",
  "341": "Itaú",
  "380": "PicPay",
  "403": "Cora",
  "655": "BV",
  "735": "Neon",
  "748": "Sicredi",
  "756": "Sicoob",
};

const NOMES: [RegExp, string][] = [
  [/\bnu ?(pagamentos|bank)\b|nubank/, "Nubank"],
  [/mercado ?pago/, "Mercado Pago"],
  [/porto ?bank|portobank|porto seguro/, "Porto Bank"],
  [/banco inter|\binter\b/, "Inter"],
  [/itau/, "Itaú"],
  [/bradesco/, "Bradesco"],
  [/santander/, "Santander"],
  [/caixa/, "Caixa"],
  [/banco do brasil/, "Banco do Brasil"],
  [/\bc6\b/, "C6 Bank"],
  [/picpay/, "PicPay"],
  [/\bbtg\b/, "BTG"],
  [/\bxp\b/, "XP"],
  [/sicoob/, "Sicoob"],
  [/sicredi/, "Sicredi"],
  [/pagbank|pagseguro/, "PagBank"],
  [/\bneon\b/, "Neon"],
  [/will ?bank/, "Will Bank"],
  [/digio/, "Digio"],
  [/recargapay/, "RecargaPay"],
];

/**
 * Descobre o nome do banco de uma conexão pelas contas dela: primeiro pelo
 * nome da conta, depois pelo código do banco no número de transferência (o
 * código pode ser do banco parceiro: a Porto Bank usa o do Itaú).
 */
export function nomeDoBanco(contas: Pick<ContaPluggy, "name" | "marketingName" | "bankData">[]) {
  for (const c of contas) {
    const texto = normalizar(`${c.marketingName ?? ""} ${c.name ?? ""}`);
    const achado = NOMES.find(([r]) => r.test(texto))?.[1];
    if (achado) return achado;
  }
  for (const c of contas) {
    const codigo = c.bankData?.transferNumber?.match(/^\s*(\d{1,3})\s*[/-]/)?.[1];
    if (codigo && CODIGOS[codigo.padStart(3, "0")]) return CODIGOS[codigo.padStart(3, "0")];
  }
  return null;
}

/** Nome que o próprio app deu (genérico ou de um palpite anterior), e não você. */
function nomeAutomatico(nome: string, conta: ContaPluggy) {
  const base = nome.replace(/ · Poupança$/, "");
  return (
    base === "Banco" ||
    nome === conta.marketingName?.trim() ||
    nome === conta.name?.trim() ||
    Object.values(CODIGOS).includes(base) ||
    NOMES.some(([, n]) => n === base)
  );
}

/* ───────────────────────── Ajudantes ───────────────────────── */

const centavos = (v: number | null | undefined) => Math.round(Math.abs(v ?? 0) * 100);
const dia = (iso: string | null | undefined) => (iso ? Number(String(iso).slice(8, 10)) || 0 : 0);
const data = (iso: string | null | undefined) => (iso ? String(iso).slice(0, 10) : "");

function diasEntre(a: string, b: string) {
  return Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000;
}

function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tira o "03/10" ou "PARC 03/10" do fim da descrição de uma parcela. */
export function semParcela(descricao: string) {
  return descricao
    .replace(/\s*[-–]?\s*(parc(ela)?\.?\s*)?\d{1,2}\s*(\/|de)\s*\d{1,2}\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Traduz a categoria da Pluggy para a do app; sem tradução, usa as pistas da descrição. */
export function categoriaDaPluggy(
  categoria: string | null | undefined,
  descricao: string,
  tipo: "entrada" | "saida",
): string {
  const c = normalizar(categoria ?? "");
  if (tipo === "entrada") {
    if (/refund|reembols|cashback/.test(c)) return "reembolso";
    if (/transfer/.test(c)) return "transferencia";
    return "renda";
  }
  const regras: [RegExp, string][] = [
    [/credit card payment/, "cartao"],
    [/same person|transfer|boleto|bank slip|\bpix\b|\bted\b|\bdoc\b/, "transferencia"],
    [/investment|fixed income|mutual fund|variable income|pension|margin/, "reserva"],
    [/gas station|parking|toll|vehicle|automotive|taxi|ride|public transport|car rental|bicycle|transportation/, "transporte"],
    [/groceries|supermarket/, "mercado"],
    [/eating out|food delivery|food and drinks|restaurant/, "alimentacao"],
    [/streaming|digital services/, "assinatura"],
    [/telecommunication|internet|mobile|\btv\b/, "internet"],
    [/education|course|university|school|kindergarten|bookstore/, "educacao"],
    [/health|pharmacy|dentist|optometry|hospital|clinic|lab|gym|fitness|wellness/, "saude"],
    [/real estate financing|vehicle financing|student loan/, "financiamento"],
    [/\brent\b/, "aluguel"],
    [/electricity/, "luz"],
    [/water/, "agua"],
    [/^gas$|utilities.*gas/, "gas"],
    [/shopping|electronics|clothing|pet|kids|toys|sports goods|office|houseware|online shopping/, "compras"],
    [/leisure|ticket|cinema|theater|concert|museum|stadium|travel|airline|accommodation|bus ticket|gaming|gambling|lottery|bet/, "lazer"],
    [/donation/, "familia"],
  ];
  const achada = regras.find(([r]) => r.test(c))?.[1];
  if (achada) return achada;
  return sugerirCategoria(descricao);
}

/** Dinheiro que só muda de lugar: não é gasto nem renda nova. */
function soMudaDeLugar(categoria: string | null | undefined) {
  const c = normalizar(categoria ?? "");
  return (
    /same person|credit card payment/.test(c) ||
    (/investment|fixed income|mutual fund|variable income|pension|margin/.test(c) &&
      !/dividend|interest|proceeds/.test(c))
  );
}

function ehSalario(categoria: string | null | undefined) {
  return /salary|pro-labore|retirement/.test(normalizar(categoria ?? ""));
}

function ehPagamentoDeFatura(categoria: string | null | undefined, descricao: string) {
  return (
    /credit card payment/.test(normalizar(categoria ?? "")) ||
    /pag(amento|to)?\.? ?(de )?fatura|fatura (do )?cart|pagamento recebido|pgto recebido|pagto recebido/.test(
      normalizar(descricao),
    )
  );
}

/* ───────────────────────── Aplicar ───────────────────────── */

/**
 * Aplica o que veio do banco em `banco` (que é alterado no lugar) e devolve um
 * resumo. Pode rodar quantas vezes quiser: o resultado é o mesmo.
 */
export function aplicarOpenFinance(
  banco: Dados,
  conexoes: ConexaoBuscada[],
  hoje: string,
): ResumoImportacao {
  const resumo: ResumoImportacao = {
    carteirasNovas: 0,
    cartoesNovos: 0,
    transacoes: 0,
    compras: 0,
    ligadas: 0,
    pagas: 0,
  };
  const mesHoje = hoje.slice(0, 7);

  for (const conexao of conexoes) {
    const { perfilId } = conexao;
    if (!banco.perfis.some((p) => p.id === perfilId)) continue;

    for (const { conta, transacoes } of conexao.contas) {
      const comValor = transacoes.filter((t) => t.amount !== 0);
      if (conta.type === "CREDIT") {
        aplicarCartao(banco, conexao, conta, comValor, hoje, mesHoje, resumo);
      } else {
        aplicarConta(
          banco,
          conexao,
          conta,
          comValor.filter((t) => t.status !== "PENDING"),
          resumo,
        );
      }
    }
  }
  return resumo;
}

function aplicarConta(
  banco: Dados,
  conexao: ConexaoBuscada,
  conta: ContaPluggy,
  transacoes: TransacaoPluggy[],
  resumo: ResumoImportacao,
) {
  const { perfilId } = conexao;
  const poupanca = conta.subtype === "SAVINGS_ACCOUNT";
  const nomeBom = `${conexao.banco}${poupanca ? " · Poupança" : ""}`;
  let carteira = banco.carteiras.find((c) => c.externoId === conta.id);
  // Nome genérico que veio de uma busca anterior: troca pelo nome do banco.
  // Um nome que você mesmo escolheu fica como está.
  if (carteira && conexao.banco !== "Banco" && nomeAutomatico(carteira.nome, conta)) {
    carteira.nome = nomeBom;
  }
  if (!carteira) {
    carteira = {
      id: novoId(),
      perfilId,
      nome: nomeBom,
      tipo: poupanca ? "poupanca" : "corrente",
      saldoInicial: 0,
      cor: banco.carteiras.filter((c) => c.perfilId === perfilId).length % 6,
      arquivada: false,
      externoId: conta.id,
    } satisfies Carteira;
    banco.carteiras.push(carteira);
    resumo.carteirasNovas++;
  }

  const jaVieram = new Set(banco.transacoes.map((t) => t.externoId).filter(Boolean));
  const perfil = banco.perfis.find((p) => p.id === perfilId)!;

  for (const t of [...transacoes].sort((a, b) => a.date.localeCompare(b.date))) {
    if (jaVieram.has(t.id)) continue;
    const tipo: Transacao["tipo"] = t.type === "CREDIT" ? "entrada" : "saida";
    const valor = centavos(t.amount);
    const quando = data(t.date);
    const mes = quando.slice(0, 7);

    // Já lançada à mão? Liga em vez de repetir.
    const manual = banco.transacoes.find(
      (x) =>
        !x.externoId &&
        x.perfilId === perfilId &&
        x.tipo === tipo &&
        x.valor === valor &&
        (x.carteiraId === carteira.id || x.carteiraId === null) &&
        diasEntre(x.data, quando) <= 2,
    );
    if (manual) {
      manual.externoId = t.id;
      manual.carteiraId ??= carteira.id;
      jaVieram.add(t.id);
      resumo.ligadas++;
      continue;
    }

    let soSaldo = soMudaDeLugar(t.category);
    let observacao = "";
    if (tipo === "entrada" && ehSalario(t.category) && rendaNoMes(perfil, mes).salario > 0) {
      soSaldo = true;
      observacao = "Salário (já está em Minha renda)";
    }
    if (tipo === "saida" && ehPagamentoDeFatura(t.category, t.description)) {
      soSaldo = true;
      observacao = "Pagamento de fatura (as compras já contam pelo cartão)";
      if (marcarFaturaPaga(banco, perfilId, valor, mes)) resumo.pagas++;
    }
    if (!soSaldo) {
      const paga = marcarContaPaga(banco, perfilId, tipo, valor, mes);
      if (paga) {
        soSaldo = true;
        observacao = `Conta "${paga.nome}" (marcada como paga)`;
        resumo.pagas++;
      }
    }

    banco.transacoes.push({
      id: novoId(),
      perfilId,
      data: quando,
      descricao: t.description.trim(),
      valor,
      tipo,
      categoria: categoriaDaPluggy(t.category, t.description, tipo),
      carteiraId: carteira.id,
      carteiraDestinoId: null,
      observacao,
      externoId: t.id,
      soSaldo,
    });
    jaVieram.add(t.id);
    resumo.transacoes++;
  }

  // O saldo passa a bater com o banco: o ponto de partida absorve a diferença.
  const movimento = saldoCarteira({ ...carteira, saldoInicial: 0 }, banco.transacoes);
  carteira.saldoInicial = Math.round(conta.balance * 100) - movimento;
}

const ehMes = (m: string | null | undefined): m is string => !!m && /^\d{4}-\d{2}$/.test(m);

function somarDias(iso: string, n: number) {
  return new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Compra (ou estorno) do cartão que entra no app. Pagamento da fatura não entra. */
function ehCompra(t: TransacaoPluggy) {
  return !(t.type === "CREDIT" && ehPagamentoDeFatura(t.category, t.description));
}

/**
 * Cada banco rotula a fatura de um jeito (uns pelo mês do vencimento, outros
 * pelo mês anterior). O app usa o mês do vencimento. Descobre, pela fatura
 * aberta hoje, quantos meses somar ao rótulo do banco.
 */
export function deslocamentoDoRotulo(
  transacoes: TransacaoPluggy[],
  cartao: Pick<Cartao, "diaFechamento" | "diaVencimento">,
  hoje: string,
): number {
  const aVista = transacoes.filter(
    (t) =>
      t.type === "DEBIT" &&
      (t.creditCardMetadata?.installmentNumber ?? 1) <= 1 &&
      ehMes(t.creditCardMetadata?.billForecastDate) &&
      data(t.date) <= hoje,
  );
  if (!aVista.length) return 0;
  const maisRecente = aVista.reduce((a, b) => (data(b.date) > data(a.date) ? b : a));
  const rotulo = maisRecente.creditCardMetadata!.billForecastDate!;
  // Vencimento da fatura aberta hoje, pelas regras do cartão no app.
  const vencimento = mesPrimeiraFatura(cartao, hoje);
  return diffMeses(rotulo, vencimento);
}

function diffMeses(de: Mes, ate: Mes) {
  const [a1, m1] = de.split("-").map(Number);
  const [a2, m2] = ate.split("-").map(Number);
  return (a2 - a1) * 12 + (m2 - m1);
}

/**
 * Dia de fechamento quando o banco não informa: a última compra da fatura
 * anterior ou, se faltar compra perto da virada, o dia antes da primeira
 * compra da fatura aberta.
 */
export function fechamentoPelasCompras(
  transacoes: TransacaoPluggy[],
  hoje: string,
): { dia: number; certo: boolean } | null {
  const porRotulo = new Map<string, string[]>();
  for (const t of transacoes) {
    const m = t.creditCardMetadata;
    if (t.type !== "DEBIT" || (m?.installmentNumber ?? 1) > 1 || !ehMes(m?.billForecastDate)) continue;
    const dias = porRotulo.get(m!.billForecastDate!) ?? [];
    dias.push(data(t.date));
    porRotulo.set(m!.billForecastDate!, dias);
  }
  const rotulos = [...porRotulo.keys()].sort();
  const aberta = rotulos.filter((r) => porRotulo.get(r)!.some((d) => d <= hoje)).pop();
  if (!aberta) return null;
  const primeiraAberta = porRotulo.get(aberta)!.sort()[0];
  const anterior = porRotulo.get(addMes(aberta, -1))?.sort().at(-1);
  // Compras dos dois lados da virada, poucos dias entre elas: dá para confiar.
  if (anterior && diasEntre(anterior, primeiraAberta) <= 5) return { dia: dia(anterior), certo: true };
  return { dia: dia(somarDias(primeiraAberta, -1)), certo: false };
}

/** O chute antigo, quando o banco não informava o fechamento (até a versão de 12/11/2026). */
const chuteAntigo = (vencimento: number) => ((vencimento + 23) % 30) + 1;

function aplicarCartao(
  banco: Dados,
  conexao: ConexaoBuscada,
  conta: ContaPluggy,
  todas: TransacaoPluggy[],
  hoje: string,
  mesHoje: Mes,
  resumo: ResumoImportacao,
) {
  const { perfilId } = conexao;
  const credito = conta.creditData ?? {};
  let cartao = banco.cartoes.find((c) => c.externoId === conta.id);

  // Pendente no cartão é compra da fatura aberta (ou parcela futura): entra.
  // Autorização pendente antiga e esquecida, não.
  const limitePendente = somarDias(hoje, -45);
  const transacoes = todas.filter(
    (t) =>
      t.status !== "PENDING" ||
      (t.creditCardMetadata?.totalInstallments ?? 1) > 1 ||
      data(t.date) >= limitePendente,
  );

  if (!cartao) {
    // Fechamento e vencimento só no cadastro: depois, vale o que você ajustar no app.
    const vencimento = dia(credito.balanceDueDate) || 10;
    cartao = {
      id: novoId(),
      perfilId,
      larId: null,
      nome: conta.marketingName?.trim() || conta.name?.trim() || conexao.banco,
      banco: conexao.banco,
      cor: banco.cartoes.filter((c) => c.perfilId === perfilId).length % 7,
      limite: centavos(credito.creditLimit),
      diaFechamento:
        dia(credito.balanceCloseDate) ||
        fechamentoPelasCompras(transacoes, hoje)?.dia ||
        chuteAntigo(vencimento),
      diaVencimento: vencimento,
      externoId: conta.id,
    } satisfies Cartao;
    banco.cartoes.push(cartao);
    resumo.cartoesNovos++;
  } else {
    if (conexao.banco !== "Banco" && (!cartao.banco || nomeAutomatico(cartao.banco, conta))) {
      cartao.banco = conexao.banco;
    }
    if (credito.creditLimit != null) cartao.limite = centavos(credito.creditLimit);
    // Cartão criado com o chute antigo de fechamento: corrige uma vez, se as
    // compras mostrarem a virada com clareza. Um dia que você ajustou fica.
    if (cartao.diaFechamento === chuteAntigo(cartao.diaVencimento)) {
      const pelasCompras = fechamentoPelasCompras(transacoes, hoje);
      if (pelasCompras?.certo) cartao.diaFechamento = pelasCompras.dia;
    }
  }
  const doCartao = cartao;
  const deslocamento = deslocamentoDoRotulo(transacoes, doCartao, hoje);
  const mesDaFatura = (t: TransacaoPluggy) => {
    const rotulo = t.creditCardMetadata?.billForecastDate;
    return ehMes(rotulo) ? addMes(rotulo, deslocamento) : mesPrimeiraFatura(doCartao, data(t.date));
  };

  // Pagamento da fatura feito ao cartão: a fatura anterior está paga.
  for (const t of transacoes) {
    if (ehCompra(t) || t.status === "PENDING") continue;
    const paga = addMes(mesDaFatura(t), -1);
    if (paga < mesHoje || paga === mesHoje) {
      const ja = banco.lancamentos.find(
        (l) => l.refTipo === "fatura" && l.refId === doCartao.id && l.mes === paga && l.pago,
      );
      if (!ja) {
        marcarPago(banco, "fatura", doCartao.id, paga, doCartao);
        resumo.pagas++;
      }
    }
  }

  // Chave estável de cada compra: não muda quando sai de "pendente" para
  // "lançada" (o id do banco pode mudar). Compras iguais no mesmo dia ganham #2, #3...
  const vistas = new Map<string, number>();
  const ordenadas = [...transacoes].filter(ehCompra).sort(
    (a, b) => data(a.date).localeCompare(data(b.date)) || a.id.localeCompare(b.id),
  );
  const chaves = new Set<string>();

  for (const t of ordenadas) {
    const meta = t.creditCardMetadata ?? {};
    const parcelas = Math.max(1, meta.totalInstallments ?? 1);
    const numero = Math.min(parcelas, Math.max(1, meta.installmentNumber ?? 1));
    const parcela = centavos(t.amount);
    const total =
      parcelas > 1
        ? centavos(meta.totalAmount) >= parcela * 1.5
          ? centavos(meta.totalAmount)
          : parcela * parcelas
        : parcela;
    const valor = t.type === "CREDIT" ? -total : total; // estorno abate da fatura
    const descricao = semParcela(t.description.trim()) || t.description.trim();
    const compradoEm = data(meta.purchaseDate) || data(t.date);
    const mesPrimeira = addMes(mesDaFatura(t), -(numero - 1));

    // Uma compra parcelada aparece uma vez por fatura: a chave é a compra, não a parcela.
    let chave = `${conta.id}|${compradoEm}|${valor}|${parcelas}|${normalizar(descricao)}`;
    if (parcelas === 1) {
      const n = (vistas.get(chave) ?? 0) + 1;
      vistas.set(chave, n);
      if (n > 1) chave += `#${n}`;
    }
    if (chaves.has(chave)) continue;
    chaves.add(chave);

    // Já veio antes (pela chave nova ou pelo id do banco, das primeiras buscas)?
    const existente = banco.compras.find(
      (c) => c.cartaoId === doCartao.id && (c.externoId === chave || c.externoId === t.id),
    );
    if (existente) {
      existente.externoId = chave;
      // O banco manda: fatura e valor seguem o que ele informa.
      existente.mesPrimeira = mesPrimeira;
      existente.valor = valor;
      existente.parcelas = parcelas;
      continue;
    }

    const manual = banco.compras.find(
      (c) =>
        !c.externoId &&
        c.cartaoId === doCartao.id &&
        c.valor === valor &&
        c.parcelas === parcelas &&
        (c.mesPrimeira === mesPrimeira || diasEntre(c.data, compradoEm) <= 3),
    );
    if (manual) {
      manual.externoId = chave;
      resumo.ligadas++;
      continue;
    }

    banco.compras.push({
      id: novoId(),
      cartaoId: doCartao.id,
      perfilId,
      larId: doCartao.larId,
      descricao,
      valor,
      parcelas,
      recorrente: false,
      mesPrimeira,
      mesFim: null,
      data: compradoEm,
      categoria: categoriaDaPluggy(t.category, t.description, "saida"),
      externoId: chave,
    } satisfies Compra);
    resumo.compras++;
  }

  // Compra à vista que veio do banco e sumiu dele (autorização cancelada) sai
  // também daqui, mas só das faturas ainda em aberto, que a busca cobre inteiras.
  const abertaDesde = mesPrimeiraFatura(doCartao, hoje);
  banco.compras = banco.compras.filter(
    (c) =>
      c.cartaoId !== doCartao.id ||
      !c.externoId ||
      c.parcelas > 1 ||
      c.mesPrimeira < abertaDesde ||
      chaves.has(c.externoId),
  );

  // Limite livre igual ao do banco.
  if (credito.availableCreditLimit != null && doCartao.limite > 0) {
    doCartao.limiteAjuste = ajusteParaDisponivel(
      doCartao,
      banco,
      mesHoje,
      centavos(credito.availableCreditLimit),
    );
    doCartao.limiteConferidoEm = hoje;
  }
}

/* ───────────────────────── Conferência ───────────────────────── */

/**
 * Para conferir com o app do banco: por cartão e fatura (mês do vencimento),
 * a soma do que o banco mandou e a soma do app. Pagamentos de fatura ficam de fora.
 */
export function conferirCartoes(banco: Dados, conexoes: ConexaoBuscada[], hoje: string): string[] {
  const linhas: string[] = [];
  const mesHoje = hoje.slice(0, 7);
  for (const conexao of conexoes) {
    for (const { conta, transacoes } of conexao.contas) {
      if (conta.type !== "CREDIT") continue;
      const cartao = banco.cartoes.find((c) => c.externoId === conta.id);
      if (!cartao) continue;
      const limite = somarDias(hoje, -45);
      const validas = transacoes.filter(
        (t) =>
          t.amount !== 0 &&
          ehCompra(t) &&
          (t.status !== "PENDING" ||
            (t.creditCardMetadata?.totalInstallments ?? 1) > 1 ||
            data(t.date) >= limite),
      );
      const desloc = deslocamentoDoRotulo(validas, cartao, hoje);
      const doBanco = new Map<Mes, number>();
      for (const t of validas) {
        const r = t.creditCardMetadata?.billForecastDate;
        const m = ehMes(r) ? addMes(r, desloc) : mesPrimeiraFatura(cartao, data(t.date));
        const v = centavos(t.amount) * (t.type === "CREDIT" ? -1 : 1);
        doBanco.set(m, (doBanco.get(m) ?? 0) + v);
      }
      linhas.push(
        `${cartao.banco} ${cartao.nome}: fecha ${cartao.diaFechamento}, vence ${cartao.diaVencimento}, rótulo ${desloc >= 0 ? "+" : ""}${desloc}`,
      );
      for (let i = -1; i <= 2; i++) {
        const m = addMes(mesHoje, i);
        const b = (doBanco.get(m) ?? 0) / 100;
        const a = faturaDoMes(cartao.id, banco.compras, m) / 100;
        linhas.push(`  ${m}: banco ${b.toFixed(2)} · app ${a.toFixed(2)}${Math.abs(a - b) > 0.05 ? "  <- diferente" : ""}`);
      }
      // Item a item, na fatura do mês que vem: o que só um dos lados tem.
      const alvo = addMes(mesHoje, 1);
      const chave = (desc: string, v: number) => `${normalizar(semParcela(desc)).slice(0, 12)}|${v}`;
      const sobra = new Map<string, number>();
      for (const t of validas) {
        const r = t.creditCardMetadata?.billForecastDate;
        const m = ehMes(r) ? addMes(r, desloc) : mesPrimeiraFatura(cartao, data(t.date));
        if (m !== alvo) continue;
        const k = chave(t.description, centavos(t.amount) * (t.type === "CREDIT" ? -1 : 1));
        sobra.set(k, (sobra.get(k) ?? 0) + 1);
      }
      for (const l of comprasDaFatura(cartao.id, banco.compras, alvo)) {
        const k = chave(l.compra.descricao, l.valor);
        sobra.set(k, (sobra.get(k) ?? 0) - 1);
      }
      const soBanco = [...sobra].filter(([, n]) => n > 0).map(([k, n]) => `${k} x${n}`);
      const soApp = [...sobra].filter(([, n]) => n < 0).map(([k, n]) => `${k} x${-n}`);
      if (soBanco.length) linhas.push(`  ${alvo} só no banco: ${soBanco.slice(0, 15).join("; ")}`);
      if (soApp.length) {
        linhas.push(`  ${alvo} só no app: ${soApp.slice(0, 15).join("; ")}`);
        // Como essas compras do app foram montadas.
        for (const l of comprasDaFatura(cartao.id, banco.compras, alvo)) {
          const k = chave(l.compra.descricao, l.valor);
          if ((sobra.get(k) ?? 0) >= 0) continue;
          linhas.push(
            `    app: ${k} total=${l.compra.valor} parc=${l.parcela ?? "-"}/${l.compra.parcelas} primeira=${l.compra.mesPrimeira} data=${l.compra.data} id=${l.compra.externoId?.slice(-28)}`,
          );
        }
      }
      // Créditos (não pagamento) e pagamentos, para ver como o banco escreve.
      for (const t of transacoes.filter((t) => t.type === "CREDIT").slice(-6)) {
        linhas.push(
          `  crédito ${data(t.date)} ${t.amount} ${ehCompra(t) ? "estorno" : "pagamento"} cat=${t.category ?? "-"} desc=${t.description.slice(0, 26)}`,
        );
      }
    }
  }
  return linhas;
}

/* ───────────────────────── Contas e faturas pagas ───────────────────────── */

function marcarPago(
  banco: Dados,
  refTipo: "conta" | "fatura",
  refId: Id,
  mes: Mes,
  dono: { perfilId: Id | null; larId: Id | null },
) {
  const existente = banco.lancamentos.find(
    (l) => l.refTipo === refTipo && l.refId === refId && l.mes === mes,
  );
  if (existente) {
    existente.pago = true;
    return;
  }
  banco.lancamentos.push({
    id: novoId(),
    perfilId: dono.perfilId,
    larId: dono.larId,
    refTipo,
    refId,
    mes,
    valor: null,
    pago: true,
    pulado: false,
  });
}

/** Acha uma conta cadastrada com o mesmo valor naquele mês, ainda não paga, e marca como paga. */
function marcarContaPaga(
  banco: Dados,
  perfilId: Id,
  tipo: Transacao["tipo"],
  valor: number,
  mes: Mes,
): Conta | null {
  const lancs = indexarLancamentos(banco.lancamentos);
  const meuMorador = banco.moradores.find((m) => m.perfilId === perfilId);
  const natureza = tipo === "entrada" ? "receita" : "despesa";
  const conta = banco.contas.find((c) => {
    if (c.natureza !== natureza || !ocorreNoMes(c, mes) || c.metaId) return false;
    const minha = c.larId ? !!meuMorador && c.pagadorId === meuMorador.id : c.perfilId === perfilId;
    if (!minha) return false;
    const l = lancs.get(chaveLancamento("conta", c.id, mes));
    if (l?.pago || l?.pulado) return false;
    return (l?.valor ?? c.valor) === valor;
  });
  if (!conta) return null;
  marcarPago(banco, "conta", conta.id, mes, conta);
  return conta;
}

/** Pagamento de fatura no extrato: marca como paga a fatura de mesmo valor (deste mês ou do anterior). */
function marcarFaturaPaga(banco: Dados, perfilId: Id, valor: number, mes: Mes): boolean {
  const lancs = indexarLancamentos(banco.lancamentos);
  for (const m of [mes, addMes(mes, -1)]) {
    const cartao = banco.cartoes.find((k) => {
      if (k.perfilId !== perfilId) return false;
      if (lancs.get(chaveLancamento("fatura", k.id, m))?.pago) return false;
      return Math.abs(faturaDoMes(k.id, banco.compras, m) - valor) <= 100;
    });
    if (cartao) {
      marcarPago(banco, "fatura", cartao.id, m, cartao);
      return true;
    }
  }
  return false;
}
