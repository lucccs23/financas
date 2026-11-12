import { describe, expect, it } from "vitest";
import { sugerirCategoria } from "./categorias";
import {
  adivinharColunas,
  lerCsv,
  lerData,
  lerExtrato,
  lerFatura,
  lerFaturaTexto,
  lerParcela,
  lerValor,
} from "./importar";

describe("leitura de valores", () => {
  it("entende os formatos comuns", () => {
    expect(lerValor("R$ 1.234,56")).toBe(123_456);
    expect(lerValor("1234.56")).toBe(123_456);
    expect(lerValor("1,234.56")).toBe(123_456);
    expect(lerValor("45,9")).toBe(4_590);
    expect(lerValor("-45,90")).toBe(-4_590);
    expect(lerValor("(45,90)")).toBe(-4_590);
    expect(lerValor("45,90-")).toBe(-4_590);
    expect(lerValor("1.234")).toBe(123_400);
    expect(lerValor("abc")).toBeNull();
  });
});

describe("leitura de datas", () => {
  it("entende dia/mês/ano e ano-mês-dia", () => {
    expect(lerData("14/10/2026")).toBe("2026-10-14");
    expect(lerData("4/1/26")).toBe("2026-01-04");
    expect(lerData("2026-10-14")).toBe("2026-10-14");
    expect(lerData("2026-10-14T10:00:00")).toBe("2026-10-14");
    expect(lerData("31/13/2026")).toBeNull();
    expect(lerData("Restaurante")).toBeNull();
  });
});

describe("parcelas", () => {
  it("acha a parcela na descrição", () => {
    expect(lerParcela("Loja X - Parcela 2/10")).toEqual({ numero: 2, total: 10 });
    expect(lerParcela("MAGAZINE 03/12")).toEqual({ numero: 3, total: 12 });
    expect(lerParcela("Loja (1 de 3)")).toEqual({ numero: 1, total: 3 });
    expect(lerParcela("Padaria do Zé")).toBeNull();
    expect(lerParcela("Loja 13/12")).toBeNull();
  });
});

describe("arquivo completo", () => {
  it("formato com cabeçalho e ponto decimal (estilo Nubank)", () => {
    const csv = "date,title,amount\n2026-10-14,Restaurante,186.40\n2026-10-15,Loja - Parcela 2/4,310.00\n2026-10-20,Pagamento recebido,-1500.00\n";
    const linhas = lerCsv(csv);
    const { colunas, cabecalho } = adivinharColunas(linhas);
    expect(cabecalho).toBe(true);
    expect(colunas).toEqual({ data: 0, descricao: 1, valor: 2 });
    const r = lerFatura(linhas, colunas, cabecalho);
    expect(r.linhas.map((l) => [l.data, l.valor])).toEqual([
      ["2026-10-14", 18_640],
      ["2026-10-15", 31_000],
      ["2026-10-20", -150_000],
    ]);
    expect(r.linhas[1].parcela).toEqual({ numero: 2, total: 4 });
  });

  it("formato com ponto e vírgula, vírgula decimal e compras negativas", () => {
    const csv = 'Data;Lançamento;Valor\n14/10/2026;"SUPERMERCADO BOM; PRECO";-"R$ 250,30"\n15/10/2026;UBER TRIP;-23,50\n';
    const linhas = lerCsv(csv);
    expect(linhas[1][1]).toBe("SUPERMERCADO BOM; PRECO");
    const { colunas, cabecalho } = adivinharColunas(linhas);
    const r = lerFatura(linhas, colunas, cabecalho);
    expect(r.linhas.map((l) => [l.valor, l.categoria])).toEqual([
      [25_030, "mercado"],
      [2_350, "transporte"],
    ]);
  });

  it("sem cabeçalho", () => {
    const csv = "14/10/2026,Netflix,39.90\n15/10/2026,Drogaria Sao Paulo,52.00\n";
    const linhas = lerCsv(csv);
    const { colunas, cabecalho } = adivinharColunas(linhas);
    expect(cabecalho).toBe(false);
    const r = lerFatura(linhas, colunas, cabecalho);
    expect(r.linhas.map((l) => l.categoria)).toEqual(["assinatura", "saude"]);
  });
});

