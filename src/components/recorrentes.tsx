"use client";

// Painéis de compromissos que se repetem: contas fixas e parcelas nos
// próximos meses, e como a fatura de um cartão é formada.

import { useMemo } from "react";
import { useApp, usePerfil } from "@/lib/app";
import { composicaoFatura, recorrentesPorMes } from "@/lib/calc-extra";
import { formatar, porcento } from "@/lib/dinheiro";
import { intervalo, mesEixo, nomeMes } from "@/lib/meses";
import type { Cartao } from "@/lib/types";
import { BarraFina, Colunas } from "./graficos";
import { Painel, Ponto, TituloPainel } from "./ui";

export function RecorrentesProximos() {
  const { dados, mes, setMes } = useApp();
  const perfil = usePerfil();
  const pontos = useMemo(() => recorrentesPorMes(dados, perfil.id, intervalo(mes, 6)), [dados, perfil.id, mes]);
  const atual = pontos[0];
  const totalAtual = atual.contasFixas + atual.parcelas;
  const ultimo = pontos[pontos.length - 1];
  const liberado = totalAtual - (ultimo.contasFixas + ultimo.parcelas);

  return (
    <Painel className="p-4 sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">
          <TituloPainel>Compromissos dos próximos 6 meses</TituloPainel>
          <p className="mt-1 mb-4 text-[13px]/5 text-ink-3">
            O que já está garantido de sair: suas contas fixas (com a sua parte da casa) e as parcelas e assinaturas dos seus cartões.
          </p>
          <Colunas
            rotulo="Contas fixas e parcelas nos próximos 6 meses"
            altura={180}
            selecionado={mes}
            onEscolher={setMes}
            series={[
              { id: "fixas", rotulo: "Contas fixas", cor: "var(--seg-pessoal)" },
              { id: "parcelas", rotulo: "Parcelas e assinaturas", cor: "var(--s2)" },
            ]}
            grupos={pontos.map((p) => ({
              chave: p.mes,
              rotulo: mesEixo(p.mes),
              valores: [p.contasFixas, p.parcelas],
              extra: [{ rotulo: "Total", valor: formatar(p.contasFixas + p.parcelas) }],
            }))}
          />
        </div>
        <div className="rounded-2xl bg-surface-2 p-4">
          <p className="text-xs font-semibold text-ink">{nomeMes(mes)}</p>
          <ul className="mt-4 space-y-2 text-[13px]/5">
            <li className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-ink-2">
                <Ponto cor="var(--seg-pessoal)" /> Contas fixas
              </span>
              <span className="tabular font-semibold text-ink">{formatar(atual.contasFixas)}</span>
            </li>
            <li className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-ink-2">
                <Ponto cor="var(--s2)" /> Parcelas e assinaturas
              </span>
              <span className="tabular font-semibold text-ink">{formatar(atual.parcelas)}</span>
            </li>
            <li className="flex items-center justify-between gap-4 border-t border-line pt-2">
              <span className="font-medium text-ink">Total</span>
              <span className="tabular font-semibold text-ink">{formatar(totalAtual)}</span>
            </li>
          </ul>
          {liberado > 0 && (
            <p className="mt-4 text-xs leading-5 text-ink-3">
              Daqui a 6 meses, <strong className="font-semibold text-good-text">{formatar(liberado)}</strong> por mês
              deixam de sair, conforme parcelas e contas terminam.
            </p>
          )}
        </div>
      </div>
    </Painel>
  );
}

export function ComposicaoFatura({ cartao }: { cartao: Cartao }) {
  const { dados, mes } = useApp();
  const c = useMemo(() => composicaoFatura(cartao, dados.compras, mes), [cartao, dados.compras, mes]);
  if (c.total === 0) return null;
  // As porcentagens são sobre as compras (antes dos estornos), para somarem 100%.
  const bruto = c.parcelas + c.assinaturas + c.avulsas || 1;
  const partes = [
    { id: "parcelas", rotulo: "Parcelas", valor: c.parcelas, cor: "var(--s2)" },
    { id: "assinaturas", rotulo: "Assinaturas", valor: c.assinaturas, cor: "var(--s7)" },
    { id: "avulsas", rotulo: "Compras à vista", valor: c.avulsas, cor: "var(--seg-pessoal)" },
  ];
  return (
    <div className="mt-6 grid gap-6 rounded-2xl border border-line p-4 @xl:grid-cols-2">
      <div>
        <p className="text-xs font-semibold text-ink">Como a fatura é formada</p>
        <ul className="tabular mt-4 space-y-2 text-[13px]/5">
          <li className="flex justify-between gap-4 text-ink-2">
            <span>+ Compras deste ciclo</span>
            <span className="font-medium text-ink">{formatar(c.novas)}</span>
          </li>
          <li className="flex justify-between gap-4 text-ink-2">
            <span>+ Parcelas de meses anteriores</span>
            <span className="font-medium text-ink">{formatar(c.herdadas)}</span>
          </li>
          <li className="flex justify-between gap-4 text-ink-2">
            <span>+ Assinaturas</span>
            <span className="font-medium text-ink">{formatar(c.assinaturas)}</span>
          </li>
          {c.estornos < 0 && (
            <li className="flex justify-between gap-4 text-ink-2">
              <span>− Estornos e créditos</span>
              <span className="font-medium text-good-text">{formatar(-c.estornos)}</span>
            </li>
          )}
          <li className="flex justify-between gap-4 border-t border-line pt-2 font-semibold text-ink">
            <span>Total da fatura</span>
            <span>{formatar(c.total)}</span>
          </li>
        </ul>
      </div>
      <div>
        <p className="text-xs font-semibold text-ink">Composição</p>
        <div className="mt-4">
          <BarraFina rotulo="Composição da fatura" partes={partes} />
        </div>
        <ul className="mt-4 space-y-2 text-[13px]/5">
          {partes.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-ink-2">
                <Ponto cor={p.cor} /> {p.rotulo}
              </span>
              <span className="tabular text-ink">
                <span className="mr-2 text-xs text-ink-3">{porcento(p.valor / bruto)}</span>
                <strong className="font-semibold">{formatar(p.valor)}</strong>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
