"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Download,
  FileUp,
  Plus,
  Receipt,
  Search,
  X,
} from "lucide-react";
import { useApp, usePerfil } from "@/lib/app";
import { agruparPorDia } from "@/lib/calc-extra";
import { categoria } from "@/lib/categorias";
import { formatar, porcento } from "@/lib/dinheiro";
import { addMes, dataBR, dataISO, mesEixo, nomeMes } from "@/lib/meses";
import type { Transacao } from "@/lib/types";
import { useModais } from "@/components/modais-contexto";
import {
  Botao,
  CabecalhoPagina,
  cx,
  Ladrilho,
  Painel,
  Segmentado,
  Selecao,
  Vazio,
} from "@/components/ui";

type Filtro = "todas" | "saida" | "entrada" | "transferencia";

/** "Hoje", "Ontem" ou "Seg, 09 nov". */
function rotuloDia(iso: string, hoje: string): string {
  if (iso === hoje) return "Hoje";
  const ontem = dataISO(new Date(new Date(`${hoje}T12:00:00`).getTime() - 86_400_000));
  if (iso === ontem) return "Ontem";
  const d = new Date(`${iso}T12:00:00`);
  const semana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][d.getDay()];
  return `${semana}, ${dataBR(iso).slice(0, 5)}`;
}

function sinal(t: Transacao) {
  return t.tipo === "entrada" ? 1 : t.tipo === "saida" ? -1 : 0;
}

