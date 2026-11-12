// Cálculos das telas de acompanhamento do dia a dia: ritmo de gasto,
// carteiras, patrimônio, resultado do mês, dicas e recorrentes.
// Funções puras, testadas em calc-extra.test.ts.

import {
  comprasDaFatura,
  faturaDoMes,
  gastosPorCategoria,
  itensDoMes,
  limiteUsado,
  movimentoAvulso,
  resumoCasa,
  resumoPessoal,
  saldoDaMeta,
  valorParcela,
} from "./calc";
import { addMes, diasNoMes, diffMes } from "./meses";
import type { Carteira, Cartao, Compra, Dados, Id, Mes, Transacao } from "./types";

const soma = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

/* ───────────────────────── Quanto ainda pode gastar ───────────────────────── */

export interface Ritmo {
  orcamento: number;
  gasto: number;
  /** Orçamento menos o gasto. Negativo = passou do orçamento. */
  restante: number;
  /** Gasto acumulado até cada dia do mês (índice 0 = dia 1). Só até hoje no mês atual. */
  acumulado: number[];
  diasNoMes: number;
  /** Dia de hoje dentro do mês (ou o último dia, em meses passados; 0 em meses futuros). */
  diaAtual: number;
  /** Quanto já deveria ter saído até hoje, gastando por igual. */
  ideal: number;
  /** Se continuar no mesmo ritmo, quanto sai até o fim do mês. */
  projecao: number;
  /** Quanto dá para gastar por dia daqui até o fim do mês. */
  porDia: number;
}

export function ritmoDeGasto(dados: Dados, perfilId: Id, mes: Mes, hoje: string): Ritmo {
  const r = resumoPessoal(dados, perfilId, mes);
  const dias = diasNoMes(mes);
  const mesHoje = hoje.slice(0, 7);
  const diaAtual = mes < mesHoje ? dias : mes > mesHoje ? 0 : Number(hoje.slice(8, 10));

  const porDia = Array.from({ length: dias }, () => 0);
  for (const t of dados.transacoes ?? []) {
    if (t.perfilId !== perfilId || t.tipo !== "saida" || t.data.slice(0, 7) !== mes) continue;
    const d = Math.min(dias, Math.max(1, Number(t.data.slice(8, 10))));
    porDia[d - 1] += t.valor;
  }
  const acumulado: number[] = [];
  let total = 0;
  for (let i = 0; i < Math.max(diaAtual, 0); i++) {
    total += porDia[i];
    acumulado.push(total);
  }

  const orcamento = r.orcamentoDiaADia;
  const gasto = r.gastoAvulso;
  const restante = orcamento - gasto;
  const diasRestantes = Math.max(1, dias - diaAtual + (diaAtual > 0 ? 1 : 0));
  return {
    orcamento,
    gasto,
    restante,
    acumulado,
    diasNoMes: dias,
    diaAtual,
    ideal: Math.round((orcamento * diaAtual) / dias),
    projecao: diaAtual > 0 ? Math.round((gasto / diaAtual) * dias) : gasto,
    porDia: restante > 0 ? Math.floor(restante / diasRestantes) : 0,
  };
}

/* ───────────────────────── Carteiras e patrimônio ───────────────────────── */

/** Saldo de uma carteira: saldo inicial + entradas − saídas, com transferências. */
export function saldoCarteira(carteira: Carteira, transacoes: Transacao[], ate?: string): number {
  let saldo = carteira.saldoInicial;
  for (const t of transacoes) {
    if (ate && t.data > ate) continue;
    if (t.carteiraId === carteira.id) {
      if (t.tipo === "entrada") saldo += t.valor;
      else saldo -= t.valor; // saída ou transferência que sai daqui
    }
    if (t.tipo === "transferencia" && t.carteiraDestinoId === carteira.id) saldo += t.valor;
  }
  return saldo;
}

export interface Patrimonio {
  carteiras: number;
  reserva: number;
  /** Parcelas e faturas dos cartões ainda por pagar, a partir do mês atual. */
  dividaCartoes: number;
  total: number;
}

export function patrimonio(dados: Dados, perfilId: Id, mesHoje: Mes): Patrimonio {
  const carteiras = soma(
    dados.carteiras
      .filter((c) => c.perfilId === perfilId && !c.arquivada)
      .map((c) => saldoCarteira(c, dados.transacoes)),
  );
  const reserva = soma(
    dados.metas.filter((m) => m.perfilId === perfilId).map((m) => saldoDaMeta(m, dados)),
  );
  const dividaCartoes = soma(
    dados.cartoes.filter((c) => c.perfilId === perfilId).map((c) => limiteUsado(c, dados, mesHoje)),
  );
  return { carteiras, reserva, dividaCartoes, total: carteiras + reserva - dividaCartoes };
}

