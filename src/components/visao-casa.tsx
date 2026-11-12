"use client";

// Cartões da Visão geral que olham para o conjunto:
// divisão da casa, cartões de crédito e reserva.

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CreditCard,
  House,
  KeyRound,
  PiggyBank,
  Plus,
  Scale,
} from "lucide-react";
import { useApp, usePerfil } from "@/lib/app";
import {
  chaveLancamento,
  faturaDoMes,
  indexarLancamentos,
  limiteDoCartao,
  resumoCasa,
  saldoDaMeta,
  type ResumoCasa,
  type Transferencia,
} from "@/lib/calc";
import { novoId } from "@/lib/dados/backend";
import { formatar, mascara, porcento } from "@/lib/dinheiro";
import { addMes, diaMes, mesCurtoAno, nomeMes } from "@/lib/meses";
import type { Cartao, Id, Mes, Morador } from "@/lib/types";
import { useArrastarRolagem } from "./arrastar";
import { CartaoVisual } from "./cartao-visual";
import { BarraAlta, Progresso } from "./graficos";
import { Ilustracao } from "./ilustracao";
import { useModais } from "./modais-contexto";
import {
  Avatar,
  Botao,
  BotaoIcone,
  classesBotao,
  corPessoa,
  cx,
  Etiqueta,
  Painel,
  Ponto,
  tintaPessoa,
  TituloPainel,
  Valor,
  Vazio,
} from "./ui";

/* ───────────────────────── Peças da divisão (usadas também na tela Casa) ───────────────────────── */

export function EtiquetaSaldo({ saldo }: { saldo: number }) {
  if (saldo > 0) return <Etiqueta tom="bom">recebe {formatar(saldo)}</Etiqueta>;
  if (saldo < 0) return <Etiqueta tom="alerta">deve {formatar(-saldo)}</Etiqueta>;
  return <Etiqueta>quite</Etiqueta>;
}

export function BarraQuemPaga({
  resumo,
  moradores,
}: {
  resumo: ResumoCasa;
  moradores: Morador[];
}) {
  return (
    <BarraAlta
      rotulo="Quem paga as contas da casa"
      partes={moradores.map((m) => ({
        id: m.id,
        rotulo: m.nome,
        valor: resumo.porMorador[m.id]?.pagou ?? 0,
        cor: corPessoa(m.cor),
        tinta: tintaPessoa(m.cor),
      }))}
    />
  );
}

export function LinhaTransferencia({
  t,
  moradores,
  euId,
  onFeito,
}: {
  t: Transferencia;
  moradores: Morador[];
  euId: Id | null;
  onFeito: () => void;
}) {
  const de = moradores.find((m) => m.id === t.deId);
  const para = moradores.find((m) => m.id === t.paraId);
  if (!de || !para) return null;
  const valor = (
    <strong className="tabular font-semibold whitespace-nowrap text-ink">{formatar(t.valor)}</strong>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
      <span className="flex shrink-0 items-center gap-1">
        <Avatar nome={de.nome} cor={de.cor} tamanho={24} />
        <ArrowRight size={12} className="text-ink-3" />
        <Avatar nome={para.nome} cor={para.cor} tamanho={24} />
      </span>
      <p className="min-w-40 flex-1 text-[13px] leading-5 text-ink-2">
        {t.deId === euId ? (
          <>
            Você devolve {valor} para {para.nome}
          </>
        ) : t.paraId === euId ? (
          <>
            {de.nome} te devolve {valor}
          </>
        ) : (
          <>
            {de.nome} devolve {valor} para {para.nome}
          </>
        )}
        <span className="text-ink-3"> no Pix</span>
      </p>
      <Botao tamanho="sm" onClick={onFeito} className="ml-auto">
        Marcar feito
      </Botao>
    </div>
  );
}

/** Registra um Pix de acerto como feito. */
export function useAcertar() {
  const { lar, mes, hoje, inserir, avisar } = useApp();
  return async (t: Transferencia) => {
    if (!lar) return;
    await inserir("acertos", {
      id: novoId(),
      larId: lar.id,
      mes,
      deId: t.deId,
      paraId: t.paraId,
      valor: t.valor,
      feitoEm: hoje,
    });
    avisar("Acerto registrado.");
  };
}

/* ───────────────────────── Divisão da casa ───────────────────────── */

