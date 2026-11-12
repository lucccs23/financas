"use client";

// Para onde foi o dinheiro no mês: uma barra por categoria, da maior para a
// menor, comparando com o mês anterior.

import { useMemo, useState } from "react";
import { PieChart } from "lucide-react";
import { useApp, usePerfil } from "@/lib/app";
import { gastosPorCategoria } from "@/lib/calc";
import { categoria } from "@/lib/categorias";
import { formatar, porcento } from "@/lib/dinheiro";
import { addMes, mesCurto, nomeMes } from "@/lib/meses";
import { cx, Ladrilho, Painel, TituloPainel, Vazio } from "./ui";

const LIMITE_INICIAL = 8;

export function GastosPorCategoria() {
  const { dados, mes } = useApp();
  const perfil = usePerfil();
  const [tudo, setTudo] = useState(false);

  const atual = useMemo(() => gastosPorCategoria(dados, perfil.id, mes), [dados, perfil.id, mes]);
  const anterior = useMemo(() => {
    const lista = gastosPorCategoria(dados, perfil.id, addMes(mes, -1));
    return new Map(lista.map((g) => [g.categoria, g.valor]));
  }, [dados, perfil.id, mes]);

  const total = atual.reduce((s, g) => s + g.valor, 0);
  const maior = atual[0]?.valor ?? 0;
  const visiveis = tudo ? atual : atual.slice(0, LIMITE_INICIAL);
  const mesAnterior = mesCurto(addMes(mes, -1)).toLowerCase();

  return (
    <Painel className="p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <TituloPainel>Para onde foi o dinheiro</TituloPainel>
        {total > 0 && (
          <p className="tabular text-[13px]/5 text-ink-3">
            {formatar(total)} em {nomeMes(mes).toLowerCase()}
          </p>
        )}
      </div>
      <p className="mt-1 text-[13px]/5 text-ink-3">
        Sua parte nas contas da casa, suas contas e o dia a dia. Faturas aparecem abertas pelas
        categorias das compras.
      </p>

      {atual.length === 0 ? (
        <Vazio compacto icone={PieChart} titulo="Nenhum gasto neste mês" />
      ) : (
        <>
          <ul className="mt-6 grid gap-x-10 gap-y-1 xl:grid-cols-2">
            {visiveis.map((g) => {
              const c = categoria(g.categoria);
              const antes = anterior.get(g.categoria) ?? 0;
              const diferenca = g.valor - antes;
              return (
                <li key={g.categoria} className="flex items-center gap-4 py-2">
                  <Ladrilho icone={c.icone} tamanho={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="truncate text-sm font-medium text-ink">{c.nome}</span>
                      <span className="tabular shrink-0 text-sm font-semibold text-ink">
                        {formatar(g.valor)}
                      </span>
                    </div>
                    <div
                      className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3"
                      role="img"
                      aria-label={`${c.nome}: ${porcento(g.valor / total)} dos gastos`}
                    >
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{
                          width: `${(g.valor / maior) * 100}%`,
                          background: "var(--seg-pessoal)",
                        }}
                      />
                    </div>
                    <div className="tabular mt-1 flex justify-between gap-4 text-[11px]/4 text-ink-3">
                      <span>{porcento(g.valor / total)} do total</span>
                      <span
                        className={cx(
                          diferenca > 0 && antes > 0 && "text-warn-text",
                          diferenca < 0 && "text-good-text",
                        )}
                      >
                        {antes === 0
                          ? `não teve em ${mesAnterior}`
                          : diferenca === 0
                            ? `igual a ${mesAnterior}`
                            : `${formatar(diferenca, { sinal: true })} vs ${mesAnterior}`}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {atual.length > LIMITE_INICIAL && (
            <button
              type="button"
              onClick={() => setTudo((v) => !v)}
              className="mt-4 text-xs font-medium text-primary-text hover:underline"
            >
              {tudo ? "Mostrar menos" : `Ver todas as ${atual.length} categorias`}
            </button>
          )}
        </>
      )}
    </Painel>
  );
}