/* ───────────────────────── Resultado do mês ───────────────────────── */

export interface Resultado {
  receita: number;
  gasto: number;
  resultado: number;
  anterior: number;
  /** Variação em relação ao mês anterior (0,18 = +18%). Null quando não dá para comparar. */
  variacao: number | null;
}

export function resultadoDoMes(dados: Dados, perfilId: Id, mes: Mes): Resultado {
  const atual = resumoPessoal(dados, perfilId, mes);
  const antes = resumoPessoal(dados, perfilId, addMes(mes, -1));
  return {
    receita: atual.renda,
    gasto: atual.saidas,
    resultado: atual.sobra,
    anterior: antes.sobra,
    variacao: antes.sobra !== 0 ? (atual.sobra - antes.sobra) / Math.abs(antes.sobra) : null,
  };
}

/* ───────────────────────── Dicas ───────────────────────── */

export interface Dica {
  id: string;
  tom: "bom" | "alerta" | "neutro";
  /** Texto com trechos em destaque marcados como **assim**. */
  texto: string;
}

/**
 * Observações curtas sobre o mês, da mais importante para a menos.
 * `formatar` vem de fora para este arquivo não depender da formatação de tela.
 */
export function dicasDoMes(
  dados: Dados,
  perfilId: Id,
  mes: Mes,
  hoje: string,
  formatar: (centavos: number) => string,
  nomeCategoria: (id: string) => string,
): Dica[] {
  const lista: Dica[] = [];
  const ritmo = ritmoDeGasto(dados, perfilId, mes, hoje);
  const r = resumoPessoal(dados, perfilId, mes);

  if (ritmo.orcamento > 0 && ritmo.diaAtual > 0) {
    if (ritmo.restante < 0) {
      lista.push({
        id: "estourou",
        tom: "alerta",
        texto: `Os gastos do dia a dia passaram **${formatar(-ritmo.restante)}** da reserva do mês.`,
      });
    } else if (ritmo.gasto > ritmo.ideal * 1.15 && ritmo.diaAtual < ritmo.diasNoMes) {
      lista.push({
        id: "ritmo",
        tom: "alerta",
        texto: `No ritmo atual, o dia a dia fecha o mês em **${formatar(ritmo.projecao)}**, acima dos ${formatar(ritmo.orcamento)} reservados. Dá para gastar **${formatar(ritmo.porDia)} por dia** até o fim do mês.`,
      });
    } else if (ritmo.diaAtual < ritmo.diasNoMes) {
      lista.push({
        id: "no-ritmo",
        tom: "bom",
        texto: `Gastos do dia a dia dentro do planejado. Dá para gastar até **${formatar(ritmo.porDia)} por dia** até o fim do mês.`,
      });
    }
  }

  // Categoria que mais cresceu em relação ao mês anterior.
  const agora = gastosPorCategoria(dados, perfilId, mes).filter((g) => g.categoria !== "dia-a-dia");
  const antes = new Map(
    gastosPorCategoria(dados, perfilId, addMes(mes, -1)).map((g) => [g.categoria, g.valor]),
  );
  const subidas = agora
    .map((g) => ({ ...g, diferenca: g.valor - (antes.get(g.categoria) ?? 0), antes: antes.get(g.categoria) ?? 0 }))
    .filter((g) => g.antes > 0 && g.diferenca >= 5_000)
    .sort((a, b) => b.diferenca - a.diferenca);
  if (subidas[0]) {
    lista.push({
      id: "categoria",
      tom: "alerta",
      texto: `Você gastou **${formatar(subidas[0].diferenca)} a mais** com ${nomeCategoria(subidas[0].categoria).toLowerCase()} este mês, comparado ao anterior.`,
    });
  }

  if (r.sobra < 0) {
    lista.push({
      id: "falta",
      tom: "alerta",
      texto: `As saídas previstas passam da renda em **${formatar(-r.sobra)}**. Vale rever as contas do mês.`,
    });
  } else if (r.fracaoSobra !== null && r.fracaoSobra >= 0.2) {
    lista.push({
      id: "sobra",
      tom: "bom",
      texto: `Sobram **${Math.round(r.fracaoSobra * 100)}% da renda** este mês. Que tal guardar uma parte na reserva?`,
    });
  }

  // Fatura bem acima da média dos três meses anteriores.
  const meus = dados.cartoes.filter((c) => c.perfilId === perfilId);
  const fatura = (m: Mes) => soma(meus.map((c) => faturaDoMes(c.id, dados.compras, m)));
  const media = soma([1, 2, 3].map((n) => fatura(addMes(mes, -n)))) / 3;
  const atual = fatura(mes);
  if (media > 0 && atual > media * 1.25 && atual - media >= 10_000) {
    lista.push({
      id: "fatura",
      tom: "alerta",
      texto: `A fatura deste mês está **${formatar(atual - Math.round(media))} acima** da média dos últimos três meses.`,
    });
  }

  // Meta perto do fim.
  for (const meta of dados.metas) {
    if (meta.alvo <= 0) continue;
    const guardado = saldoDaMeta(meta, dados);
    const falta = meta.alvo - guardado;
    if (falta > 0 && guardado / meta.alvo >= 0.8) {
      lista.push({
        id: `meta-${meta.id}`,
        tom: "bom",
        texto: `Faltam só **${formatar(falta)}** para completar a meta "${meta.nome}".`,
      });
      break;
    }
  }

  // Acerto da casa pendente com a pessoa.
  const eu = dados.moradores.find((m) => m.perfilId === perfilId);
  const casa = eu ? resumoCasa(dados, mes) : null;
  const devo = casa?.pendentes.filter((t) => t.deId === eu?.id) ?? [];
  if (devo.length) {
    lista.push({
      id: "acerto",
      tom: "neutro",
      texto: `Você tem **${formatar(soma(devo.map((t) => t.valor)))}** para acertar com a casa este mês.`,
    });
  }

  return lista;
}

