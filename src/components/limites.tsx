"use client";

// Limite de gasto por categoria: quanto quer gastar por mês em cada uma. O
// progresso aparece na distribuição dos gastos e o sino avisa quando passar.

import { useMemo, useState } from "react";
import { useApp, usePerfil } from "@/lib/app";
import { gastosPorCategoria } from "@/lib/calc";
import { CATEGORIAS, categoria } from "@/lib/categorias";

/** As categorias de gasto e as que vêm do banco (Pix pelo cartão, tarifas). */
const OPCOES = [...CATEGORIAS, categoria("transferencia"), categoria("tarifa")];
import { formatar } from "@/lib/dinheiro";
import { nomeMes } from "@/lib/meses";
import { Botao, EntradaValor, Ladrilho, Painel, TituloPainel, cx } from "./ui";

export function LimitesCategoria() {
  const { dados, mes, atualizar, avisar } = useApp();
  const perfil = usePerfil();
  const salvos = useMemo(() => perfil.limites ?? {}, [perfil.limites]);
  const [limites, setLimites] = useState<Record<string, number>>(salvos);
  const gastos = useMemo(
    () => new Map(gastosPorCategoria(dados, perfil.id, mes).map((g) => [g.categoria, g.valor])),
    [dados, perfil.id, mes],
  );
  const mudou = OPCOES.some((c) => (limites[c.id] ?? 0) !== (salvos[c.id] ?? 0));

  const salvar = async () => {
    const limpos = Object.fromEntries(Object.entries(limites).filter(([, v]) => v > 0));
    await atualizar("perfis", perfil.id, {
      limites: Object.keys(limpos).length ? limpos : null,
    });
    avisar("Limites salvos.");
  };

  return (
    <Painel className="p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <TituloPainel>Limites por categoria</TituloPainel>
          <p className="mt-2 text-[13px]/5 text-ink-3">
            Quanto quer gastar por mês em cada categoria. Deixe em zero para não ter limite. O sino
            avisa quando passar.
          </p>
        </div>
        <Botao variante="primario" tamanho="sm" disabled={!mudou} onClick={salvar}>
          Salvar limites
        </Botao>
      </div>
      <ul className="mt-4 grid gap-x-6 gap-y-2 @lg:grid-cols-2">
        {OPCOES.map((c) => {
          const gasto = gastos.get(c.id) ?? 0;
          const limite = limites[c.id] ?? 0;
          const passou = limite > 0 && gasto > limite;
          return (
            <li key={c.id} className="flex items-center gap-4 py-1">
              <Ladrilho icone={c.icone} tamanho={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{c.nome}</span>
                <span
                  className={cx("block truncate text-xs", passou ? "text-bad-text" : "text-ink-3")}
                >
                  {formatar(gasto, { semCentavos: true })} em {nomeMes(mes).toLowerCase()}
                </span>
              </span>
              <span className="w-32 shrink-0">
                <EntradaValor
                  valor={limite}
                  onMudar={(v) => setLimites((l) => ({ ...l, [c.id]: v }))}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </Painel>
  );
}
