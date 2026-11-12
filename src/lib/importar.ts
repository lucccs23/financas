// Leitura de faturas de cartão exportadas pelo banco em CSV.
// Cada banco usa um formato: aqui o arquivo é lido de forma tolerante e a
// pessoa confere a prévia antes de importar.

import { sugerirCategoria } from "./categorias";

export interface LinhaImportada {
  data: string;
  descricao: string;
  /** Centavos, sempre positivo para compras. Negativo = pagamento ou estorno. */
  valor: number;
  /** Parcela informada pelo banco ("2/10"), quando houver. */
  parcela: { numero: number; total: number } | null;
  categoria: string;
}

export interface ResultadoLeitura {
  linhas: LinhaImportada[];
  /** Linhas que não deu para entender (data ou valor inválidos). */
  ignoradas: number;
}

/* ───────────────────────── CSV ───────────────────────── */

function detectarSeparador(texto: string): string {
  const primeira = texto.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const [melhor] = [";", ",", "\t"]
    .map((s) => ({ s, n: primeira.split(s).length - 1 }))
    .sort((a, b) => b.n - a.n);
  return melhor.n > 0 ? melhor.s : ",";
}

/** Separa o texto em linhas e colunas, respeitando aspas. */
export function lerCsv(texto: string): string[][] {
  const sep = detectarSeparador(texto);
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  const limpo = texto.replace(/^﻿/, "");
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (aspas) {
      if (c === '"' && limpo[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      linha.push(campo.trim());
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && limpo[i + 1] === "\n") i++;
      linha.push(campo.trim());
      if (linha.some((x) => x)) linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }
  linha.push(campo.trim());
  if (linha.some((x) => x)) linhas.push(linha);
  return linhas;
}

/* ───────────────────────── Datas e valores ───────────────────────── */

/** "14/10/2026", "14/10/26", "2026-10-14" ou "14-10-2026" viram "2026-10-14". */
export function lerData(texto: string): string | null {
  const t = texto.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return montar(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const ano = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return montar(ano, +m[2], +m[1]);
  }
  return null;
}

function montar(ano: number, mes: number, dia: number): string | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || ano < 2000 || ano > 2100) return null;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** "R$ 1.234,56", "1234.56", "-45,90" e "(45,90)" viram centavos. */
export function lerValor(texto: string): number | null {
  let t = texto.trim().replace(/R\$|\s/gi, "");
  if (!t) return null;
  let negativo = false;
  if (/^\(.*\)$/.test(t)) {
    negativo = true;
    t = t.slice(1, -1);
  }
  if (t.startsWith("-")) {
    negativo = !negativo;
    t = t.slice(1);
  } else if (t.endsWith("-")) {
    negativo = !negativo;
    t = t.slice(0, -1);
  }
  if (!/^[\d.,]+$/.test(t)) return null;
  const virgula = t.lastIndexOf(",");
  const ponto = t.lastIndexOf(".");
  let numero: number;
  if (virgula > ponto) {
    numero = Number(t.replace(/\./g, "").replace(",", "."));
  } else if (ponto > virgula) {
    // "1.234" (só pontos, em grupos de três) é milhar; "1,234.56" e "45.90" usam ponto decimal.
    numero =
      virgula === -1 && /^\d{1,3}(\.\d{3})+$/.test(t)
        ? Number(t.replace(/\./g, ""))
        : Number(t.replace(/,/g, ""));
  } else {
    numero = Number(t);
  }
  if (!Number.isFinite(numero)) return null;
  const centavos = Math.round(numero * 100);
  return negativo ? -centavos : centavos;
}

/** "Loja - Parcela 2/10", "LOJA 02/10" e "Loja (2 de 10)" indicam parcela. */
export function lerParcela(descricao: string): { numero: number; total: number } | null {
  const m =
    descricao.match(/parc(?:ela)?\.?\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})/i) ??
    descricao.match(/\(?(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\)?\s*$/i);
  if (!m) return null;
  const numero = +m[1];
  const total = +m[2];
  if (total < 2 || total > 48 || numero < 1 || numero > total) return null;
  return { numero, total };
}