/* ───────────────────────── Recorrentes ───────────────────────── */

export interface PontoRecorrente {
  mes: Mes;
  /** Contas fixas pessoais + a sua parte nas contas da casa (sem faturas). */
  contasFixas: number;
  /** Parcelas e assinaturas dos seus cartões. */
  parcelas: number;
}

export function recorrentesPorMes(dados: Dados, perfilId: Id, meses: Mes[]): PontoRecorrente[] {
  const eu = dados.moradores.find((m) => m.perfilId === perfilId);
  const meus = dados.cartoes.filter((c) => c.perfilId === perfilId);
  return meses.map((mes) => {
    const pessoais = itensDoMes(dados, mes).filter(
      (i) =>
        i.refTipo === "conta" &&
        i.natureza === "despesa" &&
        i.escopo === "pessoal" &&
        i.perfilId === perfilId,
    );
    const casa = eu ? resumoCasa(dados, mes) : null;
    const parteCasa = soma(
      (casa?.linhas ?? [])
        .filter((l) => l.item.refTipo === "conta")
        .map((l) => (eu ? (l.partes[eu.id] ?? 0) : 0)),
    );
    const parcelas = soma(
      meus.flatMap((k) =>
        dados.compras
          .filter((c) => c.cartaoId === k.id && (c.recorrente || c.parcelas > 1))
          .map((c) => valorParcela(c, mes)),
      ),
    );
    return { mes, contasFixas: soma(pessoais.map((i) => i.valor)) + parteCasa, parcelas };
  });
}

/* ───────────────────────── Composição da fatura ───────────────────────── */

export interface ComposicaoFatura {
  parcelas: number;
  assinaturas: number;
  avulsas: number;
  total: number;
  /** Compras feitas neste ciclo (primeira cobrança neste mês). */
  novas: number;
  /** Parcelas de compras feitas em meses anteriores. */
  herdadas: number;
}

export function composicaoFatura(cartao: Pick<Cartao, "id">, compras: Compra[], mes: Mes): ComposicaoFatura {
  const linhas = comprasDaFatura(cartao.id, compras, mes);
  const de = (f: (c: Compra) => boolean) => soma(linhas.filter((l) => f(l.compra)).map((l) => l.valor));
  return {
    parcelas: de((c) => !c.recorrente && c.parcelas > 1),
    assinaturas: de((c) => c.recorrente),
    avulsas: de((c) => !c.recorrente && c.parcelas <= 1),
    total: soma(linhas.map((l) => l.valor)),
    novas: de((c) => !c.recorrente && c.mesPrimeira === mes),
    herdadas: de((c) => !c.recorrente && diffMes(mes, c.mesPrimeira) > 0),
  };
}

/** Transações agrupadas por dia, do mais recente para o mais antigo. */
export function agruparPorDia(transacoes: Transacao[]): { data: string; itens: Transacao[] }[] {
  const grupos = new Map<string, Transacao[]>();
  for (const t of [...transacoes].sort((a, b) => b.data.localeCompare(a.data))) {
    const lista = grupos.get(t.data) ?? [];
    lista.push(t);
    grupos.set(t.data, lista);
  }
  return [...grupos].map(([data, itens]) => ({ data, itens }));
}

export { movimentoAvulso };
