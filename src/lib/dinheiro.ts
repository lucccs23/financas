// Formatação de dinheiro. Os valores chegam sempre em centavos.

function milhares(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function partes(centavos: number) {
  const abs = Math.abs(Math.round(centavos));
  return {
    negativo: centavos < 0,
    inteiro: milhares(Math.floor(abs / 100)),
    centavos: String(abs % 100).padStart(2, "0"),
  };
}

export function formatar(
  centavos: number,
  opcoes: { sinal?: boolean; semCentavos?: boolean } = {},
): string {
  const p = partes(centavos);
  const sinal = p.negativo ? "− " : opcoes.sinal ? "+ " : "";
  return `${sinal}R$ ${p.inteiro}${opcoes.semCentavos ? "" : "," + p.centavos}`;
}

/** Valor curto para eixos de gráfico: 850, 1,2 mil, 12 mil, 1,5 mi. */
export function compacto(centavos: number): string {
  const v = Math.abs(centavos) / 100;
  const sinal = centavos < 0 ? "−" : "";
  const curto = (n: number) =>
    (Math.round(n * 10) / 10).toString().replace(".", ",");
  if (v >= 1_000_000) return `${sinal}${curto(v / 1_000_000)} mi`;
  if (v >= 1_000) return `${sinal}${curto(v / 1_000)} mil`;
  return `${sinal}${Math.round(v)}`;
}

export function porcento(fracao: number, casas = 0): string {
  const f = 10 ** casas;
  const n = Math.round(fracao * 100 * f) / f;
  return `${n.toFixed(casas).replace(".", ",")}%`;
}

/** Lê o que foi digitado como centavos: "1.234,56" e "123456" viram 123456. */
export function lerCentavos(texto: string): number {
  const digitos = texto.replace(/\D/g, "");
  return digitos ? parseInt(digitos, 10) : 0;
}

export function mascara(centavos: number): string {
  const p = partes(centavos);
  return `${p.inteiro},${p.centavos}`;
}
