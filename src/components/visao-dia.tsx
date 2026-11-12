"use client";

// Painéis da Visão geral sobre o dia a dia: quanto ainda pode gastar (com o
// ritmo do mês e dicas), distribuição dos gastos, transações recentes e o
// resultado do mês.

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Plus,
  Receipt,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useApp, usePerfil } from "@/lib/app";
import { gastosPorCategoria, resumoPessoal } from "@/lib/calc";
import {
  agruparPorDia,
  dicasDoMes,
  lancamentosDaCategoria,
  resultadoDoMes,
  ritmoDeGasto,
} from "@/lib/calc-extra";
import { categoria } from "@/lib/categorias";
import { compacto, formatar, porcento } from "@/lib/dinheiro";
import { addMes, dataBR, dataISO, intervalo, mesCurto, mesEixo, nomeMes } from "@/lib/meses";
import { Colunas } from "./graficos";
import { useModais } from "./modais-contexto";
import {
  Botao,
  BotaoIcone,
  classesBotao,
  corPessoa,
  cx,
  Ladrilho,
  Painel,
  Ponto,
  TituloPainel,
  Valor,
  Vazio,
} from "./ui";

/* ───────────────────────── Quanto ainda pode gastar ───────────────────────── */

function LinhaDoMes({
  acumulado,
  dias,
  orcamento,
  gasto,
}: {
  acumulado: number[];
  dias: number;
  orcamento: number;
  gasto: number;
}) {
  const L = 320;
  const A = 110;
  const topo = Math.max(orcamento, gasto, 1) * 1.08;
  const x = (dia: number) => (dia / dias) * L;
  const y = (v: number) => A - (v / topo) * A;
  const pontos = acumulado.map((v, i) => `${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`);
  const ultimo = acumulado.length;
  const acima = gasto > (orcamento * ultimo) / dias;
  const cor = acima ? "var(--warn)" : "var(--good)";

  return (
    <svg
      viewBox={`0 0 ${L} ${A + 4}`}
      preserveAspectRatio="none"
      className="h-[120px] w-full overflow-visible"
      role="img"
      aria-label={`Gasto acumulado até o dia ${ultimo}: ${formatar(gasto)}, de ${formatar(orcamento)} reservados.`}
    >
      {/* Ritmo ideal: gastar a reserva por igual até o fim do mês. */}
      <line
        x1={0}
        y1={y(0)}
        x2={L}
        y2={y(orcamento)}
        stroke="var(--axis)"
        strokeWidth={1.5}
        strokeDasharray="4 5"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={0}
        y1={A}
        x2={L}
        y2={A}
        stroke="var(--grid)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      {ultimo > 0 && (
        <>
          <polygon
            points={`0,${A} ${pontos.join(" ")} ${x(ultimo).toFixed(1)},${A}`}
            fill={cor}
            opacity={0.1}
          />
          <polyline
            points={`0,${A} ${pontos.join(" ")}`}
            fill="none"
            stroke={cor}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
    </svg>
  );
}

function TextoDica({ texto }: { texto: string }) {
  // Trechos entre ** viram destaque.
  return (
    <>
      {texto.split("**").map((parte, i) =>
        i % 2 ? (
          <strong key={i} className="font-semibold text-ink">
            {parte}
          </strong>
        ) : (
          <span key={i}>{parte}</span>
        ),
      )}
    </>
  );
}

