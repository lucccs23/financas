// Motor de cálculo. Só funções puras: recebem os dados e devolvem números.
// Nada aqui lê relógio, tela ou banco, então tudo pode ser testado.

import { addMes, diasNoMes, diffMes } from "./meses";
import type {
  Acerto,
  Cartao,
  Compra,
  Dados,
  Id,
  Lancamento,
  Mes,
  Meta,
  Morador,
  MudancaRenda,
  Natureza,
  Perfil,
  Transacao,
} from "./types";

const soma = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

/* ───────────────────────── Recorrência ───────────────────────── */

export function ocorreNoMes(
  x: { recorrente: boolean; mesInicio: Mes; mesFim: Mes | null },
  mes: Mes,
): boolean {
  if (!x.recorrente) return mes === x.mesInicio;
  return mes >= x.mesInicio && (x.mesFim === null || mes <= x.mesFim);
}

/* ───────────────────────── Cartões ───────────────────────── */

/** Quanto desta compra cai na fatura do mês. Os centavos que sobram da divisão vão nas primeiras parcelas. */
export function valorParcela(compra: Compra, mes: Mes): number {
  if (compra.recorrente) {
    const ativa = mes >= compra.mesPrimeira && (compra.mesFim === null || mes <= compra.mesFim);
    return ativa ? compra.valor : 0;
  }
  const n = Math.max(1, compra.parcelas);
  const i = diffMes(mes, compra.mesPrimeira);
  if (i < 0 || i >= n) return 0;
  const base = Math.floor(compra.valor / n);
  const resto = compra.valor - base * n;
  return base + (i < resto ? 1 : 0);
}

/** Número da parcela (1, 2, 3...) ou null quando é à vista ou assinatura. */
export function numeroParcela(compra: Compra, mes: Mes): number | null {
  if (compra.recorrente || compra.parcelas <= 1) return null;
  const i = diffMes(mes, compra.mesPrimeira);
  return i >= 0 && i < compra.parcelas ? i + 1 : null;
}

/** Sufixo que a busca no banco põe nas parcelas: "Loja · parcela 3/10". */
const SUFIXO_PARCELA = / · parcela (\d+)\/(\d+)$/;

/**
 * Parcela de uma compra naquele mês, seja calculada aqui (compra parcelada
 * lançada no app) ou informada pelo banco (cada parcela é um lançamento).
 */
export function parcelaDaCompra(
  compra: Compra,
  mes: Mes,
): { numero: number; total: number; doBanco: boolean } | null {
  const m = compra.parcelas <= 1 ? compra.descricao.match(SUFIXO_PARCELA) : null;
  if (m) return { numero: Number(m[1]), total: Number(m[2]), doBanco: true };
  const numero = numeroParcela(compra, mes);
  return numero ? { numero, total: compra.parcelas, doBanco: false } : null;
}

/** Descrição sem o sufixo de parcela que a busca no banco acrescenta. */
export const semSufixoDeParcela = (descricao: string) => descricao.replace(SUFIXO_PARCELA, "");

export function faturaDoMes(cartaoId: Id, compras: Compra[], mes: Mes): number {
  return soma(compras.filter((c) => c.cartaoId === cartaoId).map((c) => valorParcela(c, mes)));
}

export interface LinhaFatura {
  compra: Compra;
  valor: number;
  parcela: number | null;
}

export function comprasDaFatura(cartaoId: Id, compras: Compra[], mes: Mes): LinhaFatura[] {
  return (
    compras
      .filter((c) => c.cartaoId === cartaoId)
      .map((compra) => ({
        compra,
        valor: valorParcela(compra, mes),
        parcela: numeroParcela(compra, mes),
      }))
      // Estornos (valor negativo) também aparecem: abatem a fatura.
      .filter((l) => l.valor !== 0)
      .sort((a, b) => b.compra.data.localeCompare(a.compra.data))
  );
}

/**
 * Em qual fatura cai uma compra feita na data informada.
 * Depois do fechamento, vai para a fatura seguinte. Quando o vencimento
 * é em dia menor ou igual ao fechamento, a fatura vence no mês seguinte.
 */
