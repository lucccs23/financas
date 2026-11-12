"use client";

// Gráficos do app, desenhados com HTML e CSS. Regras seguidas em todos:
// marcas finas, 2px de respiro entre partes, texto sempre na cor de texto
// (a cor fica na marca ao lado) e dica ao passar o mouse ou focar.

import { useState, type ReactNode } from "react";
import { compacto, formatar, porcento } from "@/lib/dinheiro";
import { cx, Ponto } from "./ui";

export interface Parte {
  id: string;
  rotulo: string;
  valor: number;
  cor: string;
  /** Cor do texto impresso dentro do bloco (barra alta). */
  tinta?: string;
}

function Balao({ x, children }: { x: number; children: ReactNode }) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute bottom-[calc(100%+10px)] z-20 -translate-x-1/2 rounded-lg border border-line bg-surface px-4 py-2 text-xs whitespace-nowrap shadow-pop"
      style={{ left: `clamp(84px, ${x}%, calc(100% - 84px))` }}
    >
      {children}
    </div>
  );
}

function LinhaBalao({ cor, rotulo, valor }: { cor?: string; rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="flex items-center gap-2 text-ink-2">
        {cor && <Ponto cor={cor} />}
        {rotulo}
      </span>
      <span className="tabular font-semibold text-ink">{valor}</span>
    </div>
  );
}

function useFoco(partes: Parte[]) {
  const [foco, setFoco] = useState<string | null>(null);
  const visiveis = partes.filter((p) => p.valor > 0);
  const total = visiveis.reduce((s, p) => s + p.valor, 0);
  let acumulado = 0;
  const centros = new Map<string, number>();
  for (const p of visiveis) {
    centros.set(p.id, ((acumulado + p.valor / 2) / total) * 100);
    acumulado += p.valor;
  }
  const focada = visiveis.find((p) => p.id === foco) ?? null;
  const descricao = visiveis
    .map((p) => `${p.rotulo} ${formatar(p.valor)} (${porcento(p.valor / total)})`)
    .join("; ");
  return { foco, setFoco, visiveis, total, centros, focada, descricao };
}

/** Barra fina de partes de um todo. A legenda fica por conta de quem usa. */
export function BarraFina({
  partes,
  rotulo,
  altura = 10,
}: {
  partes: Parte[];
  rotulo: string;
  altura?: number;
}) {
  const { foco, setFoco, visiveis, total, centros, focada, descricao } = useFoco(partes);

  if (total <= 0) {
    return <div className="rounded-full bg-surface-3" style={{ height: altura }} />;
  }

  return (
    <div className="relative" role="img" aria-label={`${rotulo}. ${descricao}`}>
      <div className="flex gap-[2px]" onMouseLeave={() => setFoco(null)}>
        {visiveis.map((p) => (
          <div
            key={p.id}
            className="-my-2 cursor-default py-2"
            style={{ flexGrow: p.valor, flexBasis: 0, minWidth: altura }}
            onMouseEnter={() => setFoco(p.id)}
          >
            <div
              className="rounded-full transition-opacity duration-150"
              style={{
                height: altura,
                background: p.cor,
                opacity: foco && foco !== p.id ? 0.4 : 1,
              }}
            />
          </div>
        ))}
      </div>
      {focada && (
        <Balao x={centros.get(focada.id) ?? 50}>
          <LinhaBalao
            cor={focada.cor}
            rotulo={focada.rotulo}
            valor={`${formatar(focada.valor)} · ${porcento(focada.valor / total)}`}
          />
        </Balao>
      )}
    </div>
  );
}

/** Barra alta: cada parte é um bloco com a fatia impressa quando cabe. */
export function BarraAlta({ partes, rotulo }: { partes: Parte[]; rotulo: string }) {
  const { foco, setFoco, visiveis, total, centros, focada, descricao } = useFoco(partes);

  if (total <= 0) {
    return <div className="h-7 rounded-[4px] bg-surface-3" />;
  }

  return (
    <div className="relative" role="img" aria-label={`${rotulo}. ${descricao}`}>
      <div className="flex h-7 gap-[2px]" onMouseLeave={() => setFoco(null)}>
        {visiveis.map((p) => {
          const fatia = p.valor / total;
          return (
            <div
              key={p.id}
              onMouseEnter={() => setFoco(p.id)}
              className="flex cursor-default items-center rounded-[4px] px-2 transition-opacity duration-150"
              style={{
                flexGrow: p.valor,
                flexBasis: 0,
                minWidth: 6,
                background: p.cor,
                color: p.tinta ?? "#fff",
                opacity: foco && foco !== p.id ? 0.45 : 1,
              }}
            >
              {fatia >= 0.14 && (
                <span className="tabular text-[11px]/4 font-semibold">{porcento(fatia)}</span>
              )}
            </div>
          );
        })}
      </div>
      {focada && (
        <Balao x={centros.get(focada.id) ?? 50}>
          <LinhaBalao
            cor={focada.cor}
            rotulo={focada.rotulo}
            valor={`${formatar(focada.valor)} · ${porcento(focada.valor / total, 1)}`}
          />
        </Balao>
      )}
    </div>
  );
}

