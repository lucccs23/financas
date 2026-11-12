"use client";

// Cartões da Visão geral que olham para o bolso da pessoa:
// saldo previsto, contas a pagar e moradia.

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleCheck,
  House,
  Pencil,
  Plus,
  Receipt,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { useApp, usePerfil } from "@/lib/app";
import { itensDoMes, resumoMoradia, resumoPessoal, souPagador } from "@/lib/calc";
import { categoria } from "@/lib/categorias";
import { formatar, porcento } from "@/lib/dinheiro";
import { BarraFina, Medidor } from "./graficos";
import { Ilustracao } from "./ilustracao";
import { useModais } from "./modais-contexto";
import {
  Botao,
  classesBotao,
  cx,
  Etiqueta,
  Ladrilho,
  Marcador,
  Painel,
  Ponto,
  Segmentado,
  TituloPainel,
  Valor,
  Vazio,
} from "./ui";

/* ───────────────────────── Saldo previsto ───────────────────────── */

function ItemLegenda({
  cor,
  rotulo,
  valor,
  fracao,
  prefixo = "",
  acao,
}: {
  cor?: string;
  rotulo: string;
  valor: number;
  fracao?: number | null;
  prefixo?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-2 text-xs text-ink-3">
        {cor && <Ponto cor={cor} />}
        <span className="truncate">{rotulo}</span>
      </p>
      <p className="tabular mt-1 flex items-baseline gap-2 text-[15px]/6 font-semibold tracking-[-0.01em] text-ink">
        <span className="truncate">
          {prefixo}
          {formatar(valor)}
        </span>
        {fracao != null && (
          <span className="text-xs font-normal text-ink-3">· {porcento(fracao)}</span>
        )}
        {acao}
      </p>
    </div>
  );
}

export function SaldoPrevisto() {
  const { dados, mes, lar } = useApp();
  const perfil = usePerfil();
  const r = useMemo(() => resumoPessoal(dados, perfil.id, mes), [dados, perfil.id, mes]);
  const fr = (v: number) => (r.renda > 0 ? v / r.renda : null);
  const falta = r.sobra < 0;

  return (
    <Painel className="p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <TituloPainel>Saldo previsto</TituloPainel>
          <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-4">
            <Valor
              centavos={r.sobra}
              className={cx("text-[44px] leading-none sm:text-[62px]", falta && "!text-bad-text")}
            />
            <div className="border-line pb-1 sm:border-l sm:pl-6">
              {r.renda === 0 ? (
                <Link
                  href="/renda"
                  className="flex items-center gap-2 text-sm font-semibold text-primary-text hover:underline"
                >
                  <Plus size={16} strokeWidth={2.5} />
                  Cadastre sua renda
                </Link>
              ) : falta ? (
                <p className="flex items-center gap-2 text-sm font-semibold text-bad-text">
                  <TriangleAlert size={16} strokeWidth={2.4} />
                  As saídas passam da renda
                </p>
              ) : (
                <p className="flex items-center gap-2 text-sm font-semibold text-good-text">
                  <ArrowUpRight size={16} strokeWidth={2.6} />
                  {porcento(r.fracaoSobra ?? 0)} da renda livre
                </p>
              )}
              <p className="mt-1 text-[13px]/5 text-ink-3">
                valor estimado após pagar todas as contas
              </p>
            </div>
          </div>
        </div>
        <div className="max-sm:hidden">
          <Ilustracao painel="saldo" icone={Wallet} tom="verde" tamanho={80} />
        </div>
      </div>

      <div className="mt-8">
        <BarraFina
          rotulo="Para onde vai a renda do mês"
          partes={[
            { id: "casa", rotulo: "Sua parte da casa", valor: r.parteCasa, cor: "var(--seg-casa)" },
            {
              id: "pessoal",
              rotulo: "Contas pessoais",
              valor: r.pessoais,
              cor: "var(--seg-pessoal)",
            },
            { id: "dia", rotulo: "Dia a dia", valor: r.diaADia, cor: "var(--seg-dia)" },
            { id: "sobra", rotulo: "Sobra", valor: Math.max(0, r.sobra), cor: "var(--seg-sobra)" },
          ]}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 min-[1700px]:grid-cols-5">
        <ItemLegenda
          rotulo={r.outrasRendas > 0 ? "Salário + outras rendas" : "Salário"}
          valor={r.renda}
          acao={
            <Link
              href="/renda"
              aria-label="Editar renda"
              title="Editar renda"
              className="alvo-toque self-center text-ink-3 transition-colors hover:text-ink"
            >
              <Pencil size={12} />
            </Link>
          }
        />
        {/* Sem casa e sem gasto da casa: não há o que mostrar. */}
        {(lar || r.parteCasa > 0) && (
          <ItemLegenda
            cor="var(--seg-casa)"
            rotulo="Sua parte da casa"
            valor={r.parteCasa}
            fracao={fr(r.parteCasa)}
            prefixo="− "
          />
        )}
        <ItemLegenda
          cor="var(--seg-pessoal)"
          rotulo="Contas pessoais"
          valor={r.pessoais}
          fracao={fr(r.pessoais)}
          prefixo="− "
        />
        {r.diaADia > 0 && (
          <ItemLegenda
            cor="var(--seg-dia)"
            rotulo="Dia a dia"
            valor={r.diaADia}
            fracao={fr(r.diaADia)}
            prefixo="− "
          />
        )}
        <ItemLegenda
          cor={falta ? "var(--bad)" : "var(--seg-sobra)"}
          rotulo={falta ? "= Falta" : "= Sobra"}
          valor={Math.abs(r.sobra)}
          fracao={fr(Math.abs(r.sobra))}
        />
      </div>
    </Painel>
  );
}

