"use client";

import { useMemo, useState } from "react";
import { categoria } from "@/lib/categorias";
import { CircleCheck, CreditCard, FileUp, Pencil, Plus, Repeat, ShoppingBag } from "lucide-react";
import { useApp, usePerfil } from "@/lib/app";
import {
  comprasDaFatura,
  faturaDoMes,
  itensDoMes,
  limiteDoCartao,
  parcelaDaCompra,
  semSufixoDeParcela,
} from "@/lib/calc";
import { formatar, porcento } from "@/lib/dinheiro";
import { addMes, dataBR, intervalo, mesEixo, nomeMes } from "@/lib/meses";
import type { Id, Mes } from "@/lib/types";
import { CartaoVisual } from "@/components/cartao-visual";
import { Carrossel } from "@/components/carrossel";
import { Colunas, Progresso } from "@/components/graficos";
import { useModais } from "@/components/modais-contexto";
import { useInfoCartao } from "@/components/visao-casa";
import { ComposicaoFatura } from "@/components/recorrentes";
import {
  Botao,
  BotaoIcone,
  CabecalhoPagina,
  cx,
  Etiqueta,
  Ladrilho,
  Painel,
  TituloPainel,
  Valor,
  Vazio,
} from "@/components/ui";

export default function PaginaCartoes() {
  const { dados, mes: mesGlobal, mesFatura, mesHoje, marcarPago } = useApp();
  // Fatura mostrada: a em aberto (no mês de hoje) ou a do mês escolhido no topo;
  // clicar num mês do gráfico escolhe só aqui dentro.
  const [escolha, setEscolha] = useState<{ base: Mes; mes: Mes } | null>(null);
  const mes = escolha && escolha.base === mesGlobal ? escolha.mes : mesFatura;
  const perfil = usePerfil();
  const { abrir } = useModais();
  const info = useInfoCartao();
  const [escolhido, setEscolhido] = useState<Id | null>(null);

  const cartoes = useMemo(
    () =>
      [...dados.cartoes].sort(
        (a, b) => Number(b.perfilId === perfil.id) - Number(a.perfilId === perfil.id),
      ),
    [dados.cartoes, perfil.id],
  );
  const cartao = cartoes.find((c) => c.id === escolhido) ?? cartoes[0];
  const temMeu = cartoes.some((c) => c.perfilId === perfil.id);

  if (!cartao) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <CabecalhoPagina titulo="Cartões" texto="Faturas, parcelas e limite." />
        <Painel>
          <Vazio
            icone={CreditCard}
            titulo="Nenhum cartão cadastrado"
            texto="Cadastre um cartão com o dia de fechamento e de vencimento. Depois é só lançar as compras: o app monta as faturas e as parcelas dos próximos meses."
          >
            <Botao variante="primario" onClick={() => abrir({ tipo: "cartao" })}>
              <Plus size={16} />
              Novo cartão
            </Botao>
          </Vazio>
        </Painel>
      </div>
    );
  }

  const meu = cartao.perfilId === perfil.id;
  const dono = dados.moradores.find((m) => m.perfilId === cartao.perfilId);
  const atual = info(cartao, mes);
  const linhas = comprasDaFatura(cartao.id, dados.compras, mes);
  const lim = limiteDoCartao(cartao, dados, mesHoje);
  const itemFatura = itensDoMes(dados, mes).find((i) => i.chave === `fatura:${cartao.id}`);
  // Começa no mês do topo, para dar para abrir também a fatura dele (já paga).
  const meses = intervalo(mesGlobal < mes ? mesGlobal : mes, 6);
  const mesMin = nomeMes(mes).toLowerCase();

  return (
    <div className="space-y-4 sm:space-y-6">
      <CabecalhoPagina titulo="Cartões" texto="Faturas, parcelas e limite.">
        <Botao onClick={() => abrir({ tipo: "cartao" })}>
          <Plus size={16} />
          Novo cartão
        </Botao>
        {temMeu && (
          <Botao onClick={() => abrir({ tipo: "importar", cartaoId: meu ? cartao.id : undefined })}>
            <FileUp size={16} />
            Importar fatura
          </Botao>
        )}
        {temMeu && (
          <Botao
            variante="primario"
            onClick={() => abrir({ tipo: "compra", cartaoId: meu ? cartao.id : undefined })}
          >
            <ShoppingBag size={16} />
            Nova compra
          </Botao>
        )}
      </CabecalhoPagina>

      <Carrossel
        rotulo="Cartão"
        role="radiogroup"
        className="-mx-4 gap-4 px-4 py-2 sm:-mx-6 sm:px-6"
      >
        {cartoes.map((c) => {
          const i = info(c, mes);
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={c.id === cartao.id}
              aria-label={`Cartão ${c.nome}`}
              onClick={(e) => {
                setEscolhido(c.id);
                e.currentTarget.scrollIntoView({
                  behavior: "smooth",
                  inline: "nearest",
                  block: "nearest",
                });
              }}
              className={cx(
                "w-76 max-w-[82vw] shrink-0 snap-start scroll-mx-6 rounded-2xl text-left transition-[opacity,transform] duration-200",
                c.id !== cartao.id && "scale-[0.97] opacity-60 hover:opacity-90",
              )}
            >
              <CartaoVisual
                cartao={c}
                situacao={i.situacao}
                vence={i.vence}
                limiteLivre={i.limiteLivre}
                selecionado={c.id === cartao.id && cartoes.length > 1}
              />
            </button>
          );
        })}
      </Carrossel>

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start ultra:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Painel className="p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <TituloPainel
                  detalhe={
                    cartao.banco && !cartao.nome.toLowerCase().includes(cartao.banco.toLowerCase())
                      ? cartao.banco
                      : undefined
                  }
                >
                  {cartao.nome}
                </TituloPainel>
                {cartao.larId && <Etiqueta tom="primario">cartão da casa</Etiqueta>}
                {!meu && <Etiqueta>de {dono?.nome ?? "outro morador"}</Etiqueta>}
              </div>
              <p className="mt-4 text-[13px]/5 text-ink-3">Fatura de {mesMin}</p>
              <Valor centavos={atual.fatura} className="mt-1 text-[40px] leading-none" />
              <p className="mt-2 text-[13px]/5 text-ink-3">
                fecha dia {String(cartao.diaFechamento).padStart(2, "0")} · vence {atual.vence}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {itemFatura &&
                (atual.paga ? (
                  <Botao onClick={() => marcarPago(itemFatura, mes, false)}>
                    <CircleCheck size={16} className="text-good" />
                    Paga
                  </Botao>
                ) : (
                  <Botao variante="primario" onClick={() => marcarPago(itemFatura, mes, true)}>
                    Marcar como paga
                  </Botao>
                ))}
              {meu && (
                <BotaoIcone
                  icone={Pencil}
                  rotulo="Editar cartão"
                  className="border border-line"
                  onClick={() => abrir({ tipo: "cartao", cartao })}
                />
              )}
            </div>
          </div>

          {cartao.limite > 0 && (
            <div className="mt-6 rounded-2xl bg-surface-2 p-4">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { rotulo: "Limite total", valor: lim.total, forte: false },
                  { rotulo: "Disponível", valor: lim.livre, forte: true },
                  { rotulo: "Em uso", valor: lim.usado, forte: false },
                ].map((x) => (
                  <div key={x.rotulo} className="min-w-0">
                    <p className="text-xs text-ink-3">{x.rotulo}</p>
                    <p
                      className={cx(
                        "tabular mt-1 truncate text-[15px]/6 font-semibold",
                        x.forte ? (lim.livre < 0 ? "text-bad-text" : "text-ink") : "text-ink-2",
                      )}
                    >
                      {formatar(x.valor)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Progresso
                  fracao={lim.fracao ?? 0}
                  cor={(lim.fracao ?? 0) > 0.8 ? "var(--warn)" : "var(--seg-pessoal)"}
                  rotulo={`Limite em uso: ${porcento(lim.fracao ?? 0)}`}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-3">
                <span className="min-w-0 flex-1">
                  {cartao.externoId
                    ? `Vem do banco pelo Open Finance${cartao.limiteConferidoEm ? `, atualizado em ${dataBR(cartao.limiteConferidoEm)}` : ""}.`
                    : cartao.limiteConferidoEm
                      ? `Conferido com o banco em ${dataBR(cartao.limiteConferidoEm)}. Compras lançadas e faturas pagas atualizam o disponível.`
                      : "Calculado pelas parcelas e faturas ainda não pagas. Confira com o app do banco para ficar exato."}
                </span>
                {meu && !cartao.externoId && (
                  <Botao
                    tamanho="sm"
                    variante="fantasma"
                    onClick={() => abrir({ tipo: "cartao", cartao, foco: "limite" })}
                  >
                    Conferir limite
                  </Botao>
                )}
              </div>
            </div>
          )}

          <ComposicaoFatura cartao={cartao} mes={mes} />

          <p className="mt-6 text-xs font-semibold text-ink">
            Lançamentos de {mesMin}
            <span className="font-normal text-ink-3"> · {linhas.length}</span>
          </p>
          {linhas.length === 0 ? (
            <p className="mt-2 text-[13px]/5 text-ink-3">Nada nesta fatura.</p>
          ) : (
            <ul className="mt-1">
              {linhas.map(({ compra, valor }) => {
                const parcela = parcelaDaCompra(compra, mes);
                const corpo = (
                  <>
                    <Ladrilho
                      icone={
                        compra.recorrente ? Repeat : categoria(compra.categoria ?? "outros").icone
                      }
                      className="max-sm:hidden"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {semSufixoDeParcela(compra.descricao)}
                      </span>
                      <span className="block truncate text-xs text-ink-3">
                        {dataBR(compra.data)}
                        {valor < 0
                          ? " · estorno"
                          : compra.recorrente
                            ? " · assinatura"
                            : parcela && !parcela.doBanco
                              ? ` · total ${formatar(compra.valor)}`
                              : ""}
                      </span>
                    </span>
                    {parcela && (
                      <Etiqueta>
                        {parcela.numero}/{parcela.total}
                      </Etiqueta>
                    )}
                    <span
                      className={cx(
                        "tabular w-26 text-right text-sm font-semibold whitespace-nowrap",
                        valor < 0 ? "text-good-text" : "text-ink",
                      )}
                    >
                      {valor < 0 ? `− ${formatar(-valor)}` : formatar(valor)}
                    </span>
                  </>
                );
                return (
                  <li key={compra.id} className="border-b border-line last:border-0">
                    {meu ? (
                      <button
                        type="button"
                        onClick={() => abrir({ tipo: "compra", compra })}
                        className="flex w-full items-center gap-4 py-4 text-left"
                      >
                        {corpo}
                      </button>
                    ) : (
                      <div className="flex items-center gap-4 py-4">{corpo}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Painel>

        <Painel className="p-4 sm:p-6">
          <TituloPainel>Próximas faturas</TituloPainel>
          <p className="mt-1 mb-6 text-[13px]/5 text-ink-3">
            {cartao.nome}, de {mesMin} em diante. Clique em um mês para abrir.
          </p>
          <Colunas
            rotulo={`Faturas do cartão ${cartao.nome} nos próximos seis meses`}
            altura={190}
            selecionado={mes}
            onEscolher={(m) => setEscolha({ base: mesGlobal, mes: m })}
            series={[{ id: "fatura", rotulo: "Fatura", cor: "var(--seg-pessoal)" }]}
            grupos={meses.map((m) => ({
              chave: m,
              rotulo: mesEixo(m),
              valores: [faturaDoMes(cartao.id, dados.compras, m)],
            }))}
          />
          <table className="mt-6 w-full text-[13px]/5">
            <caption className="sr-only">Faturas previstas por mês</caption>
            <tbody>
              {meses.map((m) => {
                const i = info(cartao, m);
                return (
                  <tr key={m} className="border-t border-line">
                    <td className="py-2 text-ink-2">
                      {nomeMes(m)}
                      {m === mes && <span className="text-ink-3"> · aberto aqui</span>}
                    </td>
                    <td className="py-2 text-right">
                      {i.paga && <Etiqueta tom="bom">paga</Etiqueta>}
                    </td>
                    <td className="tabular w-28 py-2 text-right font-semibold text-ink">
                      {formatar(i.fatura)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-ink-3">
            Depois de {nomeMes(addMes(mes, 5)).toLowerCase()}, avance o mês no topo da tela.
          </p>
        </Painel>
      </div>
    </div>
  );
}
