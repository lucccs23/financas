"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Minus, Pencil, PiggyBank, Plus, X } from "lucide-react";
import { useApp } from "@/lib/app";
import { saldoDaMeta } from "@/lib/calc";
import { formatar, porcento } from "@/lib/dinheiro";
import { dataBR, nomeMes } from "@/lib/meses";
import type { Meta } from "@/lib/types";
import { Progresso } from "@/components/graficos";
import { useModais } from "@/components/modais-contexto";
import {
  Botao,
  BotaoIcone,
  CabecalhoPagina,
  corPessoa,
  cx,
  Emblema,
  Etiqueta,
  Painel,
  Ponto,
  Valor,
  Vazio,
} from "@/components/ui";

function CartaoMeta({ meta }: { meta: Meta }) {
  const { dados, remover, avisar } = useApp();
  const { abrir } = useModais();
  const [tudo, setTudo] = useState(false);
  const saldo = saldoDaMeta(meta, dados);
  const fracao = meta.alvo > 0 ? saldo / meta.alvo : 0;
  const movimentos = dados.aportes
    .filter((a) => a.metaId === meta.id)
    .sort((a, b) => b.data.localeCompare(a.data));
  const visiveis = tudo ? movimentos : movimentos.slice(0, 5);
  const cor = corPessoa(meta.cor);

  return (
    <Painel className="flex flex-col p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Ponto cor={cor} tamanho={8} />
          <h2 className="truncate text-[15px]/6 font-semibold tracking-[-0.01em] text-ink">
            {meta.nome}
          </h2>
          {meta.larId && <Etiqueta tom="primario">da casa</Etiqueta>}
        </div>
        <BotaoIcone
          icone={Pencil}
          rotulo={`Editar meta ${meta.nome}`}
          tamanho={32}
          className="-mt-1 -mr-2"
          onClick={() => abrir({ tipo: "meta", meta })}
        />
      </div>

      <Valor centavos={saldo} className="mt-4 text-[34px] leading-none" />
      {meta.alvo > 0 ? (
        <>
          <p className="tabular mt-2 mb-2 text-[13px]/5 text-ink-3">
            {porcento(fracao)} de {formatar(meta.alvo)}
            {saldo < meta.alvo && <> · faltam {formatar(meta.alvo - saldo)}</>}
          </p>
          <Progresso fracao={fracao} cor={cor} rotulo={`${porcento(fracao)} da meta`} altura={10} />
        </>
      ) : (
        <p className="mt-2 text-[13px]/5 text-ink-3">Sem valor alvo definido.</p>
      )}

      <div className="mt-6 flex gap-2">
        <Botao variante="primario" onClick={() => abrir({ tipo: "aporte", metaId: meta.id })}>
          <Plus size={16} />
          Guardar
        </Botao>
        <Botao
          disabled={saldo <= 0}
          onClick={() => abrir({ tipo: "aporte", metaId: meta.id, retirada: true })}
        >
          <Minus size={16} />
          Retirar
        </Botao>
      </div>

      <p className="mt-6 text-xs font-semibold text-ink">Movimentações</p>
      {movimentos.length === 0 ? (
        <p className="mt-2 text-[13px]/5 text-ink-3">Nada guardado ainda.</p>
      ) : (
        <ul className="mt-1">
          {visiveis.map((a) => (
            <li
              key={a.id}
              className="group flex items-center gap-4 border-b border-line py-2 text-sm last:border-0"
            >
              <span
                className={cx(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-full",
                  a.valor >= 0 ? "bg-good-soft text-good-text" : "bg-surface-2 text-ink-3",
                )}
              >
                {a.valor >= 0 ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ink">
                  {a.descricao || (a.valor >= 0 ? "Guardado" : "Retirada")}
                </span>
                <span className="block text-xs text-ink-3">{dataBR(a.data)}</span>
              </span>
              <span className="tabular font-semibold whitespace-nowrap text-ink">
                {formatar(a.valor, { sinal: true })}
              </span>
              <BotaoIcone
                icone={X}
                rotulo="Excluir movimentação"
                tamanho={24}
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-lg:opacity-100"
                onClick={async () => {
                  await remover("aportes", a.id);
                  avisar("Movimentação excluída.");
                }}
              />
            </li>
          ))}
        </ul>
      )}
      {movimentos.length > 5 && (
        <button
          type="button"
          onClick={() => setTudo((v) => !v)}
          className="alvo-toque mt-2 self-start text-xs font-medium text-primary-text hover:underline"
        >
          {tudo ? "Mostrar menos" : `Ver todas as ${movimentos.length}`}
        </button>
      )}
    </Painel>
  );
}

export default function PaginaReserva() {
  const { dados, mes } = useApp();
  const { abrir } = useModais();
  const metas = dados.metas;
  const total = metas.reduce((s, m) => s + saldoDaMeta(m, dados), 0);
  const noMes = dados.aportes
    .filter((a) => a.data.slice(0, 7) === mes)
    .reduce((s, a) => s + a.valor, 0);
  const minhas = metas.filter((m) => !m.larId);
  const daCasa = metas.filter((m) => m.larId);

  return (
    <div className="space-y-4 sm:space-y-6">
      <CabecalhoPagina titulo="Reserva" texto="O que você guarda, sozinho ou junto com a casa.">
        <Botao variante="primario" onClick={() => abrir({ tipo: "meta" })}>
          <Plus size={16} />
          Nova meta
        </Botao>
      </CabecalhoPagina>

      {metas.length === 0 ? (
        <Painel>
          <Vazio
            icone={PiggyBank}
            titulo="Nenhuma meta ainda"
            texto="Crie uma meta, como reserva de emergência ou uma viagem, e registre cada valor guardado. Metas da casa aparecem para todos os moradores."
          >
            <Botao variante="primario" onClick={() => abrir({ tipo: "meta" })}>
              <Plus size={16} />
              Criar meta
            </Botao>
          </Vazio>
        </Painel>
      ) : (
        <>
          <Painel className="flex items-center justify-between gap-4 p-4 sm:p-6">
            <div>
              <p className="text-[13px]/5 text-ink-3">Guardado até agora</p>
              <Valor centavos={total} className="mt-1 text-[40px] leading-none sm:text-[48px]" />
              <p className="tabular mt-2 text-[13px]/5 text-ink-3">
                em {nomeMes(mes).toLowerCase()}:{" "}
                <span className="font-medium text-ink-2">{formatar(noMes, { sinal: true })}</span>
                {minhas.length > 0 && daCasa.length > 0 && (
                  <>
                    {" "}
                    · {minhas.length} {minhas.length === 1 ? "meta sua" : "metas suas"} e{" "}
                    {daCasa.length} da casa
                  </>
                )}
              </p>
            </div>
            <Emblema icone={PiggyBank} tom="rosa" tamanho={80} />
          </Painel>

          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2 lg:items-start ultra:grid-cols-3">
            {metas.map((m) => (
              <CartaoMeta key={m.id} meta={m} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
