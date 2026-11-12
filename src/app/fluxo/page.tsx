"use client";

import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useApp, usePerfil } from "@/lib/app";
import { fluxoDeCaixa, resumoPessoal } from "@/lib/calc";
import { formatar } from "@/lib/dinheiro";
import { addMes, intervalo, mesEixo, nomeMes } from "@/lib/meses";
import { Colunas } from "@/components/graficos";
import { GastosPorCategoria } from "@/components/gastos-categoria";
import { CabecalhoPagina, cx, Painel, TituloPainel, Valor } from "@/components/ui";

function LinhaDetalhe({
  nome,
  valor,
  forte,
  detalhe,
}: {
  nome: string;
  valor: number;
  forte?: boolean;
  detalhe?: string;
}) {
  return (
    <li className="flex items-baseline justify-between gap-4 border-b border-line py-2 text-sm last:border-0">
      <span className={cx("min-w-0 truncate", forte ? "font-medium text-ink" : "text-ink-2")}>
        {nome}
        {detalhe && <span className="text-xs text-ink-3"> · {detalhe}</span>}
      </span>
      <span
        className={cx("tabular whitespace-nowrap", forte ? "font-semibold text-ink" : "text-ink-2")}
      >
        {formatar(valor)}
      </span>
    </li>
  );
}

