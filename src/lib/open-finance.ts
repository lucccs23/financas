// Open Finance (via Pluggy): encaixa nos dados do app o que veio do banco.
//
// Regras:
// - Cada conta do banco vira uma carteira; cada cartão vira um cartão. O saldo
//   da carteira e o limite livre do cartão passam a bater com o banco.
// - Extrato da conta vira Transações. No cartão, cada lançamento do banco
//   (inclusive cada parcela) vira um lançamento na fatura que o banco indica,
//   para a fatura do app somar o mesmo que a do banco.
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
  valorParcela,
} from "./calc";
import { saldoCarteira } from "./calc-extra";
import { PARA_VOCE, sugerirCategoria } from "./categorias";
import { novoId } from "./dados/backend";
import { addMes } from "./meses";
import type {
  Carteira,
  Cartao,
  Compra,
  Conta,
  Dados,
  Id,
  Mes,
  Transacao,
} from "./types";

/* ───────────────────────── O que a Pluggy entrega ───────────────────────── */

export interface ContaPluggy {
  id: string;
  type: "BANK" | "CREDIT";
  subtype?: "CHECKING_ACCOUNT" | "SAVINGS_ACCOUNT" | "CREDIT_CARD" | string;
  name: string;
  marketingName?: string | null;
  balance: number;
  /** Dono da conta (nome e CPF), para reconhecer dinheiro entre contas dele. */
  owner?: string | null;
  taxNumber?: string | null;
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
  /**
   * O valor na moeda da conta (reais), quando a compra foi em outra moeda.
   * Em compra internacional, "amount" vem em dólar.
   */
  amountInAccountCurrency?: number | null;
  currencyCode?: string | null;
  type: "DEBIT" | "CREDIT";
  status?: "PENDING" | "POSTED";
  category?: string | null;
  /** Quem pagou e quem recebeu (Pix, TED): nome e documento. */
  paymentData?: {
    payer?: ParteDoPagamento | null;
    receiver?: ParteDoPagamento | null;
  } | null;
  /** Estabelecimento: nome e o tipo de negócio. */
  merchant?: {
    name?: string | null;
    businessName?: string | null;
    category?: string | null;
  } | null;
  creditCardMetadata?: {
    /** Código do tipo de estabelecimento (MCC): 5411 mercado, 5541 posto... */
    payeeMCC?: number | null;
    installmentNumber?: number | null;
    totalInstallments?: number | null;
    totalAmount?: number | null;
    purchaseDate?: string | null;
    /** Mês da fatura (AAAA-MM) em que esta cobrança cai. */
    billForecastDate?: string | null;
  } | null;
}

/** Fatura fechada, como o banco informa (total oficial). */
export interface FaturaOficial {
  dueDate: string;
  totalAmount: number;
}

interface ParteDoPagamento {
  name?: string | null;
  documentNumber?: { value?: string | null } | null;
}

/** Uma conexão (um banco no Meu Pluggy), já ligada a um perfil do app. */
export interface ConexaoBuscada {
  perfilId: Id;
  banco: string;
  contas: {
    conta: ContaPluggy;
    transacoes: TransacaoPluggy[];
    faturas?: FaturaOficial[];
  }[];
}