export function mesPrimeiraFatura(
  cartao: Pick<Cartao, "diaFechamento" | "diaVencimento">,
  data: string,
): Mes {
  let mes = data.slice(0, 7);
  const dia = Number(data.slice(8, 10));
  if (dia > cartao.diaFechamento) mes = addMes(mes, 1);
  if (cartao.diaVencimento <= cartao.diaFechamento) mes = addMes(mes, 1);
  return mes;
}

/* ───────────────────────── Itens do mês ───────────────────────── */

export const chaveLancamento = (refTipo: Lancamento["refTipo"], refId: Id, mes: Mes) =>
  `${refTipo}:${refId}:${mes}`;

export function indexarLancamentos(lancamentos: Lancamento[]): Map<string, Lancamento> {
  return new Map(lancamentos.map((l) => [chaveLancamento(l.refTipo, l.refId, l.mes), l]));
}

/** Uma conta ou fatura já resolvida para um mês: valor final, vencimento e situação. */
export interface ItemMes {
  chave: string;
  refTipo: Lancamento["refTipo"];
  refId: Id;
  nome: string;
  valor: number;
  valorCadastrado: number;
  dia: number;
  pago: boolean;
  estimada: boolean;
  moradia: boolean;
  natureza: Natureza;
  escopo: "casa" | "pessoal";
  categoria: string;
  perfilId: Id | null;
  larId: Id | null;
  pagadorId: Id | null;
  participantes: Record<Id, number> | null;
}

export function itensDoMes(dados: Dados, mes: Mes): ItemMes[] {
  const lancs = indexarLancamentos(dados.lancamentos);
  const itens: ItemMes[] = [];

  for (const c of dados.contas) {
    if (!ocorreNoMes(c, mes)) continue;
    const l = lancs.get(chaveLancamento("conta", c.id, mes));
    if (l?.pulado) continue;
    itens.push({
      chave: `conta:${c.id}`,
      refTipo: "conta",
      refId: c.id,
      nome: c.nome,
      valor: l?.valor ?? c.valor,
      valorCadastrado: c.valor,
      dia: Math.min(Math.max(1, c.diaVencimento), diasNoMes(mes)),
      pago: !!l?.pago,
      estimada: c.estimada && (l?.valor ?? null) === null,
      moradia: c.moradia,
      natureza: c.natureza,
      escopo: c.larId ? "casa" : "pessoal",
      categoria: c.categoria,
      perfilId: c.perfilId,
      larId: c.larId,
      pagadorId: c.pagadorId,
      participantes: c.participantes,
    });
  }

  for (const k of dados.cartoes) {
    const valor = faturaDoMes(k.id, dados.compras, mes);
    if (valor <= 0) continue;
    const l = lancs.get(chaveLancamento("fatura", k.id, mes));
    const dono = dados.moradores.find((m) => m.perfilId === k.perfilId);
    itens.push({
      chave: `fatura:${k.id}`,
      refTipo: "fatura",
      refId: k.id,
      nome: `Fatura ${k.nome}`,
      valor,
      valorCadastrado: valor,
      dia: Math.min(Math.max(1, k.diaVencimento), diasNoMes(mes)),
      pago: !!l?.pago,
      estimada: false,
      moradia: false,
      natureza: "despesa",
      escopo: k.larId ? "casa" : "pessoal",
      categoria: "cartao",
      perfilId: k.perfilId,
      larId: k.larId,
      pagadorId: k.larId ? (dono?.id ?? null) : null,
      participantes: null,
    });
  }

  return itens.sort((a, b) => a.dia - b.dia || a.nome.localeCompare(b.nome));
}

/**
 * Mês que o app mostra ao abrir: o de hoje ou, quando as faturas dos seus
 * cartões neste mês já estão todas pagas (ou já passou o último vencimento
 * delas), o mês seguinte: é nele que estão as próximas contas.
 */
