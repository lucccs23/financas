"use client";

// Análises: o consumo de cada mês (cada gasto no mês em que aconteceu),
// categorias ao longo do tempo, onde você mais gasta e em que dias.

import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Receipt,
  Trophy,
  Wallet,
} from "lucide-react";
import { useApp, usePerfil } from "@/lib/app";
import {
  DIAS_DA_SEMANA,
  gastoPorDiaDaSemana,
  gastoPorMes,
  gastosDoPeriodo,
  numerosDoMes,
  ondeMaisGasta,
  tendenciaPorCategoria,
} from "@/lib/analises";
import { categoria } from "@/lib/categorias";
import { formatar } from "@/lib/dinheiro";
import { addMes, diasNoMes, intervalo, mesEixo, nomeMes } from "@/lib/meses";
import { Colunas } from "@/components/graficos";
import {
  CabecalhoPagina,
  cx,
  Etiqueta,
  Painel,
  TituloPainel,
  Valor,
} from "@/components/ui";

/** "+18%" / "−7%". */
const pct = (v: number) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Math.round(v * 100))}%`;

function Variacao({ v, sufixo }: { v: number | null; sufixo?: string }) {
  if (v === null)
    return <span className="text-xs text-ink-3">sem base para comparar</span>;
  const alto = v > 0.15;
  const baixo = v < -0.15;
  return (
    <Etiqueta tom={alto ? "ruim" : baixo ? "bom" : undefined}>
      {alto ? (
        <ArrowUpRight size={12} />
      ) : baixo ? (
        <ArrowDownRight size={12} />
      ) : null}
      {pct(v)}
      {sufixo && <span className="font-normal"> {sufixo}</span>}
    </Etiqueta>
  );
}

function Destaque({
  icone: Icone,
  rotulo,
  children,
  rodape,
}: {
  icone: typeof Wallet;
  rotulo: string;
  children: React.ReactNode;
  rodape?: React.ReactNode;
}) {
  return (
    <Painel className="flex flex-col p-4 sm:p-6">
      <p className="flex items-center gap-2 text-[13px]/5 text-ink-3">
        <Icone size={16} className="shrink-0 text-ink-3" />
        {rotulo}
      </p>
      <div className="mt-2 min-w-0">{children}</div>
      {rodape && (
        <div className="mt-auto pt-4 text-xs text-ink-3">{rodape}</div>
      )}
    </Painel>
  );
}

/** Seis colunas pequenas: o histórico de uma categoria. O mês atual em destaque. */
function MiniColunas({
  valores,
  rotulo,
}: {
  valores: number[];
  rotulo: string;
}) {
  const max = Math.max(...valores, 1);
  return (
    <span
      role="img"
      aria-label={rotulo}
      className="flex h-8 items-end gap-[2px]"
    >
      {valores.map((v, i) => (
        <span
          key={i}
          className={cx(
            "w-[6px] rounded-t-[2px]",
            i === valores.length - 1 ? "bg-primary" : "bg-primary/35",
          )}
          style={{ height: `${Math.max(v > 0 ? 8 : 0, (v / max) * 100)}%` }}
        />
      ))}
    </span>
  );
}

export default function PaginaAnalises() {
  const { dados, mes, mesHoje, hoje, setMes } = useApp();
  const perfil = usePerfil();
  // Seis meses até o escolhido no topo.
  const meses = useMemo(() => intervalo(addMes(mes, -5), 6), [mes]);
  const gastos = useMemo(
    () => gastosDoPeriodo(dados, perfil.id, meses),
    [dados, perfil.id, meses],
  );
  const mesMin = nomeMes(mes).toLowerCase();
  const emAndamento = mes === mesHoje && !!hoje;
  const diasContados = emAndamento
    ? Number(hoje!.slice(8, 10))
    : diasNoMes(mes);

  const porMes = useMemo(() => gastoPorMes(gastos, meses), [gastos, meses]);
  const n = useMemo(
    () => numerosDoMes(gastos, meses, diasContados),
    [gastos, meses, diasContados],
  );
  const tendencias = useMemo(
    () => tendenciaPorCategoria(gastos, meses).slice(0, 8),
    [gastos, meses],
  );
  const lugares = useMemo(() => ondeMaisGasta(gastos, mes, 8), [gastos, mes]);
  const [verTodos, setVerTodos] = useState(false);

  // Dias da semana: os últimos 90 dias até hoje (ou até o fim do mês escolhido).
  const semana = useMemo(() => {
    const fim = emAndamento
      ? hoje!
      : `${mes}-${String(diasNoMes(mes)).padStart(2, "0")}`;
    const dias: string[] = [];
    const d = new Date(`${fim}T12:00:00`);
    for (let i = 0; i < 90; i++) {
      dias.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() - 1);
    }
    return gastoPorDiaDaSemana(gastos, dias);
  }, [gastos, emAndamento, hoje, mes]);
  const diaMaisCaro = [...semana].sort((a, b) => b.media - a.media)[0];

  const projecao =
    emAndamento && diasContados > 0
      ? Math.round((n.total / diasContados) * diasNoMes(mes))
      : null;
  const semDados = gastos.length === 0;
  const maxLugar = lugares[0]?.total ?? 1;

  return (
    <div className="space-y-4 sm:space-y-6">
      <CabecalhoPagina
        titulo="Análises"
        texto="O que você gastou, onde e quando. Cada gasto conta no mês em que aconteceu, não no da fatura."
      />

      {semDados ? (
        <Painel className="p-6 text-sm text-ink-2">
          Ainda não há gastos nos últimos seis meses. Lance um gasto ou conecte
          um banco e as análises aparecem aqui.
        </Painel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:gap-6 xl:grid-cols-4">
            <Destaque
              icone={Wallet}
              rotulo={`Gasto em ${mesMin}${emAndamento ? " até hoje" : ""}`}
              rodape={
                n.mediaAnterior > 0 ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <Variacao v={n.variacao} />
                    média de {formatar(n.mediaAnterior)}
                  </span>
                ) : (
                  "sem meses anteriores para comparar"
                )
              }
            >
              <Valor centavos={n.total} className="text-[28px] leading-none" />
            </Destaque>
            <Destaque
              icone={CalendarDays}
              rotulo="Média por dia"
              rodape={
                projecao !== null
                  ? `nesse ritmo, ${mesMin} fecha em ${formatar(projecao)}`
                  : `${diasContados} dias`
              }
            >
              <Valor centavos={n.porDia} className="text-[28px] leading-none" />
            </Destaque>
            <Destaque
              icone={Receipt}
              rotulo="Compras e pagamentos"
              rodape={`${formatar(n.ticketMedio)} em média cada`}
            >
              <p className="tabular text-[28px]/none font-semibold text-ink">
                {n.quantos}
              </p>
            </Destaque>
            <Destaque
              icone={Trophy}
              rotulo="Maior gasto"
              rodape={
                n.maior
                  ? `${n.maior.onde} · ${n.maior.data.slice(8, 10)}/${n.maior.data.slice(5, 7)}`
                  : undefined
              }
            >
              {n.maior ? (
                <Valor
                  centavos={n.maior.valor}
                  className="text-[28px] leading-none"
                />
              ) : (
                <p className="text-sm text-ink-3">Nenhum ainda</p>
              )}
            </Destaque>
          </div>

          <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
            <Painel className="p-4 sm:p-6">
              <TituloPainel>Gasto mês a mês</TituloPainel>
              <p className="mt-1 mb-6 text-[13px]/5 text-ink-3">
                No cartão e fora dele (Pix, débito, boleto). Clique em um mês
                para abrir.
              </p>
              <Colunas
                rotulo="Gasto por mês, no cartão e fora dele"
                selecionado={mes}
                onEscolher={setMes}
                series={[
                  {
                    id: "cartao",
                    rotulo: "No cartão",
                    cor: "var(--seg-pessoal)",
                  },
                  {
                    id: "conta",
                    rotulo: "Fora do cartão",
                    cor: "var(--seg-dia)",
                  },
                ]}
                grupos={porMes.map((p) => ({
                  chave: p.mes,
                  rotulo: mesEixo(p.mes),
                  valores: [p.cartao, p.conta],
                  extra: [{ rotulo: "Total", valor: formatar(p.total) }],
                }))}
              />
            </Painel>

            <Painel className="p-4 sm:p-6">
              <TituloPainel>Dias da semana</TituloPainel>
              <p className="mt-1 mb-6 text-[13px]/5 text-ink-3">
                Quanto sai, em média, em cada dia da semana (últimos 90 dias).
                {diaMaisCaro && diaMaisCaro.media > 0 && (
                  <>
                    {" "}
                    O dia mais caro é{" "}
                    <strong className="font-semibold text-ink">
                      {
                        [
                          "domingo",
                          "segunda",
                          "terça",
                          "quarta",
                          "quinta",
                          "sexta",
                          "sábado",
                        ][diaMaisCaro.dia]
                      }
                    </strong>
                    .
                  </>
                )}
              </p>
              <Colunas
                rotulo="Gasto médio por dia da semana"
                series={[
                  {
                    id: "media",
                    rotulo: "Média do dia",
                    cor: "var(--seg-pessoal)",
                  },
                ]}
                grupos={semana.map((d) => ({
                  chave: String(d.dia),
                  rotulo: DIAS_DA_SEMANA[d.dia],
                  valores: [d.media],
                  extra: [
                    { rotulo: "Gastos no período", valor: String(d.vezes) },
                  ],
                }))}
              />
            </Painel>
          </div>

          <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start">
            <Painel className="p-4 sm:p-6">
              <TituloPainel detalhe="últimos 6 meses">
                Categorias ao longo do tempo
              </TituloPainel>
              <p className="mt-1 text-[13px]/5 text-ink-3">
                {mesMin[0].toUpperCase() + mesMin.slice(1)} comparado com a
                média dos meses anteriores.
              </p>
              <div className="rolagem-fina mt-4 overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-ink-3">
                      <th className="py-2 font-medium">Categoria</th>
                      <th className="py-2 font-medium">6 meses</th>
                      <th className="py-2 text-right font-medium">
                        {nomeMes(mes)}
                      </th>
                      <th className="py-2 text-right font-medium">Média</th>
                      <th className="py-2 text-right font-medium">Variação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tendencias.map((t) => {
                      const c = categoria(t.categoria);
                      const Icone = c.icone;
                      return (
                        <tr key={t.categoria} className="border-t border-line">
                          <td className="py-2 pr-4">
                            <span className="flex items-center gap-2 font-medium text-ink">
                              <Icone
                                size={16}
                                className="shrink-0 text-ink-3"
                              />
                              {c.nome}
                            </span>
                          </td>
                          <td className="py-2 pr-4">
                            <MiniColunas
                              valores={t.valores}
                              rotulo={`${c.nome}: ${t.valores.map((v, i) => `${mesEixo(meses[i])} ${formatar(v)}`).join(", ")}`}
                            />
                          </td>
                          <td className="tabular py-2 text-right font-semibold text-ink">
                            {formatar(t.atual)}
                          </td>
                          <td className="tabular py-2 text-right text-ink-2">
                            {t.media > 0 ? formatar(t.media) : "—"}
                          </td>
                          <td className="py-2 pl-4 text-right">
                            <Variacao v={t.variacao} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Painel>

            <Painel className="p-4 sm:p-6">
              <TituloPainel detalhe={mesMin}>Onde você mais gasta</TituloPainel>
              <ul className="mt-4 space-y-4">
                {(verTodos ? lugares : lugares.slice(0, 5)).map((l) => (
                  <li key={l.onde}>
                    <div className="flex items-baseline justify-between gap-4 text-sm">
                      <span className="min-w-0 truncate font-medium text-ink">
                        {l.onde}
                      </span>
                      <span className="tabular whitespace-nowrap font-semibold text-ink">
                        {formatar(l.total)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(l.total / maxLugar) * 100}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-ink-3">
                      {categoria(l.categoria).nome} · {l.vezes}{" "}
                      {l.vezes === 1 ? "vez" : "vezes"}
                      {l.vezes > 1 && ` · ${formatar(l.ticketMedio)} em média`}
                    </p>
                  </li>
                ))}
              </ul>
              {lugares.length > 5 && (
                <button
                  type="button"
                  onClick={() => setVerTodos((v) => !v)}
                  className="mt-4 text-[13px] font-medium text-primary-text hover:underline"
                >
                  {verTodos ? "Mostrar menos" : `Ver os ${lugares.length}`}
                </button>
              )}
            </Painel>
          </div>
        </>
      )}
    </div>
  );
}