export default function PaginaFluxo() {
  const { dados, mes, mesHoje, setMes, lar } = useApp();
  const perfil = usePerfil();
  const meses = useMemo(() => intervalo(addMes(mes, -5), 12), [mes]);
  const pontos = useMemo(() => fluxoDeCaixa(dados, perfil.id, meses), [dados, perfil.id, meses]);
  const r = useMemo(() => resumoPessoal(dados, perfil.id, mes), [dados, perfil.id, mes]);
  const mesMin = nomeMes(mes).toLowerCase();
  const acumulado = pontos.reduce((s, p) => s + p.sobra, 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      <CabecalhoPagina
        titulo="Fluxo de caixa"
        texto="Entradas e saídas previstas: cinco meses para trás, seis para frente."
      />

      <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
        <Painel className="p-6">
          <p className="flex items-center gap-2 text-[13px]/5 text-ink-3">
            <ArrowUpRight size={16} style={{ color: "var(--entrada)" }} />
            Entradas de {mesMin}
          </p>
          <Valor centavos={r.renda} className="mt-2 text-[28px] leading-none" />
        </Painel>
        <Painel className="p-6">
          <p className="flex items-center gap-2 text-[13px]/5 text-ink-3">
            <ArrowDownRight size={16} style={{ color: "var(--saida)" }} />
            Saídas de {mesMin}
          </p>
          <Valor centavos={r.saidas} className="mt-2 text-[28px] leading-none" />
        </Painel>
        <Painel className="p-6">
          <p className="text-[13px]/5 text-ink-3">Sobra somada dos 12 meses</p>
          <Valor
            centavos={acumulado}
            className={cx("mt-2 text-[28px] leading-none", acumulado < 0 && "!text-bad-text")}
          />
        </Painel>
      </div>

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
        <Painel className="p-4 sm:p-6">
          <TituloPainel>Entradas e saídas</TituloPainel>
          <p className="mt-1 mb-6 text-[13px]/5 text-ink-3">Clique em um mês para abrir.</p>
          <Colunas
            rotulo="Entradas e saídas por mês"
            selecionado={mes}
            onEscolher={setMes}
            series={[
              { id: "entradas", rotulo: "Entradas", cor: "var(--entrada)" },
              { id: "saidas", rotulo: "Saídas", cor: "var(--saida)" },
            ]}
            grupos={pontos.map((p) => ({
              chave: p.mes,
              rotulo: mesEixo(p.mes),
              valores: [p.entradas, p.saidas],
              extra: [{ rotulo: "Sobra", valor: formatar(p.sobra) }],
            }))}
          />
        </Painel>

        <Painel className="p-4 sm:p-6">
          <TituloPainel>Sobra de cada mês</TituloPainel>
          <p className="mt-1 mb-6 text-[13px]/5 text-ink-3">
            Abaixo da linha do zero, as saídas passam da renda.
          </p>
          <Colunas
            rotulo="Sobra por mês"
            selecionado={mes}
            onEscolher={setMes}
            series={[
              { id: "sobra", rotulo: "Sobra", cor: "var(--seg-sobra)", corNegativa: "var(--bad)" },
            ]}
            grupos={pontos.map((p) => ({
              chave: p.mes,
              rotulo: mesEixo(p.mes),
              valores: [p.sobra],
            }))}
          />
        </Painel>
      </div>

      <GastosPorCategoria />

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start ultra:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Painel className="p-4 sm:p-6">
          <TituloPainel>Mês a mês</TituloPainel>
          <div className="-mx-4 mt-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[640px] text-[13px]/5">
              <thead>
                <tr className="text-left text-xs text-ink-3">
                  <th className="pb-2 font-medium">Mês</th>
                  <th className="pb-2 text-right font-medium">Entradas</th>
                  <th className="pb-2 text-right font-medium">Casa</th>
                  <th className="pb-2 text-right font-medium">Pessoais</th>
                  <th className="pb-2 text-right font-medium">Dia a dia</th>
                  <th className="pb-2 text-right font-medium">Sobra</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {pontos.map((p) => (
                  <tr
                    key={p.mes}
                    onClick={() => setMes(p.mes)}
                    className={cx(
                      "cursor-pointer border-t border-line transition-colors hover:bg-surface-2",
                      p.mes === mes && "bg-surface-2",
                    )}
                  >
                    <td className="rounded-l-lg py-2 pl-2 font-medium text-ink">
                      {nomeMes(p.mes)}
                      {p.mes === mesHoje && <span className="font-normal text-ink-3"> · hoje</span>}
                    </td>
                    <td className="py-2 text-right text-ink-2">{formatar(p.entradas)}</td>
                    <td className="py-2 text-right text-ink-2">{formatar(p.parteCasa)}</td>
                    <td className="py-2 text-right text-ink-2">{formatar(p.pessoais)}</td>
                    <td className="py-2 text-right text-ink-2">{formatar(p.diaADia)}</td>
                    <td
                      className={cx(
                        "rounded-r-lg py-2 pr-2 text-right font-semibold",
                        p.sobra < 0 ? "text-bad-text" : "text-ink",
                      )}
                    >
                      {formatar(p.sobra)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs leading-5 text-ink-3">
            Cada mês usa o salário que valia na época (veja o histórico em Minha renda) e os valores
            reais que você informou nas contas.
          </p>
        </Painel>

        <Painel className="p-4 sm:p-6">
          <TituloPainel>Detalhe de {mesMin}</TituloPainel>
          <p className="mt-6 text-xs font-semibold text-ink">Entradas</p>
          <ul>
            <LinhaDetalhe nome="Salário" valor={r.salario} />
            {r.receitas.map((i) => (
              <LinhaDetalhe key={i.chave} nome={i.nome} valor={i.valor} />
            ))}
            <LinhaDetalhe nome="Total de entradas" valor={r.renda} forte />
          </ul>
          <p className="mt-6 text-xs font-semibold text-ink">Saídas</p>
          <ul>
            {lar && <LinhaDetalhe nome="Sua parte da casa" valor={r.parteCasa} />}
            {r.itensPessoais.map((i) => (
              <LinhaDetalhe
                key={i.chave}
                nome={i.nome}
                valor={i.valor}
                detalhe={`dia ${String(i.dia).padStart(2, "0")}`}
              />
            ))}
            <LinhaDetalhe nome="Dia a dia" valor={r.diaADia} />
            <LinhaDetalhe nome="Total de saídas" valor={r.saidas} forte />
          </ul>
          <div className="mt-6 flex items-baseline justify-between rounded-2xl bg-surface-2 px-4 py-4">
            <span className="text-sm font-medium text-ink-2">Sobra</span>
            <span
              className={cx(
                "tabular text-lg font-semibold",
                r.sobra < 0 ? "text-bad-text" : "text-ink",
              )}
            >
              {formatar(r.sobra)}
            </span>
          </div>
        </Painel>
      </div>
    </div>
  );
}