export function mesDeReferencia(dados: Dados, perfilId: Id, hoje: string): Mes {
  const mes = hoje.slice(0, 7);
  const meus = new Set(dados.cartoes.filter((k) => k.perfilId === perfilId).map((k) => k.id));
  const faturas = itensDoMes(dados, mes).filter(
    (i) => i.refTipo === "fatura" && i.valor > 0 && meus.has(i.refId),
  );
  if (!faturas.length) return mes;
  const todasPagas = faturas.every((f) => f.pago);
  const venceram = Number(hoje.slice(8, 10)) > Math.max(...faturas.map((f) => f.dia));
  return todasPagas || venceram ? addMes(mes, 1) : mes;
}

/** A pessoa é quem tira o dinheiro do bolso para pagar este item? */
export function souPagador(item: ItemMes, perfilId: Id, meuMoradorId: Id | null): boolean {
  return item.escopo === "pessoal"
    ? item.perfilId === perfilId
    : item.pagadorId !== null && item.pagadorId === meuMoradorId;
}

/* ───────────────────────── Divisão da casa ───────────────────────── */

/**
 * Divide um valor em centavos pelos pesos, sem perder nem criar centavo:
 * cada um recebe a parte inteira e os centavos que sobram vão para quem
 * tinha a maior fração.
 */
export function dividir(valor: number, pesos: [Id, number][]): Record<Id, number> {
  const validos = pesos.filter(([, p]) => p > 0);
  const total = soma(validos.map(([, p]) => p));
  if (!validos.length || total <= 0) return {};
  const linhas = validos.map(([id, p], ordem) => {
    const exato = (valor * p) / total;
    const base = Math.floor(exato);
    return { id, base, fracao: exato - base, ordem };
  });
  let resto = valor - soma(linhas.map((l) => l.base));
  const fila = [...linhas].sort((a, b) => b.fracao - a.fracao || a.ordem - b.ordem);
  for (const l of fila) {
    if (resto <= 0) break;
    l.base += 1;
    resto -= 1;
  }
  return Object.fromEntries(linhas.map((l) => [l.id, l.base]));
}

/** Pesos que valem para um item: os da própria conta ou, na falta, o padrão de cada morador. */
export function pesosDoItem(
  item: Pick<ItemMes, "participantes">,
  moradores: Morador[],
): [Id, number][] {
  const existentes = new Set(moradores.map((m) => m.id));
  if (item.participantes) {
    const proprios = moradores
      .map((m): [Id, number] => [m.id, item.participantes?.[m.id] ?? 0])
      .filter(([id, p]) => existentes.has(id) && p > 0);
    if (proprios.length) return proprios;
  }
  const padrao = moradores.filter((m) => m.peso > 0).map((m): [Id, number] => [m.id, m.peso]);
  if (padrao.length) return padrao;
  return moradores.map((m): [Id, number] => [m.id, 1]);
}

export interface Transferencia {
  deId: Id;
  paraId: Id;
  valor: number;
}

/** Menor lista de Pix que zera os saldos: junta o maior devedor com o maior credor até acabar. */
export function sugerirTransferencias(saldos: [Id, number][]): Transferencia[] {
  const devedores = saldos
    .filter(([, s]) => s < 0)
    .map(([id, s]) => ({ id, v: -s }))
    .sort((a, b) => b.v - a.v);
  const credores = saldos
    .filter(([, s]) => s > 0)
    .map(([id, s]) => ({ id, v: s }))
    .sort((a, b) => b.v - a.v);
  const lista: Transferencia[] = [];
  let i = 0;
  let j = 0;
  while (i < devedores.length && j < credores.length) {
    const valor = Math.min(devedores[i].v, credores[j].v);
    if (valor > 0) {
      lista.push({ deId: devedores[i].id, paraId: credores[j].id, valor });
    }
    devedores[i].v -= valor;
    credores[j].v -= valor;
    if (devedores[i].v === 0) i++;
    if (credores[j].v === 0) j++;
  }
  return lista;
}

export interface LinhaCasa {
  item: ItemMes;
  partes: Record<Id, number>;
}

export interface SaldoMorador {
  /** Soma das contas que a pessoa paga do próprio bolso. */
  pagou: number;
  /** Parte justa dela em todas as contas da casa. */
  parte: number;
  /** Parte dela só nas contas que têm pagador definido (base do acerto). */
  parteAcerto: number;
  enviado: number;
  recebido: number;
  /** Positivo = tem a receber. Negativo = deve. */
  saldo: number;
}