export function AindaPodeGastar() {
  const { dados, mes, hoje } = useApp();
  const perfil = usePerfil();
  const { abrir } = useModais();
  const [indice, setIndice] = useState(0);
  const ritmo = useMemo(
    () => ritmoDeGasto(dados, perfil.id, mes, hoje),
    [dados, perfil.id, mes, hoje],
  );
  const dicas = useMemo(
    () =>
      dicasDoMes(
        dados,
        perfil.id,
        mes,
        hoje,
        (c) => formatar(c),
        (c) => categoria(c).nome,
      ),
    [dados, perfil.id, mes, hoje],
  );
  const dica = dicas[Math.min(indice, dicas.length - 1)];
  const passou = ritmo.restante < 0;

  return (
    <Painel className="flex h-full flex-col overflow-hidden">
      <div className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <TituloPainel>
            {ritmo.orcamento === 0
              ? "Gastos do dia a dia"
              : passou
                ? "Passou do dia a dia em"
                : "Ainda pode gastar"}
          </TituloPainel>
          <BotaoIcone
            icone={Plus}
            rotulo="Lançar um gasto"
            tamanho={32}
            className="-mt-1 border border-line"
            onClick={() => abrir({ tipo: "transacao" })}
          />
        </div>
        {ritmo.orcamento === 0 ? (
          <div className="mt-4">
            {/* Sem limite definido: mostra o que já foi gasto e convida a definir. */}
            {ritmo.gasto > 0 && (
              <>
                <Valor centavos={ritmo.gasto} className="text-[34px] leading-none" />
                <p className="mt-2 mb-4 text-[13px]/5 text-ink-3">
                  gastos no dia a dia em {nomeMes(mes).toLowerCase()}
                </p>
              </>
            )}
            <p className="text-[13px] leading-5 text-ink-3">
              {ritmo.gasto > 0
                ? "Defina um limite para o dia a dia e o app mostra quanto ainda pode gastar e o ritmo do mês."
                : "Defina quanto quer gastar por mês no dia a dia (lanche, transporte, farmácia) e lance os gastos em Transações para acompanhar o ritmo."}
            </p>
            <Link href="/renda" className={cx(classesBotao("secundario", "sm"), "mt-4")}>
              Definir em Minha renda
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-baseline gap-x-2">
              <Valor
                centavos={Math.abs(ritmo.restante)}
                className={cx("text-[34px] leading-none", passou && "!text-bad-text")}
              />
              <span className="tabular text-sm text-ink-3">
                / {formatar(ritmo.orcamento, { semCentavos: true })}
              </span>
            </div>
            <p className="mt-2 text-[13px]/5 text-ink-3">
              {formatar(ritmo.gasto)} gastos no dia a dia
              {ritmo.diaAtual > 0 && ritmo.diaAtual < ritmo.diasNoMes && ritmo.porDia > 0 && (
                <> · até {formatar(ritmo.porDia)} por dia</>
              )}
            </p>
            <div className="mt-4">
              <LinhaDoMes
                acumulado={ritmo.acumulado}
                dias={ritmo.diasNoMes}
                orcamento={ritmo.orcamento}
                gasto={ritmo.gasto}
              />
              <div className="mt-1 flex justify-between text-[11px]/4 text-ink-3">
                <span>1 {mesCurto(mes).toLowerCase()}</span>
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block w-4 border-t-[1.5px] border-dashed border-axis"
                  />
                  ritmo ideal
                </span>
                <span>
                  {ritmo.diasNoMes} {mesCurto(mes).toLowerCase()}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {dica && (
        <div className="mt-auto border-t border-line bg-primary-soft/50 px-4 py-4 sm:px-6">
          <p className="flex items-center gap-2 text-xs font-semibold text-primary-text">
            <Lightbulb size={16} />
            Dica do mês
          </p>
          <p aria-live="polite" className="mt-2 min-h-[40px] text-[13px] leading-5 text-ink-2">
            <TextoDica texto={dica.texto} />
          </p>
          {dicas.length > 1 && (
            <div className="mt-2 flex items-center justify-center gap-2">
              <BotaoIcone
                icone={ChevronLeft}
                rotulo="Dica anterior"
                tamanho={24}
                onClick={() => setIndice((i) => (i - 1 + dicas.length) % dicas.length)}
              />
              {dicas.map((d, i) => (
                <span
                  key={d.id}
                  aria-hidden
                  className={cx(
                    "h-2 rounded-full transition-all",
                    i === Math.min(indice, dicas.length - 1)
                      ? "w-4 bg-primary"
                      : "w-2 bg-line-strong",
                  )}
                />
              ))}
              <BotaoIcone
                icone={ChevronRight}
                rotulo="Próxima dica"
                tamanho={24}
                onClick={() => setIndice((i) => (i + 1) % dicas.length)}
              />
            </div>
          )}
        </div>
      )}
    </Painel>
  );
}

/* ───────────────────────── Distribuição dos gastos ───────────────────────── */

const MAX_FATIAS = 5;

export function DistribuicaoGastos() {
  const { dados, mes } = useApp();
  const perfil = usePerfil();
  const [foco, setFoco] = useState<string | null>(null);
  // Categoria aberta para ver o que tem dentro.
  const [aberta, setAberta] = useState<string | null>(null);
  const dentro = useMemo(
    () =>
      aberta && aberta !== "_outras" ? lancamentosDaCategoria(dados, perfil.id, mes, aberta) : [],
    [aberta, dados, perfil.id, mes],
  );

  const { fatias, total } = useMemo(() => {
    const lista = gastosPorCategoria(dados, perfil.id, mes);
    const antes = new Map(
      gastosPorCategoria(dados, perfil.id, addMes(mes, -1)).map((g) => [g.categoria, g.valor]),
    );
    const principais = lista.slice(0, MAX_FATIAS);
    const resto = lista.slice(MAX_FATIAS).reduce((s, g) => s + g.valor, 0);
    const restoAntes = lista
      .slice(MAX_FATIAS)
      .reduce((s, g) => s + (antes.get(g.categoria) ?? 0), 0);
    const f = [
      ...principais.map((g, i) => ({
        id: g.categoria,
        nome: categoria(g.categoria).nome,
        valor: g.valor,
        cor: i,
        antes: antes.get(g.categoria) ?? 0,
      })),
      ...(resto > 0
        ? [{ id: "_outras", nome: "Outras categorias", valor: resto, cor: -1, antes: restoAntes }]
        : []),
    ];
    return { fatias: f, total: lista.reduce((s, g) => s + g.valor, 0) };
  }, [dados, perfil.id, mes]);

  const R = 52;
  const C = 2 * Math.PI * R;
  const espaco = fatias.length > 1 ? 2.5 : 0;
  // Onde cada fatia começa no círculo (soma das anteriores).
  const inicios = fatias.map((_, i) =>
    fatias.slice(0, i).reduce((s, f) => s + (f.valor / total) * C, 0),
  );
  const focada = fatias.find((f) => f.id === foco);
  const corDe = (i: number) => (i < 0 ? "var(--line-strong)" : corPessoa(i));

  return (
    <Painel className="flex h-full flex-col p-4 sm:p-6">
      <TituloPainel detalhe={nomeMes(mes).toLowerCase()}>Distribuição dos gastos</TituloPainel>
      {total === 0 ? (
        <div className="grid flex-1 place-items-center">
          <Vazio compacto icone={Receipt} titulo="Nenhum gasto neste mês" />
        </div>
      ) : (
        <div className="mt-4 flex flex-1 flex-col items-center gap-6 @md:flex-row @md:items-center">
          <div className="relative h-40 w-40 shrink-0">
            <svg
              viewBox="0 0 140 140"
              className="h-full w-full -rotate-90"
              role="img"
              aria-label={fatias.map((f) => `${f.nome} ${porcento(f.valor / total)}`).join(", ")}
            >
              <circle
                cx={70}
                cy={70}
                r={R}
                fill="none"
                stroke="var(--surface-3)"
                strokeWidth={18}
              />
              {fatias.map((f, indice) => {
                const comprimento = (f.valor / total) * C;
                const desenho = Math.max(0.5, comprimento - espaco);
                return (
                  <circle
                    key={f.id}
                    cx={70}
                    cy={70}
                    r={R}
                    fill="none"
                    stroke={corDe(f.cor)}
                    strokeWidth={foco === f.id ? 22 : 18}
                    strokeDasharray={`${desenho} ${C - desenho}`}
                    strokeDashoffset={-inicios[indice]}
                    opacity={foco && foco !== f.id ? 0.35 : 1}
                    className="cursor-default transition-[opacity,stroke-width] duration-150"
                    onMouseEnter={() => setFoco(f.id)}
                    onMouseLeave={() => setFoco(null)}
                  />
                );
              })}
            </svg>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-[11px]/4 text-ink-3">{focada ? focada.nome : "Gasto total"}</p>
                <p className="tabular text-lg font-semibold tracking-[-0.02em] text-ink">
                  {compacto(focada ? focada.valor : total).replace(/^/, "R$ ")}
                </p>
                {focada && (
                  <p className="tabular text-[11px]/4 text-ink-3">
                    {porcento(focada.valor / total)}
                  </p>
                )}
              </div>
            </div>
          </div>
          <ul className="w-full min-w-0 flex-1">
            {fatias.map((f) => {
              const subiu = f.antes > 0 && f.valor > f.antes;
              const caiu = f.antes > 0 && f.valor < f.antes;
              const podeAbrir = f.id !== "_outras";
              const estaAberta = aberta === f.id;
              return (
                <li
                  key={f.id}
                  onMouseEnter={() => setFoco(f.id)}
                  onMouseLeave={() => setFoco(null)}
                  className={cx(
                    "border-b border-line text-[13px]/5 transition-opacity last:border-0",
                    foco && foco !== f.id && !estaAberta && "opacity-50",
                  )}
                >
                  <button
                    type="button"
                    disabled={!podeAbrir}
                    aria-expanded={podeAbrir ? estaAberta : undefined}
                    title={podeAbrir ? "Ver o que entra nesta categoria" : undefined}
                    onClick={() => setAberta(estaAberta ? null : f.id)}
                    className="flex w-full items-center gap-2 rounded-lg py-2 text-left enabled:cursor-pointer enabled:hover:bg-surface-2"
                  >
                    <Ponto cor={corDe(f.cor)} tamanho={8} />
                    <span className="min-w-0 flex-1 truncate text-ink">{f.nome}</span>
                    <span className="tabular text-xs text-ink-3">{porcento(f.valor / total)}</span>
                    <span className="tabular w-22 text-right font-semibold text-ink">
                      {formatar(f.valor, { semCentavos: true })}
                    </span>
                    <span
                      className="w-4 shrink-0"
                      title={
                        subiu
                          ? `Subiu ${formatar(f.valor - f.antes)} em relação ao mês anterior`
                          : caiu
                            ? `Caiu ${formatar(f.antes - f.valor)} em relação ao mês anterior`
                            : undefined
                      }
                    >
                      {subiu && (
                        <TrendingUp size={16} className="text-warn-text" aria-label="subiu" />
                      )}
                      {caiu && (
                        <TrendingDown size={16} className="text-good-text" aria-label="caiu" />
                      )}
                    </span>
                  </button>
                  {estaAberta && (
                    <ul className="mb-2 ml-4 border-l border-line pl-4">
                      {dentro.slice(0, 6).map((l, i) => (
                        <li key={i} className="flex items-center gap-2 py-1 text-xs">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-ink-2">{l.descricao}</span>
                            <span className="block truncate text-[11px]/4 text-ink-3">
                              {l.origem}
                            </span>
                          </span>
                          <span className="tabular font-medium text-ink">{formatar(l.valor)}</span>
                        </li>
                      ))}
                      {dentro.length > 6 && (
                        <li className="py-1 text-[11px]/4 text-ink-3">
                          e mais {dentro.length - 6}{" "}
                          {dentro.length - 6 === 1 ? "lançamento" : "lançamentos"}
                        </li>
                      )}
                      {dentro.length === 0 && (
                        <li className="py-1 text-xs text-ink-3">
                          Vem da sua parte nas contas da casa.
                        </li>
                      )}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Painel>
  );
}

/* ───────────────────────── Transações recentes ───────────────────────── */

export function TransacoesRecentes() {
  const { dados, hoje } = useApp();
  const perfil = usePerfil();
  const { abrir } = useModais();
  const recentes = useMemo(
    () =>
      dados.transacoes
        .filter((t) => t.perfilId === perfil.id && t.data <= hoje)
        .sort((a, b) => b.data.localeCompare(a.data))
        .slice(0, 7),
    [dados.transacoes, perfil.id, hoje],
  );
  const ontem = hoje ? dataISO(new Date(new Date(`${hoje}T12:00:00`).getTime() - 86_400_000)) : "";

  return (
    <Painel className="flex h-full flex-col p-4 sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <TituloPainel>Transações recentes</TituloPainel>
        <Link
          href="/transacoes"
          className="alvo-toque text-xs font-medium text-primary-text hover:underline"
        >
          Ver todas
        </Link>
      </div>
      {recentes.length === 0 ? (
        <div className="grid flex-1 place-items-center">
          <Vazio
            compacto
            icone={Receipt}
            titulo="Nenhuma transação ainda"
            texto="Lance um gasto do dia a dia para ele aparecer aqui."
          >
            <Botao tamanho="sm" variante="primario" onClick={() => abrir({ tipo: "transacao" })}>
              <Plus size={16} />
              Nova transação
            </Botao>
          </Vazio>
        </div>
      ) : (
        agruparPorDia(recentes).map((g) => (
          <section key={g.data} className="mt-4">
            <h3 className="text-[11px]/4 font-semibold tracking-[0.08em] text-ink-3 uppercase">
              {g.data === hoje ? "Hoje" : g.data === ontem ? "Ontem" : dataBR(g.data).slice(0, 5)}
            </h3>
            <ul>
              {g.itens.map((t) => {
                const c = categoria(t.categoria);
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => abrir({ tipo: "transacao", transacao: t })}
                      className="flex w-full items-center gap-4 py-2 text-left"
                    >
                      <Ladrilho
                        icone={
                          t.tipo === "transferencia"
                            ? ArrowLeftRight
                            : t.tipo === "entrada"
                              ? ArrowDownLeft
                              : c.icone
                        }
                        tamanho={32}
                        className={
                          t.tipo === "entrada" ? "!bg-good-soft !text-good-text" : undefined
                        }
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">
                        {t.descricao}
                      </span>
                      <span className="hidden truncate text-xs text-ink-3 @md:block">{c.nome}</span>
                      <span
                        className={cx(
                          "tabular w-24 text-right text-sm font-semibold",
                          t.tipo === "entrada" ? "text-good-text" : "text-ink",
                        )}
                      >
                        {t.tipo === "entrada" ? "+ " : ""}
                        {formatar(t.valor)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </Painel>
  );
}

/* ───────────────────────── Resultado do mês ───────────────────────── */

export function ResultadoMes() {
  const { dados, mes } = useApp();
  const perfil = usePerfil();
  const r = useMemo(() => resultadoDoMes(dados, perfil.id, mes), [dados, perfil.id, mes]);
  const melhorou = r.variacao !== null && r.variacao > 0;
  // Sobra dos últimos 6 meses, para ver a tendência.
  const historico = useMemo(
    () =>
      intervalo(addMes(mes, -5), 6).map((m) => ({
        chave: m,
        rotulo: mesEixo(m),
        valores: [resumoPessoal(dados, perfil.id, m).sobra],
      })),
    [dados, perfil.id, mes],
  );

  return (
    <Painel className="flex h-full flex-col p-4 sm:p-6">
      <TituloPainel detalhe={nomeMes(mes).toLowerCase()}>Resultado</TituloPainel>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Valor
          centavos={r.resultado}
          className={cx("text-[34px] leading-none", r.resultado < 0 && "!text-bad-text")}
        />
        {r.variacao !== null && (
          <span
            className={cx(
              "tabular inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-semibold",
              melhorou ? "bg-good-soft text-good-text" : "bg-warn-soft text-warn-text",
            )}
          >
            {melhorou ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {r.variacao > 0 ? "+" : ""}
            {porcento(r.variacao)}
          </span>
        )}
      </div>
      <p className="tabular mt-2 text-[13px]/5 text-ink-3">
        vs {formatar(r.anterior)} em {nomeMes(addMes(mes, -1)).toLowerCase()}
      </p>
      <div className="mt-6">
        <Colunas
          rotulo="Resultado de cada mês"
          altura={120}
          selecionado={mes}
          series={[
            {
              id: "sobra",
              rotulo: "Resultado",
              cor: "var(--seg-sobra)",
              corNegativa: "var(--bad)",
            },
          ]}
          grupos={historico}
        />
      </div>
      <div className="mt-auto grid grid-cols-1 gap-2 pt-6 @xs:grid-cols-2">
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-surface-2 px-4 py-2 @xs:block @xs:py-4">
          <p className="flex items-center gap-2 text-xs text-ink-3">
            <ArrowDownLeft size={16} className="text-good-text" />
            Entradas
          </p>
          <p className="tabular text-[15px]/6 font-semibold whitespace-nowrap text-ink @xs:mt-1">
            {formatar(r.receita)}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-surface-2 px-4 py-2 @xs:block @xs:py-4">
          <p className="flex items-center gap-2 text-xs text-ink-3">
            <ArrowUpRight size={16} className="text-bad-text" />
            Saídas
          </p>
          <p className="tabular text-[15px]/6 font-semibold whitespace-nowrap text-ink @xs:mt-1">
            {formatar(r.gasto)}
          </p>
        </div>
      </div>
    </Painel>
  );
}
