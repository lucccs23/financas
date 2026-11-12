// Análises: o que você gastou, quando e onde.
//
// Aqui cada gasto conta no mês em que aconteceu (a data da compra), e não no
// mês da fatura: é o retrato do consumo. Compra à vista no cartão conta na
// data dela; parcela de compra antiga conta no mês anterior ao da fatura em que
// cai (o mês em que aquele pedaço foi "consumido"). Gastos fora do cartão
// contam pela data. Pagamento de fatura, dinheiro entre contas suas e o que
// você tirou do resumo ficam fora (já contam por outro lado).

import { comprasDaFatura } from "./calc";
import { addMes } from "./meses";
import type { Dados, Id, Mes } from "./types";

export interface Gasto {
  /** AAAA-MM-DD; parcela antiga: o dia 1 do mês em que conta. */
  data: string;
  mes: Mes;
  valor: number;
  categoria: string;
  /** Nome do lugar, sem número de parcela. */
  onde: string;
  origem: "cartao" | "conta";
  /** Parcela de compra feita antes (a data não é a do dia do gasto). */
  parcela: boolean;
}

const SUFIXO_PARCELA =
  /\s*(·\s*)?(parc(ela)?\.?\s*)\d{1,2}\s*\/\s*\d{1,2}\s*$/i;
const PARCELA_N = /parcela\s*(\d+)\s*\/\s*\d+\s*$/i;