export interface ResumoCasa {
  total: number;
  linhas: LinhaCasa[];
  porMorador: Record<Id, SaldoMorador>;
  pendentes: Transferencia[];
  feitos: Acerto[];
  semPagador: number;
}

export function resumoCasa(dados: Dados, mes: Mes): ResumoCasa | null {
  if (!dados.lares.length) return null;
  const moradores = dados.moradores;
  const porMorador: Record<Id, SaldoMorador> = Object.fromEntries(
    moradores.map((m) => [
      m.id,
      { pagou: 0, parte: 0, parteAcerto: 0, enviado: 0, recebido: 0, saldo: 0 },
    ]),
  );

  const itens = itensDoMes(dados, mes).filter(
    (i) => i.escopo === "casa" && i.natureza === "despesa",
  );
  const linhas: LinhaCasa[] = [];
  let semPagador = 0;

  for (const item of itens) {
    const partes = dividir(item.valor, pesosDoItem(item, moradores));
    linhas.push({ item, partes });
    const temPagador = !!item.pagadorId && !!porMorador[item.pagadorId];
    if (temPagador) porMorador[item.pagadorId as Id].pagou += item.valor;
    else semPagador += item.valor;
    for (const [id, v] of Object.entries(partes)) {
      porMorador[id].parte += v;
      if (temPagador) porMorador[id].parteAcerto += v;
    }
  }

  const feitos = dados.acertos.filter((a) => a.mes === mes);
  for (const a of feitos) {
    if (porMorador[a.deId]) porMorador[a.deId].enviado += a.valor;
    if (porMorador[a.paraId]) porMorador[a.paraId].recebido += a.valor;
  }

  for (const s of Object.values(porMorador)) {
    s.saldo = s.pagou - s.parteAcerto + s.enviado - s.recebido;
  }

  return {
    total: soma(itens.map((i) => i.valor)),
    linhas,
    porMorador,
    pendentes: sugerirTransferencias(
      moradores.map((m): [Id, number] => [m.id, porMorador[m.id].saldo]),
    ),
    feitos,
    semPagador,
  };
}

/* ───────────────────────── Renda ao longo do tempo ───────────────────────── */

/**
 * Salário e dia a dia que valiam em um mês. Usa a última mudança registrada
 * até aquele mês; antes da primeira, vale a primeira (ou os valores atuais).
 */
export function rendaNoMes(
  perfil: Pick<Perfil, "salario" | "orcamentoDiaADia" | "historico"> | undefined,
  mes: Mes,
): { salario: number; diaADia: number } {
  if (!perfil) return { salario: 0, diaADia: 0 };
  const historico = [...(perfil.historico ?? [])].sort((a, b) => a.desde.localeCompare(b.desde));
  if (!historico.length) {
    return { salario: perfil.salario, diaADia: perfil.orcamentoDiaADia };
  }
  const vigente = [...historico].reverse().find((h) => h.desde <= mes) ?? historico[0];
  return { salario: vigente.salario, diaADia: vigente.diaADia };
}

/**
 * Registra uma mudança de renda que vale de `desde` em diante. Mudanças
 * posteriores são descartadas, porque o valor novo passa a valer daqui pra
 * frente. Sem histórico anterior, o valor antigo vira o registro inicial,
 * para os meses passados não mudarem.
 */
export function registrarRenda(
  perfil: Pick<Perfil, "salario" | "orcamentoDiaADia" | "historico">,
  desde: Mes,
  salario: number,
  diaADia: number,
): MudancaRenda[] {
  const atual = [...(perfil.historico ?? [])];
  const base: MudancaRenda[] = atual.length
    ? atual
    : [{ desde: "0000-01", salario: perfil.salario, diaADia: perfil.orcamentoDiaADia }];
  return [...base.filter((h) => h.desde < desde), { desde, salario, diaADia }].sort((a, b) =>
    a.desde.localeCompare(b.desde),
  );
}

/* ───────────────────────── Gastos avulsos ───────────────────────── */