/* ───────────────────────── Colunas ───────────────────────── */

export interface Colunas {
  data: number;
  descricao: number;
  valor: number;
}

/** Adivinha quais colunas são data, descrição e valor. */
export function adivinharColunas(linhas: string[][]): { colunas: Colunas; cabecalho: boolean } {
  const amostra = linhas.slice(0, 30);
  const largura = Math.max(...amostra.map((l) => l.length));
  const nota = Array.from({ length: largura }, (_, c) => {
    const celulas = amostra.map((l) => l[c] ?? "");
    return {
      data: celulas.filter((x) => lerData(x)).length,
      valor: celulas.filter((x) => lerValor(x) !== null && /\d/.test(x) && !lerData(x)).length,
      texto: celulas.reduce((s, x) => s + (/[a-z]/i.test(x) ? x.length : 0), 0),
    };
  });
  const melhor = (campo: "data" | "valor" | "texto", fora: number[]) =>
    nota
      .map((n, i) => [i, n[campo]] as const)
      .filter(([i]) => !fora.includes(i))
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;

  const nomes = (linhas[0] ?? []).map((x) => x.toLowerCase());
  const porNome = (re: RegExp) => nomes.findIndex((n) => re.test(n));
  const cabecalho = !lerData(linhas[0]?.join(" ") ?? "") && nomes.some((n) => /[a-z]/.test(n)) &&
    nomes.every((n) => lerValor(n) === null || !/\d/.test(n));

  let data = cabecalho ? porNome(/data|date/) : -1;
  if (data < 0) data = melhor("data", []);
  let valor = cabecalho ? porNome(/valor|amount|quantia|montante|r\$/) : -1;
  if (valor < 0) valor = melhor("valor", [data]);
  let descricao = cabecalho ? porNome(/descri|title|t[ií]tulo|estabelec|lan[cç]amento|hist[oó]rico/) : -1;
  if (descricao < 0) descricao = melhor("texto", [data, valor]);
  return { colunas: { data, descricao, valor }, cabecalho };
}

/* ───────────────────────── Leitura completa ───────────────────────── */

export function lerFatura(linhas: string[][], colunas: Colunas, cabecalho: boolean): ResultadoLeitura {
  const corpo = cabecalho ? linhas.slice(1) : linhas;
  const lidas: LinhaImportada[] = [];
  let ignoradas = 0;
  for (const l of corpo) {
    const data = lerData(l[colunas.data] ?? "");
    const valor = lerValor(l[colunas.valor] ?? "");
    const descricao = (l[colunas.descricao] ?? "").trim();
    if (!data || valor === null || valor === 0 || !descricao) {
      ignoradas++;
      continue;
    }
    lidas.push({
      data,
      descricao,
      valor,
      parcela: lerParcela(descricao),
      categoria: sugerirCategoria(descricao),
    });
  }
  // Alguns bancos mostram as compras como valores negativos: nesse caso inverte.
  const negativas = lidas.filter((l) => l.valor < 0).length;
  if (negativas > lidas.length / 2) for (const l of lidas) l.valor = -l.valor;
  return { linhas: lidas, ignoradas };
}

/* ───────────────────────── Extrato da conta ───────────────────────── */

export interface LinhaExtrato {
  data: string;
  descricao: string;
  /** Centavos, sempre positivo. */
  valor: number;
  tipo: "entrada" | "saida";
  categoria: string;
}

/**
 * Lê o extrato da conta corrente: valor negativo é saída, positivo é entrada
 * (é assim na maioria dos bancos). `inverter` troca, para bancos que fazem o
 * contrário.
 */