/** Barra de progresso simples (metas). */
export function Progresso({
  fracao,
  cor,
  rotulo,
  altura = 8,
}: {
  fracao: number;
  cor: string;
  rotulo: string;
  altura?: number;
}) {
  const f = Math.max(0, Math.min(1, fracao));
  return (
    <div
      role="progressbar"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(f * 100)}
      className="overflow-hidden rounded-full"
      style={{ height: altura, background: `color-mix(in srgb, ${cor} 16%, var(--surface))` }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${f * 100}%`, background: cor, minWidth: f > 0 ? altura : 0 }}
      />
    </div>
  );
}

/** Medidor com marca de referência (moradia: até 30% do salário). */
export function Medidor({
  fracao,
  referencia,
  maximo,
  cor,
  rotuloFim,
}: {
  fracao: number;
  referencia: number;
  maximo: number;
  cor: string;
  rotuloFim: string;
}) {
  const f = Math.max(0, Math.min(maximo, fracao)) / maximo;
  const marca = (referencia / maximo) * 100;
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={Math.round(maximo * 100)}
      aria-valuenow={Math.round(fracao * 100)}
      aria-label={`${porcento(fracao)}; referência até ${porcento(referencia)}`}
    >
      <div className="relative pt-6">
        <span
          className="tabular absolute top-0 -translate-x-1/2 text-[11px]/4 font-medium text-ink-2"
          style={{ left: `${marca}%` }}
        >
          {porcento(referencia)}
        </span>
        <div
          className="h-2 overflow-hidden rounded-full"
          style={{ background: `color-mix(in srgb, ${cor} 16%, var(--surface))` }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${f * 100}%`, background: cor, minWidth: f > 0 ? 10 : 0 }}
          />
        </div>
        <span
          aria-hidden
          className="absolute top-5 h-4 w-[2px] -translate-x-1/2 rounded-full bg-ink ring-2 ring-surface"
          style={{ left: `${marca}%` }}
        />
      </div>
      <div className="tabular mt-2 flex justify-between text-[11px]/4 text-ink-3">
        <span>0%</span>
        <span>{rotuloFim}</span>
      </div>
    </div>
  );
}

/* ───────────────────────── Colunas ───────────────────────── */

export interface Serie {
  id: string;
  rotulo: string;
  cor: string;
  /** Cor usada quando o valor é negativo. */
  corNegativa?: string;
}

export interface Grupo {
  chave: string;
  rotulo: string;
  valores: number[];
  /** Linhas extras na dica (ex.: sobra do mês). */
  extra?: { rotulo: string; valor: string }[];
}

/** Escala com divisões redondas que cobre de `minimo` a `maximo`. */
export function escalaRedonda(minimo: number, maximo: number, divisoes = 4) {
  const faixa = Math.max(maximo - minimo, 1);
  const bruto = faixa / divisoes;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto) ?? bruto;
  const base = Math.floor(minimo / passo) * passo;
  const topo = Math.ceil(maximo / passo) * passo;
  const marcas: number[] = [];
  for (let v = base; v <= topo + passo / 2; v += passo) marcas.push(Math.round(v));
  return { base, topo, marcas };
}