/** Entradas e saídas avulsas (Transações) de um mês. Transferências não contam. */
export function movimentoAvulso(
  transacoes: Transacao[],
  perfilId: Id,
  mes: Mes,
): { entradas: number; saidas: number; porCategoria: Record<string, number> } {
  let entradas = 0;
  let saidas = 0;
  const porCategoria: Record<string, number> = {};
  for (const t of transacoes) {
    if (t.perfilId !== perfilId || t.data.slice(0, 7) !== mes || t.soSaldo) continue;
    if (t.tipo === "entrada") entradas += t.valor;
    if (t.tipo === "saida") {
      saidas += t.valor;
      porCategoria[t.categoria] = (porCategoria[t.categoria] ?? 0) + t.valor;
    }
  }
  return { entradas, saidas, porCategoria };
}

/* ───────────────────────── Resumo pessoal ───────────────────────── */

export interface ResumoPessoal {
  salario: number;
  /** Rendas cadastradas em Contas mais entradas avulsas lançadas em Transações. */
  outrasRendas: number;
  /** Quanto foi reservado para o dia a dia. */
  orcamentoDiaADia: number;
  /** Quanto já saiu em gastos avulsos lançados em Transações. */
  gastoAvulso: number;
  renda: number;
  parteCasa: number;
  pessoais: number;
  diaADia: number;
  saidas: number;
  sobra: number;
  /** Fração da renda que sobra. Null quando não há renda cadastrada. */
  fracaoSobra: number | null;
  itensPessoais: ItemMes[];
  receitas: ItemMes[];
}

export function resumoPessoal(dados: Dados, perfilId: Id, mes: Mes): ResumoPessoal {
  const perfil = dados.perfis.find((p) => p.id === perfilId);
  const eu = dados.moradores.find((m) => m.perfilId === perfilId);
  const itens = itensDoMes(dados, mes);
  const casa = eu ? resumoCasa(dados, mes) : null;

  const itensPessoais = itens.filter(
    (i) => i.escopo === "pessoal" && i.natureza === "despesa" && i.perfilId === perfilId,
  );
  const receitas = itens.filter((i) => i.natureza === "receita" && i.perfilId === perfilId);

  const { salario, diaADia: orcamentoDiaADia } = rendaNoMes(perfil, mes);
  const avulsas = movimentoAvulso(dados.transacoes ?? [], perfilId, mes);
  const outrasRendas = soma(receitas.map((i) => i.valor)) + avulsas.entradas;
  const renda = salario + outrasRendas;
  const parteCasa = eu && casa ? (casa.porMorador[eu.id]?.parte ?? 0) : 0;
  const pessoais = soma(itensPessoais.map((i) => i.valor));
  // O dia a dia conta pelo que foi reservado; se os gastos avulsos passarem
  // da reserva, conta pelo que realmente saiu.
  const diaADia = Math.max(orcamentoDiaADia, avulsas.saidas);
  const saidas = parteCasa + pessoais + diaADia;
  const sobra = renda - saidas;

  return {
    salario,
    outrasRendas,
    orcamentoDiaADia,
    gastoAvulso: avulsas.saidas,
    renda,
    parteCasa,
    pessoais,
    diaADia,
    saidas,
    sobra,
    fracaoSobra: renda > 0 ? sobra / renda : null,
    itensPessoais,
    receitas,
  };
}

export interface PontoFluxo {
  mes: Mes;
  entradas: number;
  saidas: number;
  sobra: number;
  parteCasa: number;
  pessoais: number;
  diaADia: number;
}

export function fluxoDeCaixa(dados: Dados, perfilId: Id, meses: Mes[]): PontoFluxo[] {
  return meses.map((mes) => {
    const r = resumoPessoal(dados, perfilId, mes);
    return {
      mes,
      entradas: r.renda,
      saidas: r.saidas,
      sobra: r.sobra,
      parteCasa: r.parteCasa,
      pessoais: r.pessoais,
      diaADia: r.diaADia,
    };
  });
}

/* ───────────────────────── Gastos por categoria ───────────────────────── */

export interface GastoCategoria {
  categoria: string;
  valor: number;
}

/**
 * Para onde foram as saídas da pessoa no mês, por categoria: a parte dela em
 * cada conta da casa, as contas pessoais e o dia a dia. Faturas de cartão são
 * abertas compra por compra, usando a categoria de cada compra.
 */