export function lerExtrato(
  linhas: string[][],
  colunas: Colunas,
  cabecalho: boolean,
  inverter = false,
): { linhas: LinhaExtrato[]; ignoradas: number } {
  const corpo = cabecalho ? linhas.slice(1) : linhas;
  const lidas: LinhaExtrato[] = [];
  let ignoradas = 0;
  for (const l of corpo) {
    const data = lerData(l[colunas.data] ?? "");
    const bruto = lerValor(l[colunas.valor] ?? "");
    const descricao = (l[colunas.descricao] ?? "").trim();
    if (!data || bruto === null || bruto === 0 || !descricao) {
      ignoradas++;
      continue;
    }
    const valor = inverter ? -bruto : bruto;
    lidas.push({
      data,
      descricao,
      valor: Math.abs(valor),
      tipo: valor < 0 ? "saida" : "entrada",
      categoria: valor < 0 ? sugerirCategoria(descricao) : "renda",
    });
  }
  return { linhas: lidas, ignoradas };
}

/* ───────────────────────── Fatura em PDF ───────────────────────── */

const DINHEIRO = /-?\d{1,3}(?:\.\d{3})*,\d{2}(?!\d)/g;

export interface FaturaPdf {
  linhas: LinhaImportada[];
  /** "Total da fatura" escrito no PDF, para conferência. */
  totalInformado: number | null;
  /** Data do documento, usada para descobrir o ano das compras (dd/mm). */
  referencia: string;
}

/**
 * Lê o texto de uma fatura em PDF. Cada compra começa numa linha com a data
 * (dd/mm ou dd/mm/aaaa); o valor em reais é o último número de dinheiro da
 * compra. Descrições que quebram de linha são juntadas. Colunas extras (moeda,
 * cotação) são ignoradas.
 */
export function lerFaturaTexto(texto: string, hoje: string): FaturaPdf {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  // Data do documento: primeira data completa do topo, se houver.
  const dataDoc = texto.slice(0, 600).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const referencia = dataDoc ? `${dataDoc[3]}-${dataDoc[2]}-${dataDoc[1]}` : hoje;
  const anoRef = Number(referencia.slice(0, 4));
  const mesRef = Number(referencia.slice(5, 7));

  const inicio = /^(\d{2})\/(\d{2})(?:\/(\d{2,4}))?\s+(.*)$/;
  const blocos: { dia: number; mes: number; ano: number | null; texto: string }[] = [];
  let totalInformado: number | null = null;

  for (const linha of linhas) {
    const total = linha.match(/total\s+da\s+fatura[^\d-]*(-?\d{1,3}(?:\.\d{3})*,\d{2})/i);
    if (total) totalInformado = lerValor(total[1]);
    const m = linha.match(inicio);
    if (m && Number(m[1]) <= 31 && Number(m[2]) <= 12) {
      const ano = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null;
      blocos.push({ dia: Number(m[1]), mes: Number(m[2]), ano, texto: m[4] });
      continue;
    }
    const ultimo = blocos[blocos.length - 1];
    // Continuação de uma compra que ainda não tem valor (descrição em duas linhas).
    if (ultimo && !(ultimo.texto.match(DINHEIRO)) && !/^total/i.test(linha)) {
      ultimo.texto += " " + linha;
    }
  }

  const lidas: LinhaImportada[] = [];
  for (const b of blocos) {
    const valores = b.texto.match(DINHEIRO);
    if (!valores) continue;
    const valor = lerValor(valores[valores.length - 1]);
    if (valor === null || valor === 0) continue;
    // A descrição termina onde começam as colunas de números.
    const corte = b.texto.search(/\s(?:000\s|US\$|R\$|-?\d{1,3}(?:\.\d{3})*,\d{2}(?!\d))/);
    const descricao = (corte >= 0 ? b.texto.slice(0, corte) : b.texto).trim();
    if (!descricao) continue;
    // Sem ano escrito: mês depois do mês do documento é do ano anterior.
    const ano = b.ano ?? (b.mes > mesRef ? anoRef - 1 : anoRef);
    const data = `${ano}-${String(b.mes).padStart(2, "0")}-${String(b.dia).padStart(2, "0")}`;
    lidas.push({
      data,
      descricao,
      valor,
      parcela: lerParcela(descricao),
      categoria: sugerirCategoria(descricao),
    });
  }
  return { linhas: lidas, totalInformado, referencia };
}