/** Compra em outra moeda: usa o valor em reais (com o mesmo sinal). */
export function emReais(t: TransacaoPluggy): TransacaoPluggy {
  const convertido = t.amountInAccountCurrency;
  if (convertido == null || convertido === 0) return t;
  return { ...t, amount: (t.amount < 0 ? -1 : 1) * Math.abs(convertido) };
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

/** A busca automática roda 3 vezes por dia: mais de 12 horas sem rodar é sinal de problema. */
export function buscaParada(
  status: Pick<StatusOpenFinance, "buscadoEm">,
  agora = Date.now(),
) {
  return agora - Date.parse(status.buscadoEm) > 12 * 3_600_000;
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
export function nomeDoBanco(
  contas: Pick<ContaPluggy, "name" | "marketingName" | "bankData">[],
) {
  for (const c of contas) {
    const texto = normalizar(`${c.marketingName ?? ""} ${c.name ?? ""}`);
    const achado = NOMES.find(([r]) => r.test(texto))?.[1];
    if (achado) return achado;
  }
  for (const c of contas) {
    const codigo =
      c.bankData?.transferNumber?.match(/^\s*(\d{1,3})\s*[/-]/)?.[1];
    if (codigo && CODIGOS[codigo.padStart(3, "0")])
      return CODIGOS[codigo.padStart(3, "0")];
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

const centavos = (v: number | null | undefined) =>
  Math.round(Math.abs(v ?? 0) * 100);
const dia = (iso: string | null | undefined) =>
  iso ? Number(String(iso).slice(8, 10)) || 0 : 0;
const data = (iso: string | null | undefined) =>
  iso ? String(iso).slice(0, 10) : "";

function diasEntre(a: string, b: string) {
  return (
    Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) /
    86_400_000
  );
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
    .replace(
      /\s*[-–]?\s*(parc(ela)?\.?\s*)?\d{1,2}\s*(\/|de)\s*\d{1,2}\s*$/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

/** Código do tipo de estabelecimento (MCC, padrão das bandeiras) → categoria do app. */
export function categoriaDoMcc(mcc: number | null | undefined): string | null {
  if (!mcc) return null;
  const faixas: [number, number, string][] = [
    [3000, 3350, "lazer"], // companhias aéreas
    [3351, 3500, "transporte"], // locadoras de carro
    [3501, 3999, "lazer"], // hotéis
    [4011, 4131, "transporte"], // trem, ônibus, metrô, táxi
    [4511, 4582, "lazer"], // aéreo e aeroportos
    [4722, 4722, "lazer"], // agências de viagem
    [4784, 4789, "transporte"], // pedágio
    [4812, 4816, "internet"], // telefone e internet
    [4899, 4899, "assinatura"], // TV por assinatura e streaming
    [4900, 4900, "outros"], // contas de consumo (luz, água, gás juntas)
    [5200, 5399, "compras"], // casa, construção, lojas de departamento
    [5411, 5411, "mercado"],
    [5422, 5499, "mercado"], // açougue, padaria, hortifrúti
    [5511, 5599, "transporte"], // carro, peças, posto (5541/5542)
    [5600, 5699, "compras"], // roupas e calçados
    [5700, 5799, "compras"], // móveis e eletrônicos
    [5811, 5814, "alimentacao"], // restaurantes, bares, fast food
    [5815, 5815, "assinatura"], // mídia digital
    [5816, 5816, "lazer"], // jogos digitais
    [5817, 5818, "assinatura"], // apps e serviços digitais
    [5912, 5912, "saude"], // farmácia
    [5940, 5941, "compras"], // esporte
    [5942, 5943, "educacao"], // livraria e papelaria
    [5944, 5999, "compras"],
    [7011, 7033, "lazer"], // hospedagem
    [7512, 7549, "transporte"], // aluguel de carro, estacionamento, oficina
    [7829, 7841, "lazer"], // cinema e vídeo
    [7911, 7999, "lazer"], // diversão, shows, academias e clubes
    [8011, 8099, "saude"], // médicos, dentistas, hospitais
    [8211, 8299, "educacao"], // escolas, cursos, faculdades
  ];
  return faixas.find(([de, ate]) => mcc >= de && mcc <= ate)?.[2] ?? null;
}

/**
 * Traduz a categoria da Pluggy para a do app. Sem tradução, tenta o tipo do
 * estabelecimento (MCC), a categoria do comerciante e as pistas da descrição.
 */
export function categoriaDaPluggy(
  categoria: string | null | undefined,
  descricao: string,
  tipo: "entrada" | "saida",
  extra: {
    mcc?: number | null;
    comerciante?: string | null;
    ramo?: string | null;
  } = {},
): string {
  const c = normalizar(categoria ?? "");
  if (tipo === "entrada") {
    if (/refund|reembols|cashback/.test(c)) return "reembolso";
    if (/transfer/.test(c)) return "transferencia";
    return "renda";
  }
  const regras: [RegExp, string][] = [
    [/credit card payment/, "cartao"],
    [
      /bank fees|credit card fees|account fees|atm fees|interest|late payment|overdraft|tax on financial/,
      "tarifa",
    ],
    [
      /same person|transfer|boleto|bank slip|\bpix\b|\bted\b|\bdoc\b/,
      "transferencia",
    ],
    [
      /investment|fixed income|mutual fund|variable income|pension|margin/,
      "reserva",
    ],
    [
      /gas station|parking|toll|vehicle|automotive|taxi|ride|public transport|car rental|bicycle|transportation/,
      "transporte",
    ],
    [/groceries|supermarket/, "mercado"],
    [/eating out|food delivery|food and drinks|restaurant/, "alimentacao"],
    [/streaming|digital services/, "assinatura"],
    [/telecommunication|internet|mobile|\btv\b/, "internet"],
    [/education|course|university|school|kindergarten|bookstore/, "educacao"],
    [
      /health|pharmacy|dentist|optometry|hospital|clinic|lab|gym|fitness|wellness/,
      "saude",
    ],
    [/real estate financing|vehicle financing|student loan/, "financiamento"],
    [/\brent\b/, "aluguel"],
    [/electricity/, "luz"],
    [/water/, "agua"],
    [/^gas$|utilities.*gas/, "gas"],
    [
      /shopping|electronics|clothing|pet|kids|toys|sports goods|office|houseware|online shopping/,
      "compras",
    ],
    [
      /leisure|ticket|cinema|theater|concert|museum|stadium|travel|airline|accommodation|bus ticket|gaming|gambling|lottery|bet/,
      "lazer",
    ],
    [/donation/, "familia"],
  ];
  const pelaRegra = (texto: string) => regras.find(([r]) => r.test(texto))?.[1];
  const achada = pelaRegra(c);
  // "Transferência" e "Compras" são vagas: o estabelecimento costuma dizer mais.
  if (achada && achada !== "compras" && achada !== "transferencia")
    return achada;
  const doMcc = categoriaDoMcc(extra.mcc);
  if (doMcc && doMcc !== "outros") return doMcc;
  const doRamo = extra.ramo ? pelaRegra(normalizar(extra.ramo)) : undefined;
  if (doRamo && doRamo !== "transferencia") return doRamo;
  const pelaDescricao = sugerirCategoria(
    `${descricao} ${extra.comerciante ?? ""}`,
  );
  if (pelaDescricao !== "outros") return pelaDescricao;
  return achada ?? "outros";
}

/**
 * Categoria dada pelo app numa busca anterior que vale tentar de novo: "Outros"
 * e o Mercado Livre que uma versão antiga punha em "Mercado". Uma categoria que
 * você escolheu não entra aqui.
 */
function categoriaParaRever(
  categoria: string | null | undefined,
  descricao: string,
) {
  const c = categoria ?? "outros";
  return (
    c === "outros" || (c === "mercado" && /mercado ?livre/i.test(descricao))
  );
}

/** O que a Pluggy sabe do estabelecimento, para escolher a categoria. */
const doEstabelecimento = (t: TransacaoPluggy) => ({
  mcc: t.creditCardMetadata?.payeeMCC,
  comerciante: t.merchant?.name ?? t.merchant?.businessName,
  ramo: t.merchant?.category,
});

/** "GOLD" e "gold" viram "Gold"; nomes já escritos com maiúsculas ficam. */
export function nomeBonito(nome: string) {
  const t = nome.trim();
  if (t !== t.toUpperCase() && t !== t.toLowerCase()) return t;
  return t
    .toLowerCase()
    .replace(
      /(^|[\s-])(\p{L})/gu,
      (_, a: string, b: string) => a + b.toUpperCase(),
    );
}

/** Dinheiro que só muda de lugar: não é gasto nem renda nova. */
function soMudaDeLugar(categoria: string | null | undefined) {
  const c = normalizar(categoria ?? "");
  return (
    /same person|credit card payment/.test(c) ||
    (/investment|fixed income|mutual fund|variable income|pension|margin/.test(
      c,
    ) &&
      !/dividend|interest|proceeds/.test(c))
  );
}

/**
 * Dinheiro entre contas da mesma pessoa: o outro lado do Pix/TED é o dono da
 * conta (mesmo CPF ou mesmo nome completo), mesmo quando o banco não classifica
 * como "same person transfer".
 */
/**
 * Pix pago com o cartão para você mesmo (RecargaPay mostra "Recargapay
 * *Lucasmart", com o começo do nome de quem pagou). Conta como gasto (você
 * paga a fatura); só fica numa categoria própria.
 */
export function paraVoceMesmo(
  descricao: string,
  nomes: (string | null | undefined)[],
): boolean {
  const m = normalizar(descricao).match(/recarga ?pay\s*\*\s*([a-z]{4,})/);
  if (!m) return false;
  const apelido = m[1];
  return nomes.some((n) => {
    const junto = normalizar(n ?? "").replace(/[^a-z]/g, "");
    const primeiro = normalizar(n ?? "").split(" ")[0] ?? "";
    return (
      junto.length >= 4 &&
      (junto.startsWith(apelido) ||
        (primeiro.length >= 3 && apelido.startsWith(primeiro)))
    );
  });
}

export function entreContasDoDono(
  t: TransacaoPluggy,
  conta: ContaPluggy,
): boolean {
  const outro =
    t.type === "CREDIT" ? t.paymentData?.payer : t.paymentData?.receiver;
  const digitos = (v: string | null | undefined) =>
    (v ?? "").replace(/\D/g, "");
  const meuCpf = digitos(conta.taxNumber);
  const cpfDoOutro = digitos(outro?.documentNumber?.value);
  if (meuCpf.length === 11 && cpfDoOutro === meuCpf) return true;
  const dono = normalizar(conta.owner ?? "");
  // Nome completo (duas palavras ou mais), para não confundir parentes.
  if (dono.split(" ").length < 2) return false;
  if (outro?.name && normalizar(outro.name) === dono) return true;
  return normalizar(t.description).includes(dono);
}

function ehSalario(categoria: string | null | undefined) {
  return /salary|pro-labore|retirement/.test(normalizar(categoria ?? ""));
}

function ehPagamentoDeFatura(
  categoria: string | null | undefined,
  descricao: string,
) {
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

    for (const { conta, transacoes, faturas } of conexao.contas) {
      const comValor = transacoes.map(emReais).filter((t) => t.amount !== 0);
      if (conta.type === "CREDIT") {
        aplicarCartao(
          banco,
          conexao,
          conta,
          comValor,
          hoje,
          mesHoje,
          resumo,
          faturas ?? [],
        );
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
  if (
    carteira &&
    conexao.banco !== "Banco" &&
    nomeAutomatico(carteira.nome, conta)
  ) {
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

  const jaVieram = new Set(
    banco.transacoes.map((t) => t.externoId).filter(Boolean),
  );
  const perfil = banco.perfis.find((p) => p.id === perfilId)!;

  for (const t of [...transacoes].sort((a, b) =>
    a.date.localeCompare(b.date),
  )) {
    if (jaVieram.has(t.id)) {
      // Ficou em "Outros" numa busca anterior: tenta de novo. A sua escolha fica.
      const antiga = banco.transacoes.find((x) => x.externoId === t.id);
      // Salário que uma versão anterior pôs em "Renda extra".
      if (
        antiga &&
        antiga.tipo === "entrada" &&
        antiga.categoria === "renda" &&
        ehSalario(t.category)
      ) {
        antiga.categoria = "salario";
      }
      // Salário que já conta em Minha renda (cadastrado depois): sai do resumo.
      if (
        antiga &&
        antiga.categoria === "salario" &&
        !antiga.soSaldo &&
        rendaNoMes(perfil, antiga.data.slice(0, 7)).salario > 0
      ) {
        antiga.soSaldo = true;
        antiga.observacao ||= "Salário (já está em Minha renda)";
      }
      if (antiga && !antiga.soSaldo && entreContasDoDono(t, conta)) {
        antiga.soSaldo = true;
        antiga.observacao ||= "Entre contas suas";
      }
      if (
        antiga &&
        antiga.tipo === "saida" &&
        categoriaParaRever(antiga.categoria, antiga.descricao)
      ) {
        antiga.categoria = categoriaDaPluggy(
          t.category,
          t.description,
          "saida",
          doEstabelecimento(t),
        );
      }
      continue;
    }
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
    if (!soSaldo && entreContasDoDono(t, conta)) {
      soSaldo = true;
      observacao = "Entre contas suas";
    }
    const salario = tipo === "entrada" && ehSalario(t.category);
    if (salario && rendaNoMes(perfil, mes).salario > 0) {
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
      categoria: salario
        ? "salario"
        : categoriaDaPluggy(
            t.category,
            t.description,
            tipo,
            doEstabelecimento(t),
          ),
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
  const movimento = saldoCarteira(
    { ...carteira, saldoInicial: 0 },
    banco.transacoes,
  );
  carteira.saldoInicial = Math.round(conta.balance * 100) - movimento;
}

const ehMes = (m: string | null | undefined): m is string =>
  !!m && /^\d{4}-\d{2}$/.test(m);

function somarDias(iso: string, n: number) {
  return new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** Compra (ou estorno) do cartão que entra no app. Pagamento da fatura não entra. */
function ehCompra(t: TransacaoPluggy) {
  if (t.type !== "CREDIT") return true;
  // No cartão, crédito que começa com "pagamento" é pagamento da fatura (o Inter
  // escreve "PAGAMENTO ON LINE" e ainda classifica como compra).
  const texto = normalizar(t.description);
  if (/^(pag(amento|to)?|pgto)\b/.test(texto) && !/estorno/.test(texto))
    return false;
  return !ehPagamentoDeFatura(t.category, t.description);
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
  const maisRecente = aVista.reduce((a, b) =>
    data(b.date) > data(a.date) ? b : a,
  );
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
  const debitos = transacoes.filter(
    (t) =>
      t.type === "DEBIT" &&
      ehMes(t.creditCardMetadata?.billForecastDate) &&
      data(t.date) <= hoje,
  );
  const aVista = debitos.filter(
    (t) => (t.creditCardMetadata?.installmentNumber ?? 1) <= 1,
  );
  if (!aVista.length) return null;
  const aberta = aVista.reduce((a, b) => (data(b.date) > data(a.date) ? b : a))
    .creditCardMetadata!.billForecastDate!;
  const datas = (rotulo: string) =>
    debitos
      .filter((t) => t.creditCardMetadata!.billForecastDate === rotulo)
      .map((t) => data(t.date))
      .sort();
  const primeiraAberta = datas(aberta)[0];
  const ultimaAnterior = datas(addMes(aberta, -1)).at(-1);
  // Lançamentos dos dois lados da virada, poucos dias entre eles: dá para confiar.
  if (ultimaAnterior && diasEntre(ultimaAnterior, primeiraAberta) <= 5) {
    return { dia: dia(ultimaAnterior), certo: true };
  }
  return { dia: dia(somarDias(primeiraAberta, -1)), certo: false };
}

const MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/**
 * Quanto da última fatura fechada (já vencida) ficou sem pagar. Os pagamentos
 * dela são os que caem na fatura seguinte. Null quando foi paga inteira (ou
 * quase: diferença de até R$ 1) ou quando o banco não manda as faturas.
 */
export function saldoNaoPago(
  faturas: FaturaOficial[],
  pagamentos: TransacaoPluggy[],
  mesDaFatura: (t: TransacaoPluggy) => Mes,
  hoje: string,
): {
  mes: Mes;
  proxima: Mes;
  valor: number;
  vencimento: string;
  rotulo: string;
} | null {
  const vencidas = faturas
    .filter(
      (f) =>
        f.dueDate && data(f.dueDate) < hoje && Number.isFinite(f.totalAmount),
    )
    .sort((a, b) => data(b.dueDate).localeCompare(data(a.dueDate)));
  const ultima = vencidas[0];
  if (!ultima) return null;
  const mes = data(ultima.dueDate).slice(0, 7);
  const proxima = addMes(mes, 1);
  const pago = pagamentos
    .filter((t) => mesDaFatura(t) === proxima)
    .reduce((s, t) => s + Math.abs(centavos(t.amount)), 0);
  const valor = centavos(ultima.totalAmount) - pago;
  if (valor <= 100) return null;
  const [ano, m] = mes.split("-");
  return {
    mes,
    proxima,
    valor,
    vencimento: data(ultima.dueDate),
    rotulo: `${MESES[Number(m) - 1]}/${ano.slice(2)}`,
  };
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
  faturas: FaturaOficial[] = [],
) {
  const { perfilId } = conexao;
  const credito = conta.creditData ?? {};
  const nomesDoDono = [
    conta.owner,
    banco.perfis.find((p) => p.id === perfilId)?.nome,
  ];
  const categoriaDaCompra = (t: TransacaoPluggy) =>
    paraVoceMesmo(t.description, nomesDoDono)
      ? PARA_VOCE
      : categoriaDaPluggy(
          t.category,
          t.description,
          "saida",
          doEstabelecimento(t),
        );
  let cartao = banco.cartoes.find((c) => c.externoId === conta.id);
  // O cartão se chama pelo banco ("Nubank", "Inter"). O nome comercial
  // ("Gold", "Platinum") só entra quando o mesmo banco tem mais de um cartão.
  const nomeComercial = conta.marketingName?.trim() || conta.name?.trim() || "";
  const variosNoBanco =
    conexao.contas.filter((c) => c.conta.type === "CREDIT").length > 1;
  const nomePadrao =
    conexao.banco === "Banco"
      ? nomeBonito(nomeComercial || "Cartão")
      : variosNoBanco && nomeComercial
        ? `${conexao.banco} ${nomeBonito(nomeComercial)}`
        : conexao.banco;

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
      nome: nomePadrao,
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
    if (
      conexao.banco !== "Banco" &&
      (!cartao.banco || nomeAutomatico(cartao.banco, conta))
    ) {
      cartao.banco = conexao.banco;
    }
    // Nome que o app deu numa busca anterior ("GOLD", "gold"...): passa a ser
    // o do banco. Um nome que você mesmo escolheu fica.
    if (
      [nomeComercial, nomeBonito(nomeComercial), "Banco", "Cartão"].includes(
        cartao.nome,
      ) ||
      nomeAutomatico(cartao.nome, conta)
    ) {
      cartao.nome = nomePadrao;
    }
    if (credito.creditLimit != null)
      cartao.limite = centavos(credito.creditLimit);
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
    return ehMes(rotulo)
      ? addMes(rotulo, deslocamento)
      : mesPrimeiraFatura(doCartao, data(t.date));
  };

  // Pagamento que uma versão anterior leu como estorno: sai das faturas.
  const pagamentos = new Set(
    transacoes
      .filter((t) => !ehCompra(t))
      .flatMap((t) => {
        const base = semParcela(t.description.trim()) || t.description.trim();
        const quando = data(t.creditCardMetadata?.purchaseDate) || data(t.date);
        const chave = `${conta.id}|${quando}|${-centavos(t.amount)}|1|${normalizar(base)}`;
        return [t.id, chave, `${chave}#2`, `${chave}#3`];
      }),
  );
  banco.compras = banco.compras.filter(
    (c) =>
      !(
        c.cartaoId === doCartao.id &&
        c.externoId &&
        pagamentos.has(c.externoId)
      ),
  );

  // Modelo antigo (uma compra parcelada inteira, com as parcelas calculadas
  // aqui): sai, e cada parcela volta como o banco lança.
  banco.compras = banco.compras.filter(
    (c) =>
      !(
        c.cartaoId === doCartao.id &&
        c.externoId &&
        c.parcelas > 1 &&
        !c.externoId.endsWith("|manual")
      ),
  );
  // Parcelada lançada à mão: fica como você lançou (ligada ao banco) e as
  // parcelas do banco para essa compra não entram de novo.
  const parceladaManual = (
    parcelas: number,
    base: string,
    compradoEm: string,
    valor: number,
    mes: Mes,
  ) => {
    const chave = `${conta.id}|${compradoEm}|${parcelas}|${normalizar(base)}|manual`;
    const ligada = banco.compras.find(
      (c) => c.cartaoId === doCartao.id && c.externoId === chave,
    );
    if (ligada) return chave;
    const livre = banco.compras.find(
      (c) =>
        !c.externoId &&
        !c.recorrente &&
        c.cartaoId === doCartao.id &&
        c.parcelas === parcelas &&
        diasEntre(c.data, compradoEm) <= 3 &&
        Math.abs(valorParcela(c, mes) - valor) <= parcelas,
    );
    if (!livre) return null;
    livre.externoId = chave;
    resumo.ligadas++;
    return chave;
  };

  // Cada lançamento do banco vira um lançamento na fatura que o banco indica:
  // assim a fatura do app soma o mesmo que a do banco. A chave não muda quando
  // o lançamento sai de "pendente" (o id do banco pode mudar); lançamentos
  // iguais ganham #2, #3...
  const vistas = new Map<string, number>();
  const ordenadas = [...transacoes]
    .filter(ehCompra)
    .sort(
      (a, b) =>
        data(a.date).localeCompare(data(b.date)) || a.id.localeCompare(b.id),
    );
  const chaves = new Set<string>();

  for (const t of ordenadas) {
    const meta = t.creditCardMetadata ?? {};
    const parcelas = Math.max(1, meta.totalInstallments ?? 1);
    const numero = Math.min(parcelas, Math.max(1, meta.installmentNumber ?? 1));
    const valor = centavos(t.amount) * (t.type === "CREDIT" ? -1 : 1); // estorno abate
    const base = semParcela(t.description.trim()) || t.description.trim();
    const descricao =
      parcelas > 1 ? `${base} · parcela ${numero}/${parcelas}` : base;
    const compradoEm = data(meta.purchaseDate) || data(t.date);

    let chave =
      parcelas > 1
        ? `${conta.id}|${compradoEm}|${parcelas}|${normalizar(base)}|${numero}`
        : `${conta.id}|${compradoEm}|${valor}|1|${normalizar(base)}`;
    const n = (vistas.get(chave) ?? 0) + 1;
    vistas.set(chave, n);
    if (n > 1) chave += `#${n}`;
    chaves.add(chave);

    const mesPrimeira = mesDaFatura(t);
    if (parcelas > 1) {
      const manual = parceladaManual(
        parcelas,
        base,
        compradoEm,
        valor,
        mesPrimeira,
      );
      if (manual) {
        chaves.add(manual);
        continue;
      }
    }
    // Já veio antes (pela chave nova ou pelo id do banco, das primeiras buscas)?
    const existente = banco.compras.find(
      (c) =>
        c.cartaoId === doCartao.id &&
        (c.externoId === chave || c.externoId === t.id),
    );
    if (existente) {
      existente.externoId = chave;
      existente.mesPrimeira = mesPrimeira; // o banco manda na fatura e no valor
      existente.valor = valor;
      // Ficou em "Outros" numa busca anterior: tenta de novo com o que o banco
      // sabe do estabelecimento. Uma categoria que você escolheu fica.
      if (categoriaParaRever(existente.categoria, existente.descricao)) {
        existente.categoria = categoriaDaCompra(t);
      }
      // Pix para você mesmo que entrou antes como "Transferência" (a categoria
      // automática de antes) ganha a categoria própria.
      if (
        existente.categoria === "transferencia" &&
        categoriaDaCompra(t) === PARA_VOCE
      ) {
        existente.categoria = PARA_VOCE;
      }
      continue;
    }

    const manual = banco.compras.find(
      (c) =>
        !c.externoId &&
        c.cartaoId === doCartao.id &&
        c.parcelas === 1 &&
        c.valor === valor &&
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
      parcelas: 1,
      recorrente: false,
      mesPrimeira,
      mesFim: null,
      data: compradoEm,
      categoria: categoriaDaCompra(t),
      externoId: chave,
    } satisfies Compra);
    resumo.compras++;
  }

  // Lançamento que veio do banco e sumiu dele (autorização cancelada, parcela
  // antecipada) sai também daqui, mas só das faturas em aberto e futuras, que a
  // busca cobre inteiras.
  // Lista vazia é falha da busca, não fatura zerada: nesse caso nada sai.
  // Saldo da fatura anterior que ficou sem pagar: o banco passa para a fatura
  // seguinte. Vem da última fatura oficial já vencida, menos os pagamentos
  // feitos para ela (que aparecem na fatura seguinte).
  const saldo = saldoNaoPago(
    faturas,
    transacoes.filter((t) => !ehCompra(t)),
    mesDaFatura,
    hoje,
  );
  if (saldo) {
    const chave = `${conta.id}|saldo-anterior|${saldo.mes}`;
    chaves.add(chave);
    const existente = banco.compras.find(
      (c) => c.cartaoId === doCartao.id && c.externoId === chave,
    );
    if (existente) {
      existente.valor = saldo.valor;
      existente.mesPrimeira = saldo.proxima;
    } else {
      banco.compras.push({
        id: novoId(),
        cartaoId: doCartao.id,
        perfilId,
        larId: doCartao.larId,
        descricao: `Saldo da fatura de ${saldo.rotulo} não pago`,
        valor: saldo.valor,
        parcelas: 1,
        recorrente: false,
        mesPrimeira: saldo.proxima,
        mesFim: null,
        data: saldo.vencimento,
        categoria: "cartao",
        externoId: chave,
      } satisfies Compra);
      resumo.compras++;
    }
  }

  const abertaDesde = mesPrimeiraFatura(doCartao, hoje);
  banco.compras = banco.compras.filter(
    (c) =>
      !ordenadas.length ||
      c.cartaoId !== doCartao.id ||
      !c.externoId ||
      c.mesPrimeira < abertaDesde ||
      chaves.has(c.externoId),
  );

  // Pagamento da fatura feito ao cartão: a fatura anterior está paga. Vale
  // também o pagamento ainda "pendente" (Nubank e Inter mostram assim por
  // dias, mesmo com o dinheiro já debitado).
  const mesesPagos = new Set(
    transacoes
      .filter((t) => !ehCompra(t))
      .map((t) => addMes(mesDaFatura(t), -1))
      .filter((m) => m <= mesHoje),
  );
  // Faturas de antes do primeiro pagamento que a busca alcança (90 dias):
  // o banco já recebeu pagamentos depois delas, então também estão pagas.
  if (mesesPagos.size) {
    const primeiroPago = [...mesesPagos].sort()[0];
    for (const c of banco.compras) {
      if (c.cartaoId === doCartao.id && c.mesPrimeira < primeiroPago)
        mesesPagos.add(c.mesPrimeira);
    }
  }
  for (const paga of mesesPagos) {
    const ja = banco.lancamentos.find(
      (l) =>
        l.refTipo === "fatura" &&
        l.refId === doCartao.id &&
        l.mes === paga &&
        l.pago,
    );
    if (!ja) {
      marcarPago(banco, "fatura", doCartao.id, paga, doCartao);
      resumo.pagas++;
    }
  }

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
export function conferirCartoes(
  banco: Dados,
  conexoes: ConexaoBuscada[],
  hoje: string,
): string[] {
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
        const m = ehMes(r)
          ? addMes(r, desloc)
          : mesPrimeiraFatura(cartao, data(t.date));
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
        linhas.push(
          `  ${m}: banco ${b.toFixed(2)} · app ${a.toFixed(2)}${Math.abs(a - b) > 0.05 ? "  <- diferente" : ""}`,
        );
      }
      // Item a item, na fatura do mês que vem: o que só um dos lados tem.
      const alvo = addMes(mesHoje, 1);
      const chave = (desc: string, v: number) =>
        `${normalizar(semParcela(desc)).slice(0, 12)}|${v}`;
      const sobra = new Map<string, number>();
      for (const t of validas) {
        const r = t.creditCardMetadata?.billForecastDate;
        const m = ehMes(r)
          ? addMes(r, desloc)
          : mesPrimeiraFatura(cartao, data(t.date));
        if (m !== alvo) continue;
        const k = chave(
          t.description,
          centavos(t.amount) * (t.type === "CREDIT" ? -1 : 1),
        );
        sobra.set(k, (sobra.get(k) ?? 0) + 1);
      }
      for (const l of comprasDaFatura(cartao.id, banco.compras, alvo)) {
        const k = chave(l.compra.descricao, l.valor);
        sobra.set(k, (sobra.get(k) ?? 0) - 1);
      }
      const soBanco = [...sobra]
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${k} x${n}`);
      const soApp = [...sobra]
        .filter(([, n]) => n < 0)
        .map(([k, n]) => `${k} x${-n}`);
      if (soBanco.length)
        linhas.push(
          `  ${alvo} só no banco: ${soBanco.slice(0, 15).join("; ")}`,
        );
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
    if (c.natureza !== natureza || !ocorreNoMes(c, mes) || c.metaId)
      return false;
    const minha = c.larId
      ? !!meuMorador && c.pagadorId === meuMorador.id
      : c.perfilId === perfilId;
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
function marcarFaturaPaga(
  banco: Dados,
  perfilId: Id,
  valor: number,
  mes: Mes,
): boolean {
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