export function gastosPorCategoria(dados: Dados, perfilId: Id, mes: Mes): GastoCategoria[] {
  const totais = new Map<string, number>();
  const somar = (categoria: string, valor: number) => {
    if (valor > 0) totais.set(categoria, (totais.get(categoria) ?? 0) + valor);
  };
  /** Soma um item; se for fatura, distribui o valor pelas categorias das compras. */
  const distribuir = (item: ItemMes, valor: number) => {
    if (item.refTipo !== "fatura") return somar(item.categoria, valor);
    // Só as compras: o estorno já está descontado do valor da fatura.
    const linhas = comprasDaFatura(item.refId, dados.compras, mes).filter((l) => l.valor > 0);
    const total = soma(linhas.map((l) => l.valor));
    if (total <= 0) return somar("outros", valor);
    let restante = valor;
    linhas.forEach((l, i) => {
      const parte = i === linhas.length - 1 ? restante : Math.round((valor * l.valor) / total);
      restante -= parte;
      somar(l.compra.categoria ?? "outros", parte);
    });
  };

  const eu = dados.moradores.find((m) => m.perfilId === perfilId);
  if (eu) {
    for (const linha of resumoCasa(dados, mes)?.linhas ?? []) {
      distribuir(linha.item, linha.partes[eu.id] ?? 0);
    }
  }
  for (const item of itensDoMes(dados, mes)) {
    if (item.escopo === "pessoal" && item.natureza === "despesa" && item.perfilId === perfilId) {
      distribuir(item, item.valor);
    }
  }
  // Gastos avulsos entram pela categoria de cada um. O que ainda sobra da
  // reserva do dia a dia aparece como "dia-a-dia", para a soma bater com as saídas.
  const avulsas = movimentoAvulso(dados.transacoes ?? [], perfilId, mes);
  for (const [cat, valor] of Object.entries(avulsas.porCategoria)) somar(cat, valor);
  const reserva = rendaNoMes(
    dados.perfis.find((p) => p.id === perfilId),
    mes,
  ).diaADia;
  somar("dia-a-dia", Math.max(0, reserva - avulsas.saidas));

  return [...totais]
    .map(([categoria, valor]) => ({ categoria, valor }))
    .sort((a, b) => b.valor - a.valor);
}

/* ───────────────────────── Moradia ───────────────────────── */

export interface ResumoMoradia {
  total: number;
  /** Salário usado na comparação. */
  base: number;
  fracao: number | null;
  itens: { nome: string; valor: number; categoria: string; estimada: boolean }[];
  /** Quantos moradores mostram o salário para a casa. */
  compartilham: number;
}

export function resumoMoradia(
  dados: Dados,
  perfilId: Id,
  mes: Mes,
  base: "meu" | "casa",
): ResumoMoradia {
  const perfil = dados.perfis.find((p) => p.id === perfilId);
  const eu = dados.moradores.find((m) => m.perfilId === perfilId);
  const casa = resumoCasa(dados, mes);
  const compartilham = dados.moradores.filter((m) => m.salarioCompartilhado !== null).length;
  const itens: ResumoMoradia["itens"] = [];

  for (const linha of casa?.linhas ?? []) {
    if (!linha.item.moradia) continue;
    const valor = base === "casa" ? linha.item.valor : eu ? (linha.partes[eu.id] ?? 0) : 0;
    if (valor <= 0) continue;
    itens.push({
      nome: linha.item.nome,
      valor,
      categoria: linha.item.categoria,
      estimada: linha.item.estimada,
    });
  }

  if (base === "meu") {
    for (const i of itensDoMes(dados, mes)) {
      const minha =
        i.escopo === "pessoal" && i.natureza === "despesa" && i.moradia && i.perfilId === perfilId;
      if (!minha) continue;
      itens.push({
        nome: i.nome,
        valor: i.valor,
        categoria: i.categoria,
        estimada: i.estimada,
      });
    }
  }

  const total = soma(itens.map((i) => i.valor));
  const salario =
    base === "meu"
      ? rendaNoMes(perfil, mes).salario
      : soma(dados.moradores.map((m) => m.salarioCompartilhado ?? 0));

  return {
    total,
    base: salario,
    fracao: salario > 0 ? total / salario : null,
    itens: itens.sort((a, b) => b.valor - a.valor),
    compartilham,
  };
}