export function DivisaoCasa() {
  const { dados, mes, lar, eu } = useApp();
  const { abrir } = useModais();
  const acertar = useAcertar();
  const resumo = useMemo(() => resumoCasa(dados, mes), [dados, mes]);

  if (!lar || !resumo) {
    return (
      <Painel className="flex h-full flex-col p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <TituloPainel>Divisão da casa</TituloPainel>
          <Ilustracao painel="casa" icone={Scale} tom="violeta" tamanho={56} />
        </div>
        <div className="grid flex-1 place-items-center">
          <Vazio
            compacto
            icone={House}
            titulo="Você ainda não tem uma casa"
            texto="Crie uma casa para dividir as contas com quem mora com você, ou entre em uma que já existe."
          >
            <Botao tamanho="sm" variante="primario" onClick={() => abrir({ tipo: "lar", aba: "criar" })}>
              <Plus size={16} />
              Criar casa
            </Botao>
            <Botao tamanho="sm" onClick={() => abrir({ tipo: "lar", aba: "entrar" })}>
              <KeyRound size={16} />
              Tenho um código
            </Botao>
          </Vazio>
        </div>
      </Painel>
    );
  }

  const moradores = dados.moradores;
  const pendentes = [...resumo.pendentes].sort(
    (a, b) =>
      Number(b.deId === eu?.id || b.paraId === eu?.id) -
      Number(a.deId === eu?.id || a.paraId === eu?.id),
  );
  const maiores = [...resumo.linhas].sort((a, b) => b.item.valor - a.item.valor).slice(0, 5);

  return (
    <Painel className="flex h-full flex-col">
      <div className="p-4 pb-4 sm:p-6 sm:pb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <TituloPainel>Divisão da casa</TituloPainel>
            <p className="mt-4 text-[13px]/5 text-ink-3">Total das contas</p>
            <Valor centavos={resumo.total} className="mt-1 text-[34px] leading-none" />
          </div>
          <Ilustracao painel="casa" icone={Scale} tom="violeta" tamanho={64} />
        </div>

        {resumo.total === 0 ? (
          <Vazio
            compacto
            icone={House}
            titulo="Nenhuma conta da casa neste mês"
            texto="Cadastre aluguel, luz, mercado e o que mais vocês dividem."
          >
            <Botao tamanho="sm" variante="primario" onClick={() => abrir({ tipo: "conta", escopo: "casa" })}>
              <Plus size={16} />
              Conta da casa
            </Botao>
          </Vazio>
        ) : (
          <>
            <p className="mt-6 mb-2 text-xs font-semibold text-ink">Quem tira do bolso</p>
            <BarraQuemPaga resumo={resumo} moradores={moradores} />

            <ul className="mt-4">
              {moradores.map((m) => {
                const s = resumo.porMorador[m.id];
                return (
                  <li key={m.id} className="border-b border-line py-2 last:border-0">
                    <div className="flex items-center gap-2">
                      <Avatar nome={m.nome} cor={m.cor} tamanho={24} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                        {m.nome}
                        {m.id === eu?.id && <span className="font-normal text-ink-3"> (você)</span>}
                      </span>
                      <EtiquetaSaldo saldo={s.saldo} />
                    </div>
                    <p className="tabular mt-1 pl-10 text-xs text-ink-3">
                      paga {formatar(s.pagou)} · parte {formatar(s.parte)}
                    </p>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6 mb-1 flex items-center justify-between">
              <p className="text-xs font-semibold text-ink">Maiores contas</p>
              <Link
                href="/casa"
                className="text-xs font-medium text-primary-text hover:underline"
              >
                Ver todas
              </Link>
            </div>
            <ul>
              {maiores.map(({ item }) => {
                const pagador = moradores.find((m) => m.id === item.pagadorId);
                return (
                  <li
                    key={item.chave}
                    className="flex items-center gap-2 border-b border-line py-2 text-sm last:border-0"
                  >
                    <Ponto cor={pagador ? corPessoa(pagador.cor) : "var(--line-strong)"} />
                    <span className="min-w-0 flex-1 truncate text-ink">
                      {item.nome}
                      <span className="text-ink-3"> · {pagador?.nome ?? "sem pagador"}</span>
                    </span>
                    <span className="tabular font-semibold text-ink">
                      {item.estimada && <span className="mr-1 font-normal text-ink-3">≈</span>}
                      {formatar(item.valor)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {resumo.total > 0 && (
        <div className="mt-auto space-y-4 border-t border-line px-4 py-4 sm:px-6">
          {pendentes.length === 0 ? (
            <p className="flex items-center gap-2 text-[13px]/5 font-medium text-ink-2">
              <CircleCheck size={16} className="text-good" />
              Casa acertada em {nomeMes(mes).toLowerCase()}.
            </p>
          ) : (
            <>
              {pendentes.slice(0, 2).map((t) => (
                <LinhaTransferencia
                  key={t.deId + t.paraId}
                  t={t}
                  moradores={moradores}
                  euId={eu?.id ?? null}
                  onFeito={() => acertar(t)}
                />
              ))}
              {pendentes.length > 2 && (
                <Link
                  href="/casa"
                  className="block text-xs font-medium text-primary-text hover:underline"
                >
                  Mais {pendentes.length - 2} {pendentes.length - 2 === 1 ? "acerto" : "acertos"} na
                  tela Casa
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </Painel>
  );
}

/* ───────────────────────── Cartões ───────────────────────── */

/** Situação de um cartão em um mês, pronta para o desenho. */
export function useInfoCartao() {
  const { dados, mesHoje } = useApp();
  const lancs = useMemo(() => indexarLancamentos(dados.lancamentos), [dados.lancamentos]);
  return (cartao: Cartao, mes: Mes) => {
    const fatura = faturaDoMes(cartao.id, dados.compras, mes);
    const paga = !!lancs.get(chaveLancamento("fatura", cartao.id, mes))?.pago;
    return {
      fatura,
      paga,
      situacao: (fatura <= 0 ? "Sem fatura" : paga ? "Paga" : "Aberta") as
        | "Sem fatura"
        | "Paga"
        | "Aberta",
      vence: diaMes(cartao.diaVencimento, mes),
      limiteLivre: cartao.limite > 0 ? limiteDoCartao(cartao, dados, mesHoje).livre : null,
    };
  };
}

export function CartoesResumo() {
  const { dados, mes } = useApp();
  const perfil = usePerfil();
  const { abrir } = useModais();
  const info = useInfoCartao();
  const trilho = useArrastarRolagem<HTMLDivElement>();

  const cartoes = useMemo(
    () =>
      [...dados.cartoes].sort(
        (a, b) => Number(b.perfilId === perfil.id) - Number(a.perfilId === perfil.id),
      ),
    [dados.cartoes, perfil.id],
  );
  const meus = cartoes.filter((c) => c.perfilId === perfil.id);
  const totalDo = (m: Mes) =>
    meus.reduce((s, c) => s + faturaDoMes(c.id, dados.compras, m), 0);
  const proximos = [0, 1, 2].map((n) => {
    const m = addMes(mes, n);
    return { mes: m, valor: totalDo(m) };
  });
  const maior = Math.max(1, ...proximos.map((p) => p.valor));
  const rolar = (sentido: 1 | -1) =>
    trilho.current?.scrollBy({ left: sentido * 280, behavior: "smooth" });

  return (
    <Painel className="flex h-full flex-col p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <TituloPainel>Cartões</TituloPainel>
          <p className="mt-4 text-[13px]/5 text-ink-3">Fatura de {nomeMes(mes).toLowerCase()}</p>
          <Valor centavos={proximos[0].valor} className="mt-1 text-[34px] leading-none" />
        </div>
        <Ilustracao painel="cartoes" icone={CreditCard} tom="azul" tamanho={64} />
      </div>

      {cartoes.length === 0 ? (
        <div className="grid flex-1 place-items-center">
          <Vazio
            compacto
            icone={CreditCard}
            titulo="Nenhum cartão cadastrado"
            texto="Cadastre um cartão para lançar compras e acompanhar as próximas faturas."
          >
            <Botao tamanho="sm" variante="primario" onClick={() => abrir({ tipo: "cartao" })}>
              <Plus size={16} />
              Novo cartão
            </Botao>
          </Vazio>
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between">
            <Link href="/cartoes" className={classesBotao("secundario", "sm")}>
              Ver fatura
            </Link>
            {cartoes.length > 1 && (
              <div className="flex gap-1">
                <BotaoIcone
                  icone={ChevronLeft}
                  rotulo="Cartão anterior"
                  tamanho={32}
                  className="border border-line"
                  onClick={() => rolar(-1)}
                />
                <BotaoIcone
                  icone={ChevronRight}
                  rotulo="Próximo cartão"
                  tamanho={32}
                  className="border border-line"
                  onClick={() => rolar(1)}
                />
              </div>
            )}
          </div>

          <div
            ref={trilho}
            className="sem-rolagem -mx-4 mt-4 flex cursor-grab snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6"
          >
            {cartoes.map((c) => {
              const i = info(c, mes);
              return (
                <Link
                  key={c.id}
                  href="/cartoes"
                  aria-label={`Cartão ${c.nome}`}
                  className={cx(
                    "shrink-0 snap-start rounded-2xl",
                    cartoes.length === 1 ? "w-full" : "w-[86%] max-w-[320px]",
                  )}
                >
                  <CartaoVisual
                    cartao={c}
                    situacao={i.situacao}
                    vence={i.vence}
                    limiteLivre={i.limiteLivre}
                  />
                </Link>
              );
            })}
          </div>

          {meus.length === 0 && (
            <div className="mt-2 rounded-2xl bg-surface-2 p-4">
              <p className="text-[13px] leading-5 text-ink-2">
                Você vê aqui os cartões da casa. Cadastre um cartão seu para acompanhar as suas
                faturas.
              </p>
              <Botao tamanho="sm" className="mt-4" onClick={() => abrir({ tipo: "cartao" })}>
                <Plus size={16} />
                Novo cartão
              </Botao>
            </div>
          )}
          <p
            className={cx(
              "mt-auto mb-2 pt-2 text-[11px]/4 font-semibold tracking-[0.08em] text-ink-3 uppercase",
              meus.length === 0 && "hidden",
            )}
          >
            Próximas faturas
          </p>
          <ul
            className={cx(
              "grid h-36 grid-cols-3 gap-2",
              meus.length === 0 && "hidden",
            )}
          >
            {proximos.map((p, i) => (
              <li
                key={p.mes}
                title={`${nomeMes(p.mes)}: ${formatar(p.valor)}`}
                className={cx(
                  "flex flex-col rounded-2xl border px-2 py-4",
                  i === 0 ? "border-primary bg-primary-soft/60" : "border-line bg-surface-2",
                )}
              >
                <p className="text-center text-xs font-semibold text-ink">
                  {mesCurtoAno(p.mes, mes)}
                </p>
                <div
                  aria-hidden
                  className="mx-auto mt-2 flex min-h-10 w-full flex-1 items-end justify-center border-b border-axis"
                >
                  <span
                    className="w-6 rounded-t-[4px] transition-[height] duration-300"
                    style={{
                      height: `${Math.max(p.valor > 0 ? 6 : 0, (p.valor / maior) * 100)}%`,
                      background: i === 0 ? "var(--seg-pessoal)" : "var(--seg-dia)",
                    }}
                  />
                </div>
                <p className="tabular mt-2 text-center text-xs font-semibold whitespace-nowrap text-ink @sm:text-[13px]/5">
                  <span className="mr-1 text-[10px]/4 font-medium text-ink-3">R$</span>
                  {/* Em painel estreito, sem centavos para caber. */}
                  <span className="@sm:hidden">{mascara(p.valor).replace(/,d{2}$/, "")}</span>
                  <span className="hidden @sm:inline">{mascara(p.valor)}</span>
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Painel>
  );
}

/* ───────────────────────── Reserva ───────────────────────── */

export function ReservaResumo() {
  const { dados } = useApp();
  const { abrir } = useModais();
  const metas = dados.metas;
  const total = metas.reduce((s, m) => s + saldoDaMeta(m, dados), 0);

  return (
    <Painel className="p-4 sm:p-6">
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <TituloPainel>Reserva</TituloPainel>
            <p className="mt-4 text-[13px]/5 text-ink-3">Guardado até agora</p>
            <Valor centavos={total} className="mt-1 text-[34px] leading-none" />
          </div>
          <Ilustracao painel="reserva" icone={PiggyBank} tom="rosa" tamanho={64} />
        </div>

        {metas.length === 0 ? (
          <div className="flex-1">
            <Vazio
              compacto
              icone={PiggyBank}
              titulo="Nenhuma meta ainda"
              texto="Crie uma meta para acompanhar o que você guarda, sozinho ou com a casa."
            >
              <Botao tamanho="sm" variante="primario" onClick={() => abrir({ tipo: "meta" })}>
                <Plus size={16} />
                Criar meta
              </Botao>
            </Vazio>
          </div>
        ) : (
          <ul className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2">
            {metas.slice(0, 4).map((m) => {
              const saldo = saldoDaMeta(m, dados);
              const fracao = m.alvo > 0 ? saldo / m.alvo : 0;
              return (
                <li key={m.id} className="rounded-2xl border border-line bg-surface-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
                      <Ponto cor={corPessoa(m.cor)} />
                      <span className="truncate">{m.nome}</span>
                    </p>
                    {m.larId && <Etiqueta tom="primario">casa</Etiqueta>}
                  </div>
                  <p className="tabular mt-4 text-[13px]/5 text-ink-2">
                    <strong className="font-semibold text-ink">{formatar(saldo)}</strong>
                    {m.alvo > 0 && (
                      <>
                        {" "}
                        de {formatar(m.alvo)} · {porcento(fracao)}
                      </>
                    )}
                  </p>
                  {m.alvo > 0 && (
                    <div className="mt-2">
                      <Progresso
                        fracao={fracao}
                        cor={corPessoa(m.cor)}
                        rotulo={`${m.nome}: ${porcento(fracao)} da meta`}
                      />
                    </div>
                  )}
                  <div className="mt-4 flex gap-2">
                    <Botao tamanho="sm" onClick={() => abrir({ tipo: "aporte", metaId: m.id })}>
                      <Plus size={16} />
                      Guardar
                    </Botao>
                    <Link href="/reserva" className={classesBotao("fantasma", "sm")}>
                      Histórico
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Painel>
  );
}