/* ───────────────────────── Contas a pagar ───────────────────────── */

export function ContasAPagar() {
  const { dados, mes, mesHoje, hoje, eu, marcarPago } = useApp();
  const perfil = usePerfil();
  const { abrir } = useModais();
  // O filtro de dia vale só para o mês em que foi escolhido.
  const [filtro, setFiltro] = useState<{ mes: string; dia: number } | null>(null);
  const diaSel = filtro && filtro.mes === mes ? filtro.dia : null;
  const setDiaSel = (dia: number | null) => setFiltro(dia === null ? null : { mes, dia });

  const itens = useMemo(
    () =>
      itensDoMes(dados, mes).filter(
        (i) => i.natureza === "despesa" && souPagador(i, perfil.id, eu?.id ?? null),
      ),
    [dados, mes, perfil.id, eu],
  );

  const abertas = itens.filter((i) => !i.pago);
  const falta = abertas.reduce((s, i) => s + i.valor, 0);
  const total = itens.reduce((s, i) => s + i.valor, 0);
  const dias = [...new Set(itens.map((i) => i.dia))];
  const lista = diaSel === null ? itens : itens.filter((i) => i.dia === diaSel);

  let quando: string | null = null;
  if (mes === mesHoje && abertas.length) {
    const diaHoje = Number(hoje.slice(8, 10));
    const atrasadas = abertas.filter((i) => i.dia < diaHoje).length;
    const proxima = abertas.find((i) => i.dia >= diaHoje);
    if (atrasadas) quando = atrasadas === 1 ? "1 atrasada" : `${atrasadas} atrasadas`;
    else if (proxima) {
      const d = proxima.dia - diaHoje;
      quando = d === 0 ? "vence hoje" : d === 1 ? "vence amanhã" : `em ${d} dias`;
    }
  }

  return (
    <Painel className="flex flex-col p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <TituloPainel
            detalhe={diaSel === null ? undefined : `dia ${String(diaSel).padStart(2, "0")}`}
          >
            Contas a pagar
          </TituloPainel>
          {itens.length > 0 && abertas.length === 0 ? (
            <p className="mt-4 flex items-center gap-2 text-[26px]/8 font-semibold tracking-[-0.03em] text-ink">
              <CircleCheck size={24} className="text-good" />
              Tudo pago
            </p>
          ) : (
            <Valor centavos={falta} className="mt-4 text-[34px] leading-none" />
          )}
          <p className="mt-2 text-[13px]/5 text-ink-3">
            {quando && (
              <>
                <span
                  className={cx(
                    "font-medium",
                    quando.includes("atrasada") ? "text-bad-text" : "text-ink-2",
                  )}
                >
                  {quando}
                </span>
                {" · "}
              </>
            )}
            <span className="font-medium text-ink-2">
              {itens.length - abertas.length} de {itens.length} pagas
            </span>
            {itens.length > 0 && <> · total {formatar(total)}</>}
          </p>
        </div>
        <Ilustracao painel="contas" icone={CalendarDays} tom="ambar" tamanho={64} />
      </div>

      {itens.length === 0 ? (
        <Vazio
          compacto
          icone={Receipt}
          titulo="Nenhuma conta neste mês"
          texto="Cadastre as contas fixas uma vez e elas aparecem todo mês."
        >
          <Botao tamanho="sm" variante="primario" onClick={() => abrir({ tipo: "conta" })}>
            <Plus size={16} />
            Adicionar conta
          </Botao>
        </Vazio>
      ) : (
        <>
          <div
            role="radiogroup"
            aria-label="Filtrar por dia de vencimento"
            className="sem-rolagem -mx-1 mt-6 flex gap-2 overflow-x-auto px-1 py-1"
          >
            {dias.map((d) => {
              const doDia = itens.filter((i) => i.dia === d);
              const ativo = diaSel === d;
              const quitado = doDia.every((i) => i.pago);
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  aria-label={`Dia ${d}: ${doDia.length} ${doDia.length === 1 ? "conta" : "contas"}`}
                  onClick={() => setDiaSel(ativo ? null : d)}
                  className={cx(
                    "flex h-14 min-w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border transition-all duration-150",
                    ativo
                      ? "border-primary bg-primary text-primary-ink shadow-[0_6px_14px_-6px_var(--primary)]"
                      : "border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-2",
                  )}
                >
                  <span className="tabular text-[15px] leading-none font-semibold">
                    {String(d).padStart(2, "0")}
                  </span>
                  <span className="flex h-2 items-center gap-1">
                    {quitado ? (
                      <Check size={12} strokeWidth={3.5} className={ativo ? "" : "text-good"} />
                    ) : (
                      doDia
                        .slice(0, 5)
                        .map((i) => (
                          <span
                            key={i.chave}
                            className={cx(
                              "h-1 w-1 rounded-full",
                              ativo ? "bg-white" : i.pago ? "bg-line-strong" : "bg-primary",
                            )}
                          />
                        ))
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <ul className="rolagem-fina -mr-2 mt-2 max-h-74 flex-1 overflow-y-auto pr-2">
            {lista.map((i) => (
              <li
                key={i.chave}
                className="flex items-center gap-4 border-b border-line py-4 last:border-0"
              >
                <Marcador
                  marcado={i.pago}
                  rotulo={i.pago ? `Desmarcar ${i.nome}` : `Marcar ${i.nome} como paga`}
                  onMudar={(v) => marcarPago(i, mes, v)}
                />
                <button
                  type="button"
                  onClick={() => abrir({ tipo: "ocorrencia", item: i, mes })}
                  className="-my-1 flex min-w-0 flex-1 items-center gap-4 rounded-lg py-1 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={cx(
                        "block truncate text-sm font-medium",
                        i.pago ? "text-ink-3 line-through decoration-line-strong" : "text-ink",
                      )}
                    >
                      {i.nome}
                    </span>
                    {diaSel === null && (
                      <span className="block text-xs text-ink-3">
                        dia {String(i.dia).padStart(2, "0")}
                        {i.escopo === "casa" && " · da casa"}
                      </span>
                    )}
                  </span>
                  {diaSel !== null && i.escopo === "casa" && <Etiqueta>casa</Etiqueta>}
                  <span
                    className={cx(
                      "tabular text-sm font-semibold whitespace-nowrap",
                      i.pago ? "text-ink-3" : "text-ink",
                    )}
                  >
                    {i.estimada && <span className="mr-1 font-normal text-ink-3">≈</span>}
                    {formatar(i.valor)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Painel>
  );
}

/* ───────────────────────── Moradia ───────────────────────── */

const REFERENCIA_MORADIA = 0.3;

export function Moradia() {
  const { dados, mes, lar } = useApp();
  const perfil = usePerfil();
  const [escolha, setBase] = useState<"meu" | "casa">("meu");
  const podeCasa = !!lar && dados.moradores.some((m) => m.salarioCompartilhado !== null);
  const base = podeCasa ? escolha : "meu";
  const r = useMemo(
    () => resumoMoradia(dados, perfil.id, mes, base),
    [dados, perfil.id, mes, base],
  );
  const estimado = r.itens.some((i) => i.estimada);
  const acima = r.fracao !== null && r.fracao > REFERENCIA_MORADIA;
  const cor = acima ? "var(--warn)" : "var(--good)";

  // Nada marcado como moradia: um convite curto, sem medidor nem R$ 0,00.
  if (r.itens.length === 0) {
    return (
      <Painel className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <TituloPainel>Moradia</TituloPainel>
            <p className="mt-4 text-[13px]/5 text-ink-3">
              Marque aluguel, condomínio, luz e parecidas como &quot;Gasto de moradia&quot; para ver
              quanto do salário vai para morar (a referência é até {porcento(REFERENCIA_MORADIA)}).
            </p>
            <Link href="/contas" className={cx(classesBotao("secundario", "sm"), "mt-4")}>
              Ir para Contas
            </Link>
          </div>
          <Ilustracao painel="moradia" icone={House} tom="ciano" tamanho={64} />
        </div>
      </Painel>
    );
  }

  return (
    <Painel className="p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <TituloPainel>Moradia</TituloPainel>
          <p className="mt-4 text-[13px]/5 text-ink-3">
            {base === "meu" ? "Quanto você gasta pra morar" : "Quanto a casa gasta pra morar"}
          </p>
          <Valor centavos={r.total} aprox={estimado} className="mt-1 text-[34px] leading-none" />
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]/5">
            {r.fracao === null ? (
              <span className="text-ink-3">
                {base === "meu"
                  ? "Cadastre seu salário para comparar."
                  : "Ninguém mostrou o salário para a casa."}
              </span>
            ) : (
              <>
                <span
                  className={cx(
                    "flex items-center gap-1 font-semibold",
                    acima ? "text-warn-text" : "text-good-text",
                  )}
                >
                  {acima ? <TriangleAlert size={16} /> : <Check size={16} strokeWidth={3} />}
                  {porcento(r.fracao)} {base === "meu" ? "do salário" : "dos salários"}
                </span>
                <span className="text-ink-3">referência: até {porcento(REFERENCIA_MORADIA)}</span>
              </>
            )}
          </p>
        </div>
        <Ilustracao painel="moradia" icone={House} tom="ciano" tamanho={64} />
      </div>

      <div className="mt-6">
        <Segmentado
          cheio
          rotulo="Base de comparação"
          valor={base}
          onMudar={setBase}
          opcoes={[
            { valor: "meu", rotulo: "Só meu salário" },
            { valor: "casa", rotulo: "Salários da casa", desativado: !podeCasa },
          ]}
        />
        {base === "casa" && (
          <p className="mt-2 text-xs text-ink-3">
            {r.compartilham} de {dados.moradores.length} moradores mostram o salário para a casa.
          </p>
        )}
      </div>

      {r.fracao !== null && (
        <div className="mt-6">
          <Medidor
            fracao={r.fracao}
            referencia={REFERENCIA_MORADIA}
            maximo={0.6}
            cor={cor}
            rotuloFim={base === "meu" ? "60% do salário" : "60% dos salários"}
          />
        </div>
      )}

      <p className="mt-6 text-xs font-semibold text-ink">O que entra na conta</p>
      {r.itens.length === 0 ? (
        <p className="mt-2 text-[13px] leading-5 text-ink-3">
          Nada ainda. Ao cadastrar aluguel, condomínio, luz e parecidas, ligue a opção &quot;Gasto
          de moradia&quot;.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
          {r.itens.map((i) => (
            <li key={i.nome} className="flex min-w-0 items-center gap-4">
              <Ladrilho icone={categoria(i.categoria).icone} />
              <span className="min-w-0">
                <span className="block truncate text-xs text-ink-3">{i.nome}</span>
                <span className="tabular block text-sm font-semibold text-ink">
                  {i.estimada && <span className="mr-1 font-normal text-ink-3">≈</span>}
                  {formatar(i.valor)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Painel>
  );
}