/* ───────────────────────── Limite do cartão ───────────────────────── */

/** Quanto do limite está tomado a partir do mês: parcelas futuras de faturas ainda não pagas. */
export function limiteUsado(cartao: Cartao, dados: Dados, mes: Mes): number {
  const lancs = indexarLancamentos(dados.lancamentos);
  const paga = (m: Mes) => !!lancs.get(chaveLancamento("fatura", cartao.id, m))?.pago;
  let usado = 0;
  for (const c of dados.compras) {
    if (c.cartaoId !== cartao.id) continue;
    if (c.recorrente) {
      if (!paga(mes)) usado += valorParcela(c, mes);
      continue;
    }
    for (let i = 0; i < Math.max(1, c.parcelas); i++) {
      const m = addMes(c.mesPrimeira, i);
      if (m >= mes && !paga(m)) usado += valorParcela(c, m);
    }
  }
  return usado;
}

export interface LimiteCartao {
  total: number;
  /** Parcelas e faturas em aberto, com a correção informada do banco. */
  usado: number;
  livre: number;
  /** Fração do limite em uso (0 a 1+). Null sem limite cadastrado. */
  fracao: number | null;
}

/**
 * Limite do cartão hoje. Começa no que o app calcula (parcelas e faturas não
 * pagas) e soma a correção que deixa o "disponível" igual ao do banco. Daí em
 * diante, cada compra lançada reduz e cada fatura paga devolve o limite.
 */
export function limiteDoCartao(cartao: Cartao, dados: Dados, mesHoje: Mes): LimiteCartao {
  const usado = Math.max(0, limiteUsado(cartao, dados, mesHoje) - (cartao.limiteAjuste ?? 0));
  return {
    total: cartao.limite,
    usado,
    livre: cartao.limite - usado,
    fracao: cartao.limite > 0 ? usado / cartao.limite : null,
  };
}

/** Correção para o limite livre do app passar a ser `disponivel` (o que o banco mostra). */
export function ajusteParaDisponivel(
  cartao: Pick<Cartao, "id" | "limite">,
  dados: Dados,
  mesHoje: Mes,
  disponivel: number,
): number {
  const calculado = limiteUsado(cartao as Cartao, dados, mesHoje);
  // livre = limite − (calculado − ajuste)  ⇒  ajuste = disponivel − limite + calculado
  return disponivel - cartao.limite + calculado;
}

/* ───────────────────────── Avisos de vencimento ───────────────────────── */

export interface Alerta {
  item: ItemMes;
  mes: Mes;
  /** Dias até vencer. Negativo = atrasada. */
  dias: number;
}

/** Contas que a pessoa paga, ainda abertas, vencidas ou vencendo em até `janela` dias. */
export function alertas(dados: Dados, perfilId: Id, hoje: string, janela = 5): Alerta[] {
  const mes = hoje.slice(0, 7);
  const dia = Number(hoje.slice(8, 10));
  const eu = dados.moradores.find((m) => m.perfilId === perfilId);
  const abertas = (m: Mes) =>
    itensDoMes(dados, m).filter(
      (i) => i.natureza === "despesa" && !i.pago && souPagador(i, perfilId, eu?.id ?? null),
    );

  const lista: Alerta[] = [];
  const anterior = addMes(mes, -1);
  for (const item of abertas(anterior)) {
    lista.push({ item, mes: anterior, dias: item.dia - diasNoMes(anterior) - dia });
  }
  for (const item of abertas(mes)) {
    const dias = item.dia - dia;
    if (dias <= janela) lista.push({ item, mes, dias });
  }
  return lista.sort((a, b) => a.dias - b.dias);
}

/* ───────────────────────── Reserva ───────────────────────── */

export function saldoDaMeta(meta: Meta, dados: Pick<Dados, "aportes">): number {
  return soma(dados.aportes.filter((a) => a.metaId === meta.id).map((a) => a.valor));
}
