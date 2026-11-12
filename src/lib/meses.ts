import type { Mes } from "./types";

export const NOMES_MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const dois = (n: number) => String(n).padStart(2, "0");

export function anoDe(mes: Mes): number {
  return Number(mes.slice(0, 4));
}

export function numeroDe(mes: Mes): number {
  return Number(mes.slice(5, 7));
}

export function mesDe(data: Date): Mes {
  return `${data.getFullYear()}-${dois(data.getMonth() + 1)}`;
}

export function dataISO(data: Date): string {
  return `${mesDe(data)}-${dois(data.getDate())}`;
}

export function addMes(mes: Mes, n: number): Mes {
  const total = anoDe(mes) * 12 + (numeroDe(mes) - 1) + n;
  return `${Math.floor(total / 12)}-${dois((total % 12) + 1)}`;
}

/** Quantos meses de `b` até `a` (positivo quando `a` vem depois). */
export function diffMes(a: Mes, b: Mes): number {
  return anoDe(a) * 12 + numeroDe(a) - (anoDe(b) * 12 + numeroDe(b));
}

export function nomeMes(mes: Mes): string {
  return NOMES_MESES[numeroDe(mes) - 1];
}

export function mesCurto(mes: Mes): string {
  return nomeMes(mes).slice(0, 3);
}

/** "Dez" no ano de referência, "Jan 27" fora dele. */
export function mesCurtoAno(mes: Mes, referencia: Mes): string {
  const curto = mesCurto(mes);
  return anoDe(mes) === anoDe(referencia)
    ? curto
    : `${curto} ${String(anoDe(mes)).slice(2)}`;
}

/** Rótulo para eixo de gráfico: o ano aparece só em janeiro. */
export function mesEixo(mes: Mes): string {
  return numeroDe(mes) === 1
    ? `${mesCurto(mes)} ${String(anoDe(mes)).slice(2)}`
    : mesCurto(mes);
}

export function diasNoMes(mes: Mes): number {
  return new Date(anoDe(mes), numeroDe(mes), 0).getDate();
}

export function intervalo(inicio: Mes, quantidade: number): Mes[] {
  return Array.from({ length: quantidade }, (_, i) => addMes(inicio, i));
}

/** "05/12" a partir do dia e do mês. */
export function diaMes(dia: number, mes: Mes): string {
  return `${dois(dia)}/${dois(numeroDe(mes))}`;
}

/** "2026-12-05" vira "05/12/2026". */
export function dataBR(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}
