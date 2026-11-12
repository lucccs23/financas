"use client";

import { useMemo, useState } from "react";
import { Banknote, Plus, Receipt } from "lucide-react";
import { useApp } from "@/lib/app";
import { itensDoMes, type ItemMes } from "@/lib/calc";
import { categoria } from "@/lib/categorias";
import { formatar } from "@/lib/dinheiro";
import { anoDe, mesCurto, nomeMes } from "@/lib/meses";
import type { Conta } from "@/lib/types";
import { useModais } from "@/components/modais-contexto";
import { RecorrentesProximos } from "@/components/recorrentes";
import {
  Botao,
  CabecalhoPagina,
  cx,
  Etiqueta,
  Ladrilho,
  Marcador,
  Painel,
  Segmentado,
  Valor,
  Vazio,
} from "@/components/ui";

type Filtro = "todas" | "minhas" | "casa";

function Indicador({ rotulo, valor, detalhe }: { rotulo: string; valor: number; detalhe?: string }) {
  return (
    <Painel className="p-6">
      <p className="text-[13px]/5 text-ink-3">{rotulo}</p>
      <Valor centavos={valor} className="mt-2 text-[28px] leading-none" />
      {detalhe && <p className="mt-2 text-xs text-ink-3">{detalhe}</p>}
    </Painel>
  );
}

function repeticao(c: Conta): string {
  const dia = `dia ${String(c.diaVencimento).padStart(2, "0")}`;
  const quando = (m: string) => `${mesCurto(m).toLowerCase()}/${anoDe(m)}`;
  if (!c.recorrente) return `só em ${quando(c.mesInicio)}, ${dia}`;
  return `todo mês, ${dia} · desde ${quando(c.mesInicio)}${c.mesFim ? ` até ${quando(c.mesFim)}` : ""}`;
}

