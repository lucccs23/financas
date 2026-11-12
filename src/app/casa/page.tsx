"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  CircleCheck,
  Copy,
  House,
  KeyRound,
  LogOut,
  Pencil,
  Plus,
  Scale,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import { useApp } from "@/lib/app";
import { resumoCasa } from "@/lib/calc";
import { formatar } from "@/lib/dinheiro";
import { dataBR, nomeMes } from "@/lib/meses";
import { useModais } from "@/components/modais-contexto";
import {
  BarraQuemPaga,
  EtiquetaSaldo,
  LinhaTransferencia,
  useAcertar,
} from "@/components/visao-casa";
import {
  Avatar,
  Botao,
  BotaoIcone,
  CabecalhoPagina,
  cx,
  Emblema,
  Entrada,
  Etiqueta,
  Marcador,
  Painel,
  TituloPainel,
  Valor,
  Vazio,
} from "@/components/ui";

export default function PaginaCasa() {
  const { dados, mes, lar, eu, backend, atualizar, remover, marcarPago, recarregar, avisar } =
    useApp();
  const { abrir } = useModais();
  const acertar = useAcertar();
  const resumo = useMemo(() => resumoCasa(dados, mes), [dados, mes]);
  const [renomeando, setRenomeando] = useState(false);
  const [nomeLar, setNomeLar] = useState("");
  const [copiado, setCopiado] = useState(false);

  if (!lar || !resumo) {
    return (
      <Painel>
        <Vazio
          icone={House}
          titulo="Você ainda não tem uma casa"
          texto="A casa junta as contas que você divide com quem mora com você. Quem cria recebe um código para convidar os outros; quem tem um código entra por ele."
        >
          <Botao variante="primario" onClick={() => abrir({ tipo: "lar", aba: "criar" })}>
            <Plus size={16} />
            Criar casa
          </Botao>
          <Botao onClick={() => abrir({ tipo: "lar", aba: "entrar" })}>
            <KeyRound size={16} />
            Tenho um código
          </Botao>
        </Vazio>
      </Painel>
    );
  }

  const moradores = dados.moradores;
  const mesMin = nomeMes(mes).toLowerCase();

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(lar.codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      avisar("Não foi possível copiar. Anote o código.", "erro");
    }
  };

  const salvarNome = async () => {
    if (nomeLar.trim()) await atualizar("lares", lar.id, { nome: nomeLar.trim() });
    setRenomeando(false);
  };

  const sairDaCasa = () =>
    abrir({
      tipo: "confirmar",
      titulo: `Sair de "${lar.nome}"?`,
      texto:
        "Você deixa de ver as contas da casa. Seu nome continua na divisão como morador sem conta, e os outros podem tirá-lo depois.",
      rotulo: "Sair da casa",
      acao: async () => {
        try {
          await backend.sairDoLar();
          await recarregar();
          avisar("Você saiu da casa.");
        } catch (e) {
          avisar(e instanceof Error ? e.message : "Não foi possível sair.", "erro");
        }
      },
    });

  return (
    <div className="space-y-4 sm:space-y-6">
      <CabecalhoPagina titulo={lar.nome} texto={`Divisão das contas de ${mesMin}.`}>
        <Botao onClick={() => abrir({ tipo: "morador" })}>
          <UserPlus size={16} />
          Morador
        </Botao>
        <Botao variante="primario" onClick={() => abrir({ tipo: "conta", escopo: "casa" })}>
          <Plus size={16} />
          Conta da casa
        </Botao>
      </CabecalhoPagina>

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start ultra:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-4 sm:gap-6">
          {/* Resumo */}
          <Painel className="p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <TituloPainel>Resumo de {mesMin}</TituloPainel>
                <p className="mt-4 text-[13px]/5 text-ink-3">Total das contas da casa</p>
                <Valor centavos={resumo.total} className="mt-1 text-[40px] leading-none" />
              </div>
              <Emblema icone={Scale} tom="violeta" tamanho={72} />
            </div>

            {resumo.total > 0 && (
              <>
                <p className="mt-6 mb-2 text-xs font-semibold text-ink">Quem tira do bolso</p>
                <BarraQuemPaga resumo={resumo} moradores={moradores} />
              </>
            )}

            <div className="-mx-4 mt-6 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-3">
                    <th className="pb-2 font-medium">Morador</th>
                    <th className="pb-2 text-right font-medium">Paga do bolso</th>
                    <th className="pb-2 text-right font-medium">Parte justa</th>
                    <th className="pb-2 text-right font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {moradores.map((m) => {
                    const s = resumo.porMorador[m.id];
                    return (
                      <tr key={m.id} className="border-t border-line">
                        <td className="py-4">
                          <span className="flex items-center gap-2">
                            <Avatar nome={m.nome} cor={m.cor} tamanho={32} />
                            <span className="font-medium text-ink">
                              {m.nome}
                              {m.id === eu?.id && (
                                <span className="font-normal text-ink-3"> (você)</span>
                              )}
                            </span>
                          </span>
                        </td>
                        <td className="tabular py-4 text-right text-ink-2">{formatar(s.pagou)}</td>
                        <td className="tabular py-4 text-right text-ink-2">{formatar(s.parte)}</td>
                        <td className="py-4 text-right">
                          <EtiquetaSaldo saldo={s.saldo} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {resumo.semPagador > 0 && (
              <p className="mt-4 flex items-start gap-2 rounded-lg bg-warn-soft px-4 py-2 text-[13px]/5 text-warn-text">
                <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                {formatar(resumo.semPagador)} em contas sem pagador definido ficam fora do acerto.
                Edite essas contas e escolha quem paga.
              </p>
            )}
          </Painel>

          {/* Acertos */}
          <Painel className="p-4 sm:p-6">
            <TituloPainel>Acertos de {mesMin}</TituloPainel>
            <p className="mt-1 text-[13px]/5 text-ink-3">
              O menor número de Pix para todo mundo ficar com a sua parte justa.
            </p>
            <div className="mt-4 space-y-4">
              {resumo.pendentes.length === 0 ? (
                <p className="flex items-center gap-2 text-sm font-medium text-ink-2">
                  <CircleCheck size={20} className="text-good" />
                  {resumo.total > 0 ? "Nenhum acerto pendente." : "Sem contas, sem acertos."}
                </p>
              ) : (
                resumo.pendentes.map((t) => (
                  <LinhaTransferencia
                    key={t.deId + t.paraId}
                    t={t}
                    moradores={moradores}
                    euId={eu?.id ?? null}
                    onFeito={() => acertar(t)}
                  />
                ))
              )}
            </div>
            {resumo.feitos.length > 0 && (
              <>
                <p className="mt-6 mb-1 text-xs font-semibold text-ink">Já feitos</p>
                <ul>
                  {resumo.feitos.map((a) => {
                    const de = moradores.find((m) => m.id === a.deId);
                    const para = moradores.find((m) => m.id === a.paraId);
                    return (
                      <li
                        key={a.id}
                        className="flex items-center gap-4 border-b border-line py-2 text-[13px]/5 last:border-0"
                      >
                        <Check size={16} strokeWidth={3} className="shrink-0 text-good" />
                        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-ink-2">
                          {de?.nome ?? "Alguém"}
                          <ArrowRight size={12} className="text-ink-3" />
                          {para?.nome ?? "alguém"}
                          <strong className="tabular font-semibold text-ink">
                            {formatar(a.valor)}
                          </strong>
                          <span className="text-ink-3">em {dataBR(a.feitoEm)}</span>
                        </span>
                        <Botao
                          tamanho="sm"
                          variante="fantasma"
                          onClick={() => remover("acertos", a.id)}
                        >
                          Desfazer
                        </Botao>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Painel>

          {/* Contas da casa */}
          <Painel className="px-4 py-4 sm:px-6 sm:py-6">
            <TituloPainel detalhe={`${resumo.linhas.length} em ${mesMin}`}>
              Contas da casa
            </TituloPainel>
            {resumo.linhas.length === 0 ? (
              <Vazio
                compacto
                icone={House}
                titulo="Nenhuma conta da casa neste mês"
                texto="Cadastre aluguel, luz, mercado e o que mais vocês dividem."
              />
            ) : (
              <ul className="mt-2">
                {resumo.linhas.map(({ item, partes }) => {
                  const pagador = moradores.find((m) => m.id === item.pagadorId);
                  const quem = moradores.filter((m) => (partes[m.id] ?? 0) > 0);
                  const valores = new Set(quem.map((m) => partes[m.id]));
                  const iguais = Math.max(...valores) - Math.min(...valores) <= 1;
                  return (
                    <li
                      key={item.chave}
                      className="flex items-center gap-4 border-b border-line py-4 last:border-0"
                    >
                      <Marcador
                        marcado={item.pago}
                        rotulo={`${item.pago ? "Desmarcar" : "Marcar"} ${item.nome}`}
                        onMudar={(v) => marcarPago(item, mes, v)}
                      />
                      <button
                        type="button"
                        onClick={() => abrir({ tipo: "ocorrencia", item, mes })}
                        className="-my-1 flex min-w-0 flex-1 items-center gap-4 rounded-lg py-1 text-left"
                      >
                        <span className="min-w-0 flex-1">
                          <span
                            className={cx(
                              "block truncate text-sm font-medium",
                              item.pago
                                ? "text-ink-3 line-through decoration-line-strong"
                                : "text-ink",
                            )}
                          >
                            {item.nome}
                          </span>
                          <span className="block truncate text-xs text-ink-3">
                            dia {String(item.dia).padStart(2, "0")} ·{" "}
                            {pagador ? `${pagador.nome} paga` : "sem pagador"} ·{" "}
                            {iguais
                              ? `${formatar(Math.max(...valores))} cada`
                              : "partes diferentes"}
                          </span>
                        </span>
                        <span className="flex shrink-0 -space-x-2 max-sm:hidden">
                          {quem.map((m) => (
                            <Avatar key={m.id} nome={m.nome} cor={m.cor} tamanho={24} anel />
                          ))}
                        </span>
                        <span
                          className={cx(
                            "tabular w-[104px] text-right text-sm font-semibold whitespace-nowrap",
                            item.pago ? "text-ink-3" : "text-ink",
                          )}
                        >
                          {item.estimada && <span className="mr-1 font-normal text-ink-3">≈</span>}
                          {formatar(item.valor)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Painel>
        </div>

        <div className="grid min-w-0 gap-4 sm:gap-6 md:max-xl:grid-cols-2 ultra:grid-cols-2 ultra:items-start">
          {/* Moradores */}
          <Painel className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <TituloPainel detalhe={String(moradores.length)}>Moradores</TituloPainel>
              <Botao tamanho="sm" onClick={() => abrir({ tipo: "morador" })}>
                <Plus size={16} />
                Adicionar
              </Botao>
            </div>
            <ul className="mt-4">
              {moradores.map((m) => (
                <li key={m.id} className="border-b border-line last:border-0">
                  <button
                    type="button"
                    onClick={() => abrir({ tipo: "morador", morador: m })}
                    className="group flex w-full items-center gap-4 py-4 text-left"
                  >
                    <Avatar nome={m.nome} cor={m.cor} tamanho={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {m.nome}
                        {m.id === eu?.id && <span className="font-normal text-ink-3"> (você)</span>}
                      </span>
                      <span className="block truncate text-xs text-ink-3">
                        {m.perfilId ? "usa o app" : "sem conta no app"} · peso {m.peso}
                        {m.salarioCompartilhado !== null &&
                          ` · salário ${formatar(m.salarioCompartilhado)}`}
                      </span>
                    </span>
                    {m.peso === 0 && <Etiqueta>fora da divisão</Etiqueta>}
                    <Pencil
                      size={16}
                      className="shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </Painel>

          {/* Convite e ajustes */}
          <Painel className="p-4 sm:p-6">
            <TituloPainel>Convite</TituloPainel>
            <p className="mt-1 text-[13px] leading-5 text-ink-3">
              Passe este código para quem mora com você. A pessoa cria o próprio perfil e entra pela
              tela Casa, podendo assumir um morador já cadastrado.
            </p>
            <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-dashed border-line-strong bg-surface-2 py-4 pr-4 pl-6">
              <span className="tabular text-[22px]/8 font-semibold tracking-[0.28em] text-ink">
                {lar.codigo}
              </span>
              <Botao tamanho="sm" onClick={copiar}>
                {copiado ? <Check size={16} className="text-good" /> : <Copy size={16} />}
                {copiado ? "Copiado" : "Copiar"}
              </Botao>
            </div>

            <div className="mt-6 border-t border-line pt-6">
              <p className="mb-2 text-xs font-semibold text-ink">Nome da casa</p>
              {renomeando ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void salvarNome();
                  }}
                >
                  <Entrada
                    autoFocus
                    value={nomeLar}
                    onChange={(e) => setNomeLar(e.target.value)}
                    maxLength={40}
                  />
                  <Botao variante="primario" type="submit">
                    Salvar
                  </Botao>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <span className="truncate text-sm text-ink-2">{lar.nome}</span>
                  <BotaoIcone
                    icone={Pencil}
                    rotulo="Renomear casa"
                    tamanho={32}
                    onClick={() => {
                      setNomeLar(lar.nome);
                      setRenomeando(true);
                    }}
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={sairDaCasa}
              className="alvo-toque mt-6 flex items-center gap-2 text-[13px]/5 font-medium text-bad-text hover:underline"
            >
              <LogOut size={16} />
              Sair desta casa
            </button>
          </Painel>
        </div>
      </div>
    </div>
  );
}
