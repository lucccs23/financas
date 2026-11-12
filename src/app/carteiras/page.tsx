"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, CreditCard, Landmark, PiggyBank, Plus, Wallet } from "lucide-react";
import { useApp, usePerfil } from "@/lib/app";
import { patrimonio, saldoCarteira } from "@/lib/calc-extra";
import { tipoCarteira } from "@/lib/carteiras";
import { formatar } from "@/lib/dinheiro";
import { addMes, dataBR, diasNoMes, mesEixo } from "@/lib/meses";
import { Colunas } from "@/components/graficos";
import { Ilustracao } from "@/components/ilustracao";
import { PainelOpenFinance } from "@/components/open-finance";
import { useModais } from "@/components/modais-contexto";
import {
  Botao,
  CabecalhoPagina,
  corPessoa,
  cx,
  Painel,
  TituloPainel,
  Valor,
  Vazio,
} from "@/components/ui";

export default function PaginaCarteiras() {
  const { dados, mesHoje } = useApp();
  const perfil = usePerfil();
  const { abrir } = useModais();
  const [verArquivadas, setVerArquivadas] = useState(false);

  const minhas = dados.carteiras.filter((c) => c.perfilId === perfil.id);
  const ativas = minhas.filter((c) => !c.arquivada);
  const arquivadas = minhas.filter((c) => c.arquivada);
  const p = useMemo(() => patrimonio(dados, perfil.id, mesHoje), [dados, perfil.id, mesHoje]);

  const ultimo = (id: string) =>
    dados.transacoes
      .filter((t) => t.carteiraId === id || t.carteiraDestinoId === id)
      .map((t) => t.data)
      .sort()
      .at(-1);

  // Saldo das carteiras no fim de cada um dos últimos 6 meses.
  const evolucao = Array.from({ length: 6 }, (_, i) => addMes(mesHoje, i - 5)).map((m) => {
    const fim = `${m}-${String(diasNoMes(m)).padStart(2, "0")}`;
    return {
      chave: m,
      rotulo: mesEixo(m),
      valores: [ativas.reduce((s, c) => s + saldoCarteira(c, dados.transacoes, fim), 0)],
    };
  });

  const linha = (c: (typeof minhas)[number]) => {
    const tipo = tipoCarteira(c.tipo);
    const saldo = saldoCarteira(c, dados.transacoes);
    const data = ultimo(c.id);
    return (
      <li key={c.id} className="border-b border-line last:border-0">
        <button
          type="button"
          onClick={() => abrir({ tipo: "carteira", carteira: c })}
          className={cx("flex w-full items-center gap-4 py-4 text-left", c.arquivada && "opacity-60")}
        >
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white"
            style={{ background: corPessoa(c.cor) }}
          >
            <tipo.icone size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{c.nome}</span>
            <span className="block truncate text-xs text-ink-3">
              {tipo.nome}
              {data ? ` · última movimentação ${dataBR(data)}` : " · sem movimentação"}
            </span>
          </span>
          <span className={cx("tabular text-[15px]/6 font-semibold whitespace-nowrap", saldo < 0 ? "text-bad-text" : "text-ink")}>
            {formatar(saldo)}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <CabecalhoPagina titulo="Carteiras" texto="Onde o seu dinheiro está e quanto você tem de fato.">
        {ativas.length >= 2 && (
          <Botao onClick={() => abrir({ tipo: "transacao", tipoTransacao: "transferencia" })}>
            <ArrowLeftRight size={16} />
            Transferir
          </Botao>
        )}
        <Botao variante="primario" onClick={() => abrir({ tipo: "carteira" })}>
          <Plus size={16} />
          Nova carteira
        </Botao>
      </CabecalhoPagina>

      <PainelOpenFinance />

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
        <div className="grid min-w-0 gap-4 sm:gap-6">
          <Painel className="p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <TituloPainel>Patrimônio</TituloPainel>
                <p className="mt-4 text-[13px]/5 text-ink-3">O que você tem, menos o que ainda deve no cartão</p>
                <Valor centavos={p.total} className={cx("mt-1 text-[40px] leading-none", p.total < 0 && "!text-bad-text")} />
              </div>
              <Ilustracao painel="reserva" icone={Landmark} tom="verde" tamanho={72} />
            </div>
            <ul className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                { rotulo: "Nas carteiras", valor: p.carteiras, icone: Wallet, sinal: "" },
                { rotulo: "Guardado na reserva", valor: p.reserva, icone: PiggyBank, sinal: "+ " },
                { rotulo: "A pagar nos cartões", valor: p.dividaCartoes, icone: CreditCard, sinal: "− " },
              ].map((x) => (
                <li key={x.rotulo} className="rounded-2xl bg-surface-2 p-4">
                  <p className="flex items-center gap-2 text-xs text-ink-3">
                    <x.icone size={16} />
                    {x.rotulo}
                  </p>
                  <p className="tabular mt-2 text-[17px]/6 font-semibold text-ink">
                    {x.sinal}
                    {formatar(x.valor)}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-5 text-ink-3">
              &quot;A pagar nos cartões&quot; soma as parcelas e faturas ainda não pagas, deste mês em diante.
            </p>
          </Painel>

          <Painel className="px-4 py-4 sm:px-6">
            <div className="flex items-baseline justify-between gap-4 pt-2">
              <TituloPainel>Saldo nas carteiras</TituloPainel>
              <span className="tabular text-sm font-semibold text-ink">{formatar(p.carteiras)}</span>
            </div>
            {ativas.length === 0 ? (
              <Vazio
                icone={Wallet}
                titulo="Nenhuma carteira ainda"
                texto="Cadastre a conta do banco, a poupança e o dinheiro em espécie com o saldo de hoje. As transações que você lançar atualizam os saldos."
              >
                <Botao variante="primario" onClick={() => abrir({ tipo: "carteira" })}>
                  <Plus size={16} />
                  Nova carteira
                </Botao>
              </Vazio>
            ) : (
              <ul className="mt-1">{ativas.map(linha)}</ul>
            )}
            {arquivadas.length > 0 && (
              <div className="border-t border-line py-2">
                <button
                  type="button"
                  onClick={() => setVerArquivadas((v) => !v)}
                  className="text-xs font-medium text-primary-text hover:underline"
                >
                  {verArquivadas ? "Esconder" : "Mostrar"} arquivadas ({arquivadas.length})
                </button>
                {verArquivadas && <ul className="mt-1">{arquivadas.map(linha)}</ul>}
              </div>
            )}
          </Painel>
        </div>

        <Painel className="p-4 sm:p-6">
          <TituloPainel>Evolução do saldo</TituloPainel>
          <p className="mt-1 mb-6 text-[13px]/5 text-ink-3">Saldo das carteiras no fim de cada mês.</p>
          {ativas.length === 0 ? (
            <p className="text-[13px]/5 text-ink-3">Aparece quando houver carteiras.</p>
          ) : (
            <Colunas
              rotulo="Saldo das carteiras no fim de cada mês"
              altura={200}
              selecionado={mesHoje}
              series={[{ id: "saldo", rotulo: "Saldo", cor: "var(--seg-sobra)", corNegativa: "var(--bad)" }]}
              grupos={evolucao}
            />
          )}
        </Painel>
      </div>
    </div>
  );
}