export default function PaginaContas() {
  const { dados, mes, lar, marcarPago, atualizar, avisar } = useApp();
  const [verEncerradas, setVerEncerradas] = useState(false);
  const { abrir } = useModais();
  const [aba, setAba] = useState<"mes" | "cadastro">("mes");
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const itens = useMemo(() => itensDoMes(dados, mes), [dados, mes]);
  const cabe = (escopo: "casa" | "pessoal") =>
    filtro === "todas" || (filtro === "casa" ? escopo === "casa" : escopo === "pessoal");

  const despesas = itens.filter((i) => i.natureza === "despesa" && cabe(i.escopo));
  const rendas = itens.filter((i) => i.natureza === "receita" && filtro !== "casa");
  const total = despesas.reduce((s, i) => s + i.valor, 0);
  const pago = despesas.filter((i) => i.pago).reduce((s, i) => s + i.valor, 0);
  const pagas = despesas.filter((i) => i.pago).length;

  // Contas tiradas só deste mês ("Não vale neste mês"), para poder desfazer.
  const puladas = dados.lancamentos
    .filter((l) => l.refTipo === "conta" && l.mes === mes && l.pulado)
    .map((l) => ({ lancamento: l, conta: dados.contas.find((c) => c.id === l.refId) }))
    .filter((p): p is { lancamento: typeof p.lancamento; conta: Conta } => !!p.conta)
    .filter((p) => cabe(p.conta.larId ? "casa" : "pessoal"));

  // Contas que já acabaram antes do mês aberto ficam separadas no cadastro.
  const encerrada = (c: Conta) => (c.recorrente ? c.mesFim !== null && c.mesFim < mes : c.mesInicio < mes);
  const todasDoFiltro = dados.contas.filter((c) => cabe(c.larId ? "casa" : "pessoal"));
  const encerradas = todasDoFiltro.filter(encerrada);
  const cadastro = todasDoFiltro.filter((c) => !encerrada(c));
  const grupos = [
    { titulo: "Contas minhas", contas: cadastro.filter((c) => !c.larId && c.natureza === "despesa") },
    { titulo: "Contas da casa", contas: cadastro.filter((c) => !!c.larId) },
    { titulo: "Rendas", contas: cadastro.filter((c) => c.natureza === "receita") },
  ].filter((g) => g.contas.length);

  const linhaItem = (i: ItemMes) => {
    const pagador = dados.moradores.find((m) => m.id === i.pagadorId);
    return (
      <li key={i.chave} className="flex items-center gap-4 border-b border-line py-4 last:border-0">
        <Marcador
          marcado={i.pago}
          rotulo={`${i.pago ? "Desmarcar" : "Marcar"} ${i.nome}`}
          onMudar={(v) => marcarPago(i, mes, v)}
        />
        <button
          type="button"
          onClick={() => abrir({ tipo: "ocorrencia", item: i, mes })}
          className="-my-1 flex min-w-0 flex-1 items-center gap-4 rounded-lg py-1 text-left"
        >
          <Ladrilho
            icone={categoria(i.categoria).icone}
            className={cx("max-sm:hidden", i.pago && "!bg-surface-2 !text-ink-3")}
          />
          <span className="min-w-0 flex-1">
            <span
              className={cx(
                "block truncate text-sm font-medium",
                i.pago ? "text-ink-3 line-through decoration-line-strong" : "text-ink",
              )}
            >
              {i.nome}
            </span>
            <span className="block truncate text-xs text-ink-3">
              dia {String(i.dia).padStart(2, "0")}
              {i.escopo === "casa" && ` · ${pagador ? `${pagador.nome} paga` : "sem pagador"}`}
              {i.estimada && " · valor estimado"}
            </span>
          </span>
          {i.escopo === "casa" && <Etiqueta tom="primario">casa</Etiqueta>}
          <span
            className={cx(
              "tabular w-[104px] text-right text-sm font-semibold whitespace-nowrap",
              i.pago ? "text-ink-3" : "text-ink",
            )}
          >
            {i.estimada && <span className="mr-1 font-normal text-ink-3">≈</span>}
            {formatar(i.valor)}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <CabecalhoPagina
        titulo="Contas"
        texto={`O que vence em ${nomeMes(mes).toLowerCase()} e o cadastro das contas fixas.`}
      >
        <Botao onClick={() => abrir({ tipo: "conta", natureza: "receita" })}>
          <Banknote size={16} />
          Nova renda
        </Botao>
        <Botao
          variante="primario"
          onClick={() => abrir({ tipo: "conta", escopo: filtro === "casa" ? "casa" : "pessoal" })}
        >
          <Plus size={16} />
          Nova conta
        </Botao>
      </CabecalhoPagina>

      <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
        <Indicador rotulo={`Despesas de ${nomeMes(mes).toLowerCase()}`} valor={total} />
        <Indicador
          rotulo="Já pago"
          valor={pago}
          detalhe={`${pagas} de ${despesas.length} contas`}
        />
        <Indicador rotulo="Falta pagar" valor={total - pago} />
      </div>

      <RecorrentesProximos />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Segmentado
          rotulo="Visão"
          valor={aba}
          onMudar={setAba}
          opcoes={[
            { valor: "mes", rotulo: `Em ${nomeMes(mes).toLowerCase()}` },
            { valor: "cadastro", rotulo: "Cadastro" },
          ]}
        />
        {lar && (
          <Segmentado
            rotulo="Filtro"
            valor={filtro}
            onMudar={setFiltro}
            opcoes={[
              { valor: "todas", rotulo: "Todas" },
              { valor: "minhas", rotulo: "Minhas" },
              { valor: "casa", rotulo: "Da casa" },
            ]}
          />
        )}
      </div>

      {aba === "mes" ? (
        despesas.length + rendas.length === 0 ? (
          <Painel>
            <Vazio
              icone={Receipt}
              titulo="Nada para este mês"
              texto="Cadastre uma conta fixa e ela aparece em todos os meses, ou uma conta única só para este."
            >
              <Botao variante="primario" onClick={() => abrir({ tipo: "conta" })}>
                <Plus size={16} />
                Nova conta
              </Botao>
            </Vazio>
          </Painel>
        ) : (
          <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
            <Painel className="px-4 py-4 sm:px-6">
              <p className="pt-2 pb-1 text-xs font-semibold text-ink">Despesas</p>
              {despesas.length ? (
                <ul>{despesas.map(linhaItem)}</ul>
              ) : (
                <p className="py-4 text-[13px]/5 text-ink-3">Nenhuma despesa neste filtro.</p>
              )}
              {puladas.length > 0 && (
                <div className="mt-1 border-t border-line pt-4 pb-2">
                  <p className="text-xs font-semibold text-ink">
                    Fora de {nomeMes(mes).toLowerCase()}
                  </p>
                  <ul>
                    {puladas.map(({ lancamento, conta }) => (
                      <li key={lancamento.id} className="flex items-center gap-4 py-2">
                        <span className="min-w-0 flex-1 truncate text-sm text-ink-3 line-through decoration-line-strong">
                          {conta.nome}
                        </span>
                        <Botao
                          tamanho="sm"
                          variante="fantasma"
                          onClick={async () => {
                            await atualizar("lancamentos", lancamento.id, { pulado: false });
                            avisar(`"${conta.nome}" voltou a contar em ${nomeMes(mes).toLowerCase()}.`);
                          }}
                        >
                          Voltar a contar
                        </Botao>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Painel>
            <Painel className="px-4 py-4 sm:px-6">
              <p className="pt-2 pb-1 text-xs font-semibold text-ink">Rendas além do salário</p>
              {rendas.length ? (
                <ul>{rendas.map(linhaItem)}</ul>
              ) : (
                <p className="py-4 text-[13px] leading-5 text-ink-3">
                  Nenhuma renda extra neste mês. O salário fica em Minha renda.
                </p>
              )}
            </Painel>
          </div>
        )
      ) : grupos.length === 0 && encerradas.length === 0 ? (
        <Painel>
          <Vazio icone={Receipt} titulo="Nenhuma conta cadastrada" />
        </Painel>
      ) : (
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2 lg:items-start">
          {grupos.map((g) => (
            <Painel key={g.titulo} className="px-4 py-4 sm:px-6">
              <p className="pt-2 pb-1 text-xs font-semibold text-ink">{g.titulo}</p>
              <ul>
                {g.contas.map((c) => (
                  <li key={c.id} className="border-b border-line last:border-0">
                    <button
                      type="button"
                      onClick={() => abrir({ tipo: "conta", conta: c })}
                      className="flex w-full items-center gap-4 py-4 text-left"
                    >
                      <Ladrilho icone={categoria(c.categoria).icone} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{c.nome}</span>
                        <span className="block truncate text-xs text-ink-3">{repeticao(c)}</span>
                      </span>
                      <span className="tabular text-sm font-semibold whitespace-nowrap text-ink">
                        {c.estimada && <span className="mr-1 font-normal text-ink-3">≈</span>}
                        {formatar(c.valor)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Painel>
          ))}
          {encerradas.length > 0 && (
            <Painel className="px-4 py-4 sm:px-6 lg:col-span-2">
              <button
                type="button"
                onClick={() => setVerEncerradas((v) => !v)}
                aria-expanded={verEncerradas}
                className="flex w-full items-center justify-between gap-4 py-2 text-left"
              >
                <span className="text-xs font-semibold text-ink">
                  Encerradas antes de {nomeMes(mes).toLowerCase()}
                  <span className="font-normal text-ink-3"> · {encerradas.length}</span>
                </span>
                <span className="text-xs font-medium text-primary-text">
                  {verEncerradas ? "Esconder" : "Mostrar"}
                </span>
              </button>
              {verEncerradas && (
                <ul className="pb-1">
                  {encerradas.map((c) => (
                    <li key={c.id} className="border-t border-line">
                      <button
                        type="button"
                        onClick={() => abrir({ tipo: "conta", conta: c })}
                        className="flex w-full items-center gap-4 py-4 text-left opacity-70 transition-opacity hover:opacity-100"
                      >
                        <Ladrilho icone={categoria(c.categoria).icone} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{c.nome}</span>
                          <span className="block truncate text-xs text-ink-3">{repeticao(c)}</span>
                        </span>
                        <span className="tabular text-sm font-semibold whitespace-nowrap text-ink-2">
                          {formatar(c.valor)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Painel>
          )}
        </div>
      )}
    </div>
  );
}