export function Colunas({
  series,
  grupos,
  altura = 220,
  selecionado,
  onEscolher,
  rotulo,
}: {
  series: Serie[];
  grupos: Grupo[];
  altura?: number;
  selecionado?: string;
  onEscolher?: (chave: string) => void;
  rotulo: string;
}) {
  const [foco, setFoco] = useState<number | null>(null);
  const todos = grupos.flatMap((g) => g.valores);
  // Sem dados, a escala vai até R$ 100 (10.000 centavos): divisões de R$ 25, e não
  // de centavos, que viravam "0 0 1 1 1" depois de arredondadas.
  const { base, topo, marcas } = escalaRedonda(
    Math.min(0, ...todos),
    Math.max(0, ...todos, 10_000),
  );
  const faixa = topo - base;
  const altPct = (v: number) => (Math.abs(v) / faixa) * 100;
  const zero = (-base / faixa) * 100;
  const largura =
    series.length > 1 ? "w-[clamp(5px,1.5vw,14px)]" : "w-[clamp(8px,2.2vw,22px)]";
  const focado = foco !== null ? grupos[foco] : null;

  return (
    <div role="group" aria-label={rotulo}>
      {series.length > 1 && (
        <ul className="mb-4 flex flex-wrap gap-x-6 gap-y-1">
          {series.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-xs text-ink-2">
              <Ponto cor={s.cor} />
              {s.rotulo}
            </li>
          ))}
        </ul>
      )}
      <div className="relative" style={{ height: altura }}>
        {marcas.map((m) => (
          <div
            key={m}
            className="absolute inset-x-0 flex items-center"
            style={{ bottom: `${zero + (m / faixa) * 100}%`, height: 0 }}
          >
            <span className="tabular w-12 shrink-0 pr-2 text-right text-[11px]/4 text-ink-3">
              {compacto(m)}
            </span>
            <span className={cx("h-px flex-1", m === 0 ? "bg-axis" : "bg-grid")} />
          </div>
        ))}
        <div className="absolute inset-y-0 right-0 left-12 flex" onMouseLeave={() => setFoco(null)}>
          {grupos.map((g, i) => {
            const marcado = g.chave === selecionado;
            const Raiz = onEscolher ? "button" : "div";
            return (
              <Raiz
                key={g.chave}
                {...(onEscolher
                  ? {
                      type: "button" as const,
                      onClick: () => onEscolher(g.chave),
                      "aria-pressed": marcado,
                      "aria-label": `${g.rotulo}: ${series
                        .map((s, k) => `${s.rotulo} ${formatar(g.valores[k])}`)
                        .join(", ")}`,
                    }
                  : {})}
                onMouseEnter={() => setFoco(i)}
                onFocus={() => setFoco(i)}
                onBlur={() => setFoco(null)}
                className={cx(
                  "relative h-full min-w-0 flex-1 rounded-lg transition-colors",
                  marcado ? "bg-surface-2" : foco === i && "bg-surface-2/60",
                )}
              >
                <span className="absolute inset-y-0 left-1/2 flex -translate-x-1/2 gap-[2px]">
                  {g.valores.map((v, k) => (
                    <span key={series[k].id} className={cx("relative h-full", largura)}>
                      <span
                        className="absolute inset-x-0 transition-[height] duration-300"
                        style={
                          v >= 0
                            ? {
                                bottom: `${zero}%`,
                                height: `${altPct(v)}%`,
                                borderRadius: "4px 4px 0 0",
                                background: series[k].cor,
                              }
                            : {
                                top: `${100 - zero}%`,
                                height: `${altPct(v)}%`,
                                borderRadius: "0 0 4px 4px",
                                background: series[k].corNegativa ?? series[k].cor,
                              }
                        }
                      />
                    </span>
                  ))}
                </span>
              </Raiz>
            );
          })}
          {focado && foco !== null && (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-full"
              style={{ height: 0 }}
            >
              <Balao x={((foco + 0.5) / grupos.length) * 100}>
                <p className="mb-1 font-semibold text-ink">{focado.rotulo}</p>
                {series.map((s, k) => (
                  <LinhaBalao
                    key={s.id}
                    cor={focado.valores[k] < 0 ? (s.corNegativa ?? s.cor) : s.cor}
                    rotulo={s.rotulo}
                    valor={formatar(focado.valores[k])}
                  />
                ))}
                {focado.extra?.map((e) => (
                  <LinhaBalao key={e.rotulo} rotulo={e.rotulo} valor={e.valor} />
                ))}
              </Balao>
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 ml-12 flex">
        {grupos.map((g) => (
          <span
            key={g.chave}
            className={cx(
              "flex min-w-0 flex-1 flex-col items-center text-center text-[11px] leading-4",
              g.chave === selecionado ? "font-semibold text-ink" : "text-ink-3",
            )}
          >
            {/* "Jan 27": o ano vai para a linha de baixo, para caber em telas estreitas. */}
            <span className="max-w-full truncate">{g.rotulo.split(" ")[0]}</span>
            {g.rotulo.includes(" ") && (
              <span className="text-[10px]/4 font-normal text-ink-3">{g.rotulo.split(" ").slice(1).join(" ")}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