export default function PaginaTransacoes() {
  const { dados, mes, setMes, hoje } = useApp();
  const perfil = usePerfil();
  const { abrir } = useModais();

  // Atalho "Nova transação" do ícone do app (…/transacoes/?nova=1): já abre o formulário.
  useEffect(() => {
    const busca = new URLSearchParams(window.location.search);
    if (!busca.has("nova")) return;
    busca.delete("nova");
    const resto = busca.toString();
    window.history.replaceState(null, "", window.location.pathname + (resto ? `?${resto}` : ""));
    abrir({ tipo: "transacao" });
  }, [abrir]);
  const [aba, setAba] = useState<"extrato" | "categoria">("extrato");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [cat, setCat] = useState("");
  const [carteiraId, setCarteiraId] = useState("");

  const minhas = useMemo(
    () => dados.transacoes.filter((t) => t.perfilId === perfil.id),
    [dados.transacoes, perfil.id],
  );
  const doMes = minhas.filter((t) => t.data.slice(0, 7) === mes);
  const termo = busca.trim().toLowerCase();
  const filtradas = doMes.filter(
    (t) =>
      (filtro === "todas" || t.tipo === filtro) &&
      (!cat || t.categoria === cat) &&
      (!carteiraId || t.carteiraId === carteiraId || t.carteiraDestinoId === carteiraId) &&
      (!termo ||
        t.descricao.toLowerCase().includes(termo) ||
        t.observacao.toLowerCase().includes(termo) ||
        categoria(t.categoria).nome.toLowerCase().includes(termo)),
  );

  // "Só saldo" (fatura paga, dinheiro entre contas suas...) aparece no extrato, mas
  // não soma como gasto nem como entrada.
  const entradas = filtradas
    .filter((t) => t.tipo === "entrada" && !t.soSaldo)
    .reduce((s, t) => s + t.valor, 0);
  const saidas = filtradas
    .filter((t) => t.tipo === "saida" && !t.soSaldo)
    .reduce((s, t) => s + t.valor, 0);
  const meses = Array.from({ length: 7 }, (_, i) => addMes(mes, i - 5));
  const saidasDo = (m: string) =>
    minhas
      .filter((t) => t.tipo === "saida" && !t.soSaldo && t.data.slice(0, 7) === m)
      .reduce((s, t) => s + t.valor, 0);
  const maiorMes = Math.max(1, ...meses.map(saidasDo));
  const categoriasUsadas = [...new Set(doMes.map((t) => t.categoria))];
  const carteiraNome = (id: string | null) => dados.carteiras.find((c) => c.id === id)?.nome;
  const temFiltro = filtro !== "todas" || !!cat || !!carteiraId || !!termo;

  const mapaCategorias = new Map<string, number>();
  for (const t of filtradas) {
    if (t.tipo === "saida" && !t.soSaldo)
      mapaCategorias.set(t.categoria, (mapaCategorias.get(t.categoria) ?? 0) + t.valor);
  }
  const porCategoria = [...mapaCategorias]
    .map(([c, v]) => ({ categoria: c, valor: v }))
    .sort((a, b) => b.valor - a.valor);

  const exportar = () => {
    const aspas = (x: string) => `"${x.replace(/"/g, '""')}"`;
    const linhas = [
      ["Data", "Descrição", "Categoria", "Tipo", "Valor", "Carteira", "Anotação"].join(";"),
      ...[...filtradas]
        .sort((a, b) => a.data.localeCompare(b.data))
        .map((t) =>
          [
            dataBR(t.data),
            aspas(t.descricao),
            aspas(categoria(t.categoria).nome),
            t.tipo === "saida" ? "Saída" : t.tipo === "entrada" ? "Entrada" : "Transferência",
            (((sinal(t) || 1) * t.valor) / 100).toFixed(2).replace(".", ","),
            aspas(carteiraNome(t.carteiraId) ?? ""),
            aspas(t.observacao),
          ].join(";"),
        ),
    ].join("\r\n");
    // BOM para o Excel abrir os acentos certos.
    const url = URL.createObjectURL(new Blob(["﻿" + linhas], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `transacoes-${mes}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <CabecalhoPagina
        titulo="Transações"
        texto="Gastos e entradas do dia a dia, fora das contas fixas e do cartão."
      >
        <Botao onClick={() => abrir({ tipo: "importarExtrato" })}>
          <FileUp size={16} />
          Importar extrato
        </Botao>
        <Botao variante="primario" onClick={() => abrir({ tipo: "transacao" })}>
          <Plus size={16} />
          Nova transação
        </Botao>
      </CabecalhoPagina>

      {/* Meses: barra com o total de saídas de cada um */}
      <div
        role="radiogroup"
        aria-label="Mês"
        className="sem-rolagem -mx-1 flex gap-2 overflow-x-auto px-1 py-1"
      >
        {meses.map((m) => {
          const ativo = m === mes;
          const v = saidasDo(m);
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => setMes(m)}
              className={cx(
                "flex min-w-[96px] flex-1 flex-col items-center gap-2 rounded-2xl border px-4 py-2 transition-colors",
                ativo
                  ? "border-primary bg-primary-soft/70"
                  : "border-line bg-surface hover:bg-surface-2",
              )}
            >
              <span className={cx("text-xs", ativo ? "font-semibold text-ink" : "text-ink-3")}>
                {mesEixo(m)}
              </span>
              <span aria-hidden className="flex h-8 w-full items-end justify-center">
                <span
                  className="w-6 rounded-t-[4px]"
                  style={{
                    height: `${Math.max(v > 0 ? 10 : 4, (v / maiorMes) * 100)}%`,
                    background:
                      v > 0
                        ? ativo
                          ? "var(--seg-pessoal)"
                          : "var(--seg-dia)"
                        : "var(--line-strong)",
                  }}
                />
              </span>
              <span className="tabular text-xs font-semibold text-ink">
                {formatar(v, { semCentavos: true })}
              </span>
            </button>
          );
        })}
      </div>

      <Painel className="p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[200px] flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3"
            />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar transações"
              aria-label="Buscar transações"
              className="h-10 w-full rounded-lg border border-line bg-surface pr-4 pl-10 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-primary focus:ring-4 focus:ring-primary/15"
            />
          </label>
          <Segmentado
            rotulo="Tipo"
            valor={filtro}
            onMudar={setFiltro}
            opcoes={[
              { valor: "todas", rotulo: "Todas" },
              { valor: "saida", rotulo: "Saídas" },
              { valor: "entrada", rotulo: "Entradas" },
              { valor: "transferencia", rotulo: "Transf." },
            ]}
          />
          <div className="w-42">
            <Selecao
              aria-label="Categoria"
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              className="!h-10"
            >
              <option value="">Todas as categorias</option>
              {categoriasUsadas.map((c) => (
                <option key={c} value={c}>
                  {categoria(c).nome}
                </option>
              ))}
            </Selecao>
          </div>
          {dados.carteiras.length > 0 && (
            <div className="w-42">
              <Selecao
                aria-label="Carteira"
                value={carteiraId}
                onChange={(e) => setCarteiraId(e.target.value)}
                className="!h-10"
              >
                <option value="">Todas as carteiras</option>
                {dados.carteiras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Selecao>
            </div>
          )}
          {temFiltro && (
            <Botao
              tamanho="sm"
              variante="fantasma"
              onClick={() => {
                setBusca("");
                setFiltro("todas");
                setCat("");
                setCarteiraId("");
              }}
            >
              <X size={16} />
              Limpar
            </Botao>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
          <Segmentado
            rotulo="Visão"
            valor={aba}
            onMudar={setAba}
            opcoes={[
              { valor: "extrato", rotulo: "Extrato" },
              { valor: "categoria", rotulo: "Por categoria" },
            ]}
          />
          <div className="tabular flex flex-wrap items-center gap-x-6 gap-y-1 text-[13px]/5">
            <span className="text-ink-3">{filtradas.length} lançamentos</span>
            <span className="flex items-center gap-1 text-good-text">
              <ArrowDownLeft size={16} /> {formatar(entradas)}
            </span>
            <span className="flex items-center gap-1 text-ink-2">
              <ArrowUpRight size={16} /> {formatar(saidas)}
            </span>
            <span className="font-semibold text-ink">
              saldo {formatar(entradas - saidas, { sinal: true })}
            </span>
            <Botao
              tamanho="sm"
              variante="fantasma"
              onClick={exportar}
              disabled={!filtradas.length}
              title="Baixar estas transações em CSV"
            >
              <Download size={16} />
              Exportar
            </Botao>
          </div>
        </div>

        {filtradas.length === 0 ? (
          <Vazio
            icone={Receipt}
            titulo={
              temFiltro
                ? "Nada com esses filtros"
                : `Nenhuma transação em ${nomeMes(mes).toLowerCase()}`
            }
            texto={
              temFiltro
                ? "Tente limpar a busca ou os filtros."
                : "Lance os gastos do dia a dia para ver quanto ainda pode gastar no mês, ou importe o extrato do banco."
            }
          >
            {!temFiltro && (
              <Botao variante="primario" onClick={() => abrir({ tipo: "transacao" })}>
                <Plus size={16} />
                Nova transação
              </Botao>
            )}
          </Vazio>
        ) : aba === "extrato" ? (
          <div className="mt-2">
            {agruparPorDia(filtradas).map((g) => (
              <section key={g.data} className="mt-4">
                <h3 className="text-[11px]/4 font-semibold tracking-[0.08em] text-ink-3 uppercase">
                  {rotuloDia(g.data, hoje)}
                </h3>
                <ul>
                  {g.itens.map((t) => {
                    const c = categoria(t.categoria);
                    return (
                      <li key={t.id} className="border-b border-line last:border-0">
                        <button
                          type="button"
                          onClick={() => abrir({ tipo: "transacao", transacao: t })}
                          className="flex w-full items-center gap-4 py-2 text-left"
                        >
                          <Ladrilho
                            icone={t.tipo === "transferencia" ? ArrowLeftRight : c.icone}
                            tamanho={32}
                            className={
                              t.tipo === "entrada" ? "!bg-good-soft !text-good-text" : undefined
                            }
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-ink">
                              {t.descricao}
                            </span>
                            <span className="block truncate text-xs text-ink-3">
                              {t.tipo === "transferencia"
                                ? `${carteiraNome(t.carteiraId) ?? "?"} → ${carteiraNome(t.carteiraDestinoId) ?? "?"}`
                                : [c.nome, carteiraNome(t.carteiraId), t.soSaldo && "só saldo"]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </span>
                          </span>
                          <span
                            className={cx(
                              "tabular text-sm font-semibold whitespace-nowrap",
                              t.tipo === "transferencia" || t.soSaldo
                                ? "text-ink-3"
                                : t.tipo === "entrada"
                                  ? "text-good-text"
                                  : "text-ink",
                            )}
                          >
                            {t.tipo === "entrada" ? "+ " : t.tipo === "saida" ? "− " : ""}
                            {formatar(t.valor)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        ) : porCategoria.length === 0 ? (
          <p className="py-8 text-center text-[13px]/5 text-ink-3">
            Nenhuma saída com esses filtros.
          </p>
        ) : (
          <ul className="mt-4 grid gap-x-10 gap-y-1 lg:grid-cols-2 ultra:grid-cols-3">
            {porCategoria.map((g) => {
              const c = categoria(g.categoria);
              return (
                <li key={g.categoria}>
                  <button
                    type="button"
                    onClick={() => {
                      setCat(g.categoria);
                      setAba("extrato");
                    }}
                    className="flex w-full items-center gap-4 rounded-lg py-2 text-left"
                  >
                    <Ladrilho icone={c.icone} tamanho={32} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-4">
                        <span className="truncate text-sm font-medium text-ink">{c.nome}</span>
                        <span className="tabular text-sm font-semibold text-ink">
                          {formatar(g.valor)}
                        </span>
                      </span>
                      <span className="mt-2 block h-2 overflow-hidden rounded-full bg-surface-3">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${(g.valor / porCategoria[0].valor) * 100}%`,
                            background: "var(--seg-pessoal)",
                          }}
                        />
                      </span>
                      <span className="tabular mt-1 block text-[11px]/4 text-ink-3">
                        {porcento(g.valor / saidas)} das saídas
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Painel>
    </div>
  );
}