describe("categorias sugeridas", () => {
  it("reconhece nomes comuns, com ou sem acento", () => {
    expect(sugerirCategoria("iFood *Pizzaria")).toBe("alimentacao");
    expect(sugerirCategoria("AMAZON MARKETPLACE")).toBe("compras");
    expect(sugerirCategoria("FARMÁCIA PAGUE MENOS")).toBe("saude");
    expect(sugerirCategoria("Oficina do Zé")).toBe("outros");
  });
});

describe("extrato da conta", () => {
  it("negativo é saída, positivo é entrada; dá para inverter", () => {
    const csv = "Data;Histórico;Valor\n02/11/2026;PIX RECEBIDO FULANO;150,00\n03/11/2026;UBER *TRIP;-23,50\n";
    const linhas = lerCsv(csv);
    const { colunas, cabecalho } = adivinharColunas(linhas);
    const r = lerExtrato(linhas, colunas, cabecalho);
    expect(r.linhas.map((l) => [l.tipo, l.valor, l.categoria])).toEqual([
      ["entrada", 15_000, "renda"],
      ["saida", 2_350, "transporte"],
    ]);
    expect(lerExtrato(linhas, colunas, cabecalho, true).linhas.map((l) => l.tipo)).toEqual(["saida", "entrada"]);
  });
});

describe("fatura em PDF (texto extraído)", () => {
  // Estrutura igual à de uma fatura real do Bradesco Cartões, com dados trocados.
  const texto = `XXXX.XXXX.XXXX.0000
Aplicativo Bradesco Cartões
Data: 11/11/2026 - 15:58
Situação do Extrato: EM ABERTO
FULANO DE TAL - MASTERCARD PLATINUM
Data Histórico Moeda de
origem US$ Cotação US$ R$
05/11 AMAZON BR *Amazon BR Sa 1/3 000 0,00 0,00 R$ 0,00 11,98
03/11 AMAZONMKTPLC*NEXUSMARK
NI 000 0,00 0,00 R$ 0,00 14,28
03/11 PAGAMENTO RECEBIDO - OBRI 000 0,00 0,00 R$ 0,00 -326,87
28/10 PIZZARIA EXAGERADA FAL BA 000 0,00 0,00 R$ 0,00 90,99
07/10 AMAZON CPI *Amazon BR Sa 2/12 000 0,00 0,00 R$ 0,00 16,86
01/07 AMAZON BR SA 5/13 000 0,00 0,00 R$ 0,00 51,46
24/12 LOJA DO ANO PASSADO 000 0,00 0,00 R$ 0,00 1.234,50
. Total para FULANO . . . R$ 623,25
. Total da Fatura em Real . . . R$ 475,06
* Extrato em Aberto: Valores sujeitos a alteração até o fechamento da fatura.`;
  const r = lerFaturaTexto(texto, "2026-11-20");

  it("acha cada compra com data, descrição e valor em reais", () => {
    expect(r.linhas.map((l) => [l.data, l.descricao, l.valor])).toEqual([
      ["2026-11-05", "AMAZON BR *Amazon BR Sa 1/3", 1_198],
      ["2026-11-03", "AMAZONMKTPLC*NEXUSMARK NI", 1_428],
      ["2026-11-03", "PAGAMENTO RECEBIDO - OBRI", -32_687],
      ["2026-10-28", "PIZZARIA EXAGERADA FAL BA", 9_099],
      ["2026-10-07", "AMAZON CPI *Amazon BR Sa 2/12", 1_686],
      ["2026-07-01", "AMAZON BR SA 5/13", 5_146],
      ["2025-12-24", "LOJA DO ANO PASSADO", 123_450],
    ]);
  });
  it("lê parcelas, categoria, total da fatura e a data do documento", () => {
    expect(r.linhas[0].parcela).toEqual({ numero: 1, total: 3 });
    expect(r.linhas[4].parcela).toEqual({ numero: 2, total: 12 });
    expect(r.linhas[3].categoria).toBe("alimentacao");
    expect(r.totalInformado).toBe(47_506);
    expect(r.referencia).toBe("2026-11-11");
  });
});