/** "Recargapay *Lucasmart · parcela 2/3" → "Recargapay Lucasmart". */
export function nomeDoLugar(descricao: string): string {
  const limpo = descricao
    .replace(SUFIXO_PARCELA, "")
    .replace(/[*|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // "MERCADO X" e "Mercado X" são o mesmo lugar.
  return limpo
    .toLowerCase()
    .replace(/(^|\s)\S/g, (l) => l.toUpperCase())
    .slice(0, 48);
}

/** Todos os gastos da pessoa que contam nos meses pedidos. */
export function gastosDoPeriodo(
  dados: Dados,
  perfilId: Id,
  meses: Mes[],
): Gasto[] {
  const quer = new Set(meses);
  const lista: Gasto[] = [];

  for (const t of dados.transacoes ?? []) {
    if (t.perfilId !== perfilId || t.tipo !== "saida" || t.soSaldo) continue;
    const mes = t.data.slice(0, 7);
    if (!quer.has(mes)) continue;
    lista.push({
      data: t.data,
      mes,
      valor: t.valor,
      categoria: t.categoria,
      onde: nomeDoLugar(t.descricao),
      origem: "conta",
      parcela: false,
    });
  }

  // Cartões: percorre as faturas que podem ter gasto dos meses pedidos (o mês
  // seguinte ao último também, porque compra do fim do mês cai na fatura dele).
  const ordenados = [...meses].sort();
  if (!ordenados.length) return lista;
  const faturas: Mes[] = [];
  for (
    let m = ordenados[0];
    m <= addMes(ordenados.at(-1)!, 2);
    m = addMes(m, 1)
  )
    faturas.push(m);

  for (const cartao of dados.cartoes.filter((c) => c.perfilId === perfilId)) {
    const vistas = new Set<string>();
    for (const fatura of faturas) {
      for (const l of comprasDaFatura(cartao.id, dados.compras, fatura)) {
        // Compra à vista: conta uma vez, na data dela (a fatura não importa).
        // Parcela: a 1ª conta na data da compra; as outras, no mês antes da fatura.
        // Assinatura cobra todo mês: cada cobrança conta no mês antes da fatura.
        const numero =
          l.parcela ?? Number(PARCELA_N.exec(l.compra.descricao)?.[1] ?? 1);
        const antiga = numero > 1 || l.compra.recorrente;
        const chave = antiga ? `${l.compra.id}|${fatura}` : l.compra.id;
        if (vistas.has(chave)) continue;
        vistas.add(chave);
        const mes = antiga ? addMes(fatura, -1) : l.compra.data.slice(0, 7);
        if (!quer.has(mes)) continue;
        lista.push({
          data: antiga ? `${mes}-01` : l.compra.data,
          mes,
          valor: l.valor,
          categoria: l.compra.categoria ?? "outros",
          onde: nomeDoLugar(l.compra.descricao),
          origem: "cartao",
          parcela: antiga,
        });
      }
    }
  }
  return lista;
}

const soma = (v: number[]) => v.reduce((s, x) => s + x, 0);

export interface MesDeGasto {
  mes: Mes;
  total: number;
  cartao: number;
  conta: number;
}

/** Total gasto em cada mês (estornos já abatidos). */
export function gastoPorMes(gastos: Gasto[], meses: Mes[]): MesDeGasto[] {
  return meses.map((mes) => {
    const doMes = gastos.filter((g) => g.mes === mes);
    const cartao = soma(
      doMes.filter((g) => g.origem === "cartao").map((g) => g.valor),
    );
    const conta = soma(
      doMes.filter((g) => g.origem === "conta").map((g) => g.valor),
    );
    return { mes, total: cartao + conta, cartao, conta };
  });
}

export interface TendenciaCategoria {
  categoria: string;
  /** Um valor por mês, na ordem dos meses pedidos. */
  valores: number[];
  atual: number;
  /** Média dos meses anteriores ao atual (só os que tiveram algum gasto no app). */
  media: number;
  /** atual / média − 1; null sem base para comparar. */
  variacao: number | null;
}

/**
 * Cada categoria mês a mês, das que mais pesam no mês atual (o último da
 * lista). A média ignora meses sem nenhum gasto no app (antes de começar a usar).
 */
export function tendenciaPorCategoria(
  gastos: Gasto[],
  meses: Mes[],
): TendenciaCategoria[] {
  const anteriores = meses.slice(0, -1);
  const comDados = anteriores.filter((m) => gastos.some((g) => g.mes === m));
  const cats = new Set(gastos.map((g) => g.categoria));
  return [...cats]
    .map((categoria) => {
      const valores = meses.map((m) =>
        soma(
          gastos
            .filter((g) => g.mes === m && g.categoria === categoria)
            .map((g) => g.valor),
        ),
      );
      const atual = valores.at(-1)!;
      const base = comDados.map((m) => valores[meses.indexOf(m)]);
      const media = base.length ? Math.round(soma(base) / base.length) : 0;
      return {
        categoria,
        valores,
        atual,
        media,
        variacao: media > 0 ? atual / media - 1 : null,
      };
    })
    .filter((t) => t.atual > 0 || t.media > 0)
    .sort((a, b) => b.atual - a.atual || b.media - a.media);
}

export interface Lugar {
  onde: string;
  total: number;
  vezes: number;
  ticketMedio: number;
  categoria: string;
}

/** Onde você mais gastou no mês (por total). */
export function ondeMaisGasta(gastos: Gasto[], mes: Mes, quantos = 8): Lugar[] {
  const porLugar = new Map<string, Gasto[]>();
  for (const g of gastos) {
    if (g.mes !== mes || g.valor <= 0) continue;
    const chave = g.onde.toLowerCase();
    porLugar.set(chave, [...(porLugar.get(chave) ?? []), g]);
  }
  return [...porLugar.values()]
    .map((lista) => {
      const total = soma(lista.map((g) => g.valor));
      // A categoria que mais aparece naquele lugar.
      const contagem = new Map<string, number>();
      for (const g of lista)
        contagem.set(g.categoria, (contagem.get(g.categoria) ?? 0) + 1);
      const categoria = [...contagem].sort((a, b) => b[1] - a[1])[0][0];
      return {
        onde: lista[0].onde,
        total,
        vezes: lista.length,
        ticketMedio: Math.round(total / lista.length),
        categoria,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, quantos);
}

export const DIAS_DA_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export interface DiaDaSemana {
  dia: number;
  total: number;
  /** Média por ocorrência daquele dia da semana no período. */
  media: number;
  vezes: number;
}

/**
 * Quanto sai em cada dia da semana, em média. Só gastos com data de verdade
 * (parcelas de compras antigas ficam fora). `dias`: as datas do período, para
 * dividir pelo número de segundas, terças... que existiram nele.
 */
export function gastoPorDiaDaSemana(
  gastos: Gasto[],
  dias: string[],
): DiaDaSemana[] {
  const diaDe = (d: string) => new Date(`${d}T12:00:00`).getDay();
  const ocorrencias = Array.from({ length: 7 }, () => 0);
  for (const d of dias) ocorrencias[diaDe(d)]++;
  const periodo = new Set(dias);
  return Array.from({ length: 7 }, (_, dia) => {
    const doDia = gastos.filter(
      (g) =>
        !g.parcela &&
        g.valor > 0 &&
        periodo.has(g.data) &&
        diaDe(g.data) === dia,
    );
    const total = soma(doDia.map((g) => g.valor));
    return {
      dia,
      total,
      vezes: doDia.length,
      media: ocorrencias[dia] ? Math.round(total / ocorrencias[dia]) : 0,
    };
  });
}

export interface NumerosDoMes {
  total: number;
  /** Média dos meses anteriores com gasto no app. */
  mediaAnterior: number;
  variacao: number | null;
  porDia: number;
  maior: Gasto | null;
  quantos: number;
  ticketMedio: number;
}

/** Os números de destaque do mês (o último de `meses`). */
export function numerosDoMes(
  gastos: Gasto[],
  meses: Mes[],
  diasContados: number,
): NumerosDoMes {
  const mes = meses.at(-1)!;
  const porMes = gastoPorMes(gastos, meses);
  const total = porMes.at(-1)!.total;
  const anteriores = porMes
    .slice(0, -1)
    .filter((m) => gastos.some((g) => g.mes === m.mes));
  const mediaAnterior = anteriores.length
    ? Math.round(soma(anteriores.map((m) => m.total)) / anteriores.length)
    : 0;
  const doMes = gastos.filter((g) => g.mes === mes && g.valor > 0);
  const maior =
    doMes.filter((g) => !g.parcela).sort((a, b) => b.valor - a.valor)[0] ??
    null;
  return {
    total,
    mediaAnterior,
    variacao: mediaAnterior > 0 ? total / mediaAnterior - 1 : null,
    porDia: diasContados > 0 ? Math.round(total / diasContados) : 0,
    maior,
    quantos: doMes.length,
    ticketMedio: doMes.length
      ? Math.round(soma(doMes.map((g) => g.valor)) / doMes.length)
      : 0,
  };
}
