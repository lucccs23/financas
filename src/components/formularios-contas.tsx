"use client";

// Janelas de cadastro: conta, ajuste de um mês, cartão e compra.

import { useState } from "react";
import { Landmark, Pencil, Trash2 } from "lucide-react";
import { useApp } from "@/lib/app";
import {
  ajusteParaDisponivel,
  limiteDoCartao,
  mesPrimeiraFatura,
  valorParcela,
  type ItemMes,
} from "@/lib/calc";
import { CATEGORIAS, CATEGORIAS_DE_COMPRA, categoria, sugerirCategoria } from "@/lib/categorias";
import { novoId } from "@/lib/dados/backend";
import { formatar } from "@/lib/dinheiro";
import { addMes, anoDe, dataBR, nomeMes, NOMES_MESES, numeroDe } from "@/lib/meses";
import type { Cartao, Compra, Conta, Id, Mes, Natureza } from "@/lib/types";
import { CORES_CARTAO } from "@/lib/visual-cartao";
import { CartaoVisual } from "./cartao-visual";
import { SeletorImagem } from "./seletor-imagem";
import {
  Alternar,
  Avatar,
  Botao,
  Campo,
  cx,
  Entrada,
  EntradaNumero,
  EntradaValor,
  Modal,
  Segmentado,
  Selecao,
} from "./ui";
import { useModais } from "./modais-contexto";

export function SeletorMes({
  valor,
  onMudar,
  base,
}: {
  valor: Mes;
  onMudar: (m: Mes) => void;
  base: Mes;
}) {
  const ano = anoDe(valor);
  const primeiro = Math.min(ano, anoDe(base) - 3);
  const ultimo = Math.max(ano, anoDe(base) + 8);
  const anos = Array.from({ length: ultimo - primeiro + 1 }, (_, i) => primeiro + i);
  const montar = (a: number, m: number) => `${a}-${String(m).padStart(2, "0")}`;
  return (
    <span className="grid grid-cols-[1fr_104px] gap-2">
      <Selecao
        aria-label="Mês"
        value={numeroDe(valor)}
        onChange={(e) => onMudar(montar(ano, Number(e.target.value)))}
      >
        {NOMES_MESES.map((n, i) => (
          <option key={n} value={i + 1}>
            {n}
          </option>
        ))}
      </Selecao>
      <Selecao
        aria-label="Ano"
        value={ano}
        onChange={(e) => onMudar(montar(Number(e.target.value), numeroDe(valor)))}
      >
        {anos.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </Selecao>
    </span>
  );
}

function BotaoExcluir({ onClick }: { onClick: () => void }) {
  return (
    <Botao variante="fantasma" onClick={onClick} className="mr-auto !text-bad-text">
      <Trash2 size={16} />
      Excluir
    </Botao>
  );
}

/* ───────────────────────── Conta (despesa ou renda) ───────────────────────── */

export function FormConta({
  conta,
  escopo: escopoInicial,
  natureza: naturezaInicial,
  onFechar,
}: {
  conta?: Conta;
  escopo?: "pessoal" | "casa";
  natureza?: Natureza;
  onFechar: () => void;
}) {
  const { dados, lar, eu, sessao, mes, inserir, atualizar, removerConta, avisar } = useApp();
  const { abrir } = useModais();

  const [natureza, setNatureza] = useState<Natureza>(
    conta?.natureza ?? naturezaInicial ?? "despesa",
  );
  const [escopo, setEscopo] = useState<"pessoal" | "casa">(
    conta
      ? conta.larId
        ? "casa"
        : "pessoal"
      : escopoInicial === "casa" && lar
        ? "casa"
        : "pessoal",
  );
  const [nome, setNome] = useState(conta?.nome ?? "");
  const [valor, setValor] = useState(conta?.valor ?? 0);
  const [dia, setDia] = useState(conta?.diaVencimento ?? 10);
  const [cat, setCat] = useState(conta?.categoria ?? "outros");
  const [recorrente, setRecorrente] = useState(conta?.recorrente ?? true);
  const [mesInicio, setMesInicio] = useState<Mes>(conta?.mesInicio ?? mes);
  const [temFim, setTemFim] = useState(!!conta?.mesFim);
  const [mesFim, setMesFim] = useState<Mes>(conta?.mesFim ?? addMes(mes, 11));
  const [estimada, setEstimada] = useState(conta?.estimada ?? false);
  const [moradia, setMoradia] = useState(conta?.moradia ?? false);
  const [pagadorId, setPagadorId] = useState<Id>(conta?.pagadorId ?? eu?.id ?? "");
  const [propria, setPropria] = useState(!!conta?.participantes);
  const [pesos, setPesos] = useState<Record<Id, number>>(
    () =>
      conta?.participantes ??
      Object.fromEntries(dados.moradores.map((m) => [m.id, m.peso > 0 ? m.peso : 1])),
  );

  const [aplicar, setAplicar] = useState<"daqui" | "todos">("daqui");

  const daCasa = escopo === "casa" && !!lar;
  const renda = !daCasa && natureza === "receita";
  // Conta fixa que já existia antes do mês aberto: dá para mudar só daqui pra frente.
  const podeDividir =
    !!conta &&
    conta.recorrente &&
    recorrente &&
    conta.mesInicio < mes &&
    (!conta.mesFim || conta.mesFim >= mes) &&
    mesInicio === conta.mesInicio;

  const [metaId, setMetaId] = useState<Id>(conta?.metaId ?? "");
  // Metas que podem receber o valor: as minhas para conta minha, as da casa para conta da casa.
  const metasPossiveis = dados.metas.filter((m) =>
    daCasa ? m.larId === lar?.id : m.perfilId === sessao?.userId,
  );

  const escolherCategoria = (id: string) => {
    setCat(id);
    if (id === "reserva" && !metaId && metasPossiveis.length) setMetaId(metasPossiveis[0].id);
    if (!conta) setMoradia(!!categoria(id).moradia);
  };

  const salvar = async () => {
    if (!nome.trim()) return avisar("Dê um nome para a conta.", "erro");
    if (valor <= 0) return avisar("Informe um valor maior que zero.", "erro");
    if (daCasa && !pagadorId) return avisar("Escolha quem paga a conta.", "erro");
    if (recorrente && temFim && mesFim < mesInicio) {
      return avisar("O mês final vem antes do inicial.", "erro");
    }

    let participantes: Record<Id, number> | null = null;
    if (daCasa && propria) {
      participantes = Object.fromEntries(
        dados.moradores.map((m): [Id, number] => [m.id, pesos[m.id] ?? 0]).filter(([, p]) => p > 0),
      );
      if (!Object.keys(participantes).length) {
        return avisar("Escolha ao menos uma pessoa na divisão.", "erro");
      }
    }

    const linha: Conta = {
      id: conta?.id ?? novoId(),
      perfilId: daCasa ? null : (sessao?.userId ?? null),
      larId: daCasa ? lar.id : null,
      natureza: renda ? "receita" : "despesa",
      nome: nome.trim(),
      valor,
      diaVencimento: dia,
      recorrente,
      mesInicio,
      mesFim: recorrente && temFim ? mesFim : null,
      estimada: !renda && estimada,
      moradia: !renda && moradia,
      categoria: renda ? "renda" : cat,
      pagadorId: daCasa ? pagadorId : null,
      participantes,
      metaId: !renda && metasPossiveis.some((m) => m.id === metaId) ? metaId : null,
    };

    onFechar();
    if (!conta) {
      await inserir("contas", linha);
      avisar(renda ? "Renda adicionada." : "Conta adicionada.");
      return;
    }

    // "A partir deste mês": a conta antiga termina no mês anterior e uma cópia
    // com os novos valores começa agora. Assim os meses passados não mudam.
    const mexeuNoDinheiro =
      linha.valor !== conta.valor ||
      linha.diaVencimento !== conta.diaVencimento ||
      linha.pagadorId !== conta.pagadorId ||
      linha.estimada !== conta.estimada ||
      linha.moradia !== conta.moradia ||
      JSON.stringify(linha.participantes) !== JSON.stringify(conta.participantes);
    const fimDepois = !linha.mesFim || linha.mesFim >= mes;
    if (podeDividir && aplicar === "daqui" && mexeuNoDinheiro && fimDepois) {
      const nova: Conta = { ...linha, id: novoId(), mesInicio: mes };
      await atualizar("contas", conta.id, { mesFim: addMes(mes, -1) });
      await inserir("contas", nova);
      // O que já foi marcado (pago, valor real) deste mês em diante passa para a
      // conta nova, e o que já foi guardado na reserva por esses meses também.
      // Em paralelo: no modo GitHub vira uma gravação só.
      await Promise.all([
        ...dados.lancamentos
          .filter((l) => l.refTipo === "conta" && l.refId === conta.id && l.mes >= mes)
          .map((l) => atualizar("lancamentos", l.id, { refId: nova.id })),
        ...dados.aportes.flatMap((a) => {
          const m = a.origem?.match(/^conta:(.+):(\d{4}-\d{2})$/);
          return m && m[1] === conta.id && m[2] >= mes
            ? [atualizar("aportes", a.id, { origem: `conta:${nova.id}:${m[2]}` })]
            : [];
        }),
      ]);
      avisar(`Mudanças valem a partir de ${nomeMes(mes).toLowerCase()}.`);
      return;
    }
    await atualizar("contas", conta.id, linha);
    avisar("Alterações salvas.");
  };

  const excluir = () =>
    abrir({
      tipo: "confirmar",
      titulo: `Excluir "${conta?.nome}"?`,
      texto: conta?.recorrente
        ? 'A conta some de todos os meses, inclusive dos passados, e não dá para desfazer. Se a conta só acabou, prefira ligar "Tem data para acabar": o histórico fica guardado.'
        : "A conta some deste mês e não dá para desfazer.",
      rotulo: "Excluir conta",
      acao: async () => {
        if (conta) await removerConta(conta.id);
        avisar("Conta excluída.");
      },
    });

  return (
    <Modal
      titulo={conta ? "Editar conta" : renda ? "Nova renda" : "Nova conta"}
      descricao={
        conta?.recorrente
          ? "Para ajustar o valor de um mês só, feche esta janela e clique na conta dentro daquele mês."
          : undefined
      }
      onFechar={onFechar}
      onEnviar={salvar}
      rodape={
        <>
          {conta && <BotaoExcluir onClick={excluir} />}
          <Botao variante="fantasma" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit">
            Salvar
          </Botao>
        </>
      }
    >
      {!conta && (
        <div className="flex flex-wrap gap-2">
          {lar && (
            <Segmentado
              rotulo="De quem é a conta"
              valor={escopo}
              onMudar={setEscopo}
              opcoes={[
                { valor: "pessoal", rotulo: "Só minha" },
                { valor: "casa", rotulo: "Da casa" },
              ]}
            />
          )}
          {!daCasa && (
            <Segmentado
              rotulo="Tipo"
              valor={natureza}
              onMudar={setNatureza}
              opcoes={[
                { valor: "despesa", rotulo: "Despesa" },
                { valor: "receita", rotulo: "Renda" },
              ]}
            />
          )}
        </div>
      )}

      {podeDividir && (
        <div>
          <span className="mb-2 block text-[13px]/5 font-medium text-ink-2">
            Mudanças de valor, vencimento ou divisão valem
          </span>
          <Segmentado
            cheio
            rotulo="Quando as mudanças valem"
            valor={aplicar}
            onMudar={setAplicar}
            opcoes={[
              { valor: "daqui", rotulo: `A partir de ${nomeMes(mes).toLowerCase()}` },
              { valor: "todos", rotulo: "Em todos os meses" },
            ]}
          />
          <p className="mt-2 text-xs leading-5 text-ink-3">
            {aplicar === "daqui"
              ? "Os meses anteriores continuam com os valores antigos."
              : "Os meses passados também mudam. Use para corrigir um cadastro errado."}
          </p>
        </div>
      )}

      <Campo rotulo="Nome">
        <Entrada
          autoFocus={!conta}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder={renda ? "Ex.: Freela, aluguel recebido" : "Ex.: Aluguel, academia"}
          maxLength={60}
        />
      </Campo>

      <div className="grid grid-cols-2 gap-4">
        <Campo rotulo="Valor">
          <EntradaValor valor={valor} onMudar={setValor} />
        </Campo>
        <Campo rotulo={renda ? "Dia do recebimento" : "Dia do vencimento"}>
          <EntradaNumero valor={dia} onMudar={setDia} min={1} max={31} />
        </Campo>
      </div>

      {!renda && (
        <Campo rotulo="Categoria">
          <Selecao value={cat} onChange={(e) => escolherCategoria(e.target.value)}>
            {CATEGORIAS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Selecao>
        </Campo>
      )}

      {!renda && metasPossiveis.length > 0 && (
        <Campo
          rotulo="Ao marcar como paga, guardar na reserva"
          dica={
            metaId
              ? "O valor entra na meta quando você marca a conta como paga. Desmarcar tira de volta."
              : 'Use para contas como "Guardar na reserva": o pagamento vira um valor guardado.'
          }
        >
          <Selecao value={metaId} onChange={(e) => setMetaId(e.target.value)}>
            <option value="">Não guardar</option>
            {metasPossiveis.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </Selecao>
        </Campo>
      )}

      <div className="space-y-4 rounded-2xl bg-surface-2 p-4">
        <Segmentado
          cheio
          rotulo="Repetição"
          valor={recorrente ? "fixa" : "unica"}
          onMudar={(v) => setRecorrente(v === "fixa")}
          opcoes={[
            { valor: "fixa", rotulo: "Todo mês" },
            { valor: "unica", rotulo: "Só uma vez" },
          ]}
        />
        <Campo rotulo={recorrente ? "A partir de" : "Mês"}>
          <SeletorMes valor={mesInicio} onMudar={setMesInicio} base={mes} />
        </Campo>
        {recorrente && (
          <>
            <Alternar
              titulo="Tem data para acabar"
              descricao="Para parcelamentos e contratos com fim."
              ligado={temFim}
              onMudar={setTemFim}
            />
            {temFim && (
              <Campo rotulo="Último mês">
                <SeletorMes valor={mesFim} onMudar={setMesFim} base={mes} />
              </Campo>
            )}
          </>
        )}
      </div>

      {!renda && (
        <div className="space-y-4 px-1">
          <Alternar
            titulo="Valor estimado"
            descricao="Para contas que mudam todo mês, como luz e água. Você informa o valor real quando a conta chegar."
            ligado={estimada}
            onMudar={setEstimada}
          />
          <Alternar
            titulo="Gasto de moradia"
            descricao="Entra na conta de quanto você gasta para morar."
            ligado={moradia}
            onMudar={setMoradia}
          />
        </div>
      )}

      {daCasa && (
        <div className="space-y-4 rounded-2xl bg-surface-2 p-4">
          <Campo rotulo="Quem paga">
            <Selecao value={pagadorId} onChange={(e) => setPagadorId(e.target.value)}>
              <option value="" disabled>
                Escolha um morador
              </option>
              {dados.moradores.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                  {m.id === eu?.id ? " (você)" : ""}
                </option>
              ))}
            </Selecao>
          </Campo>
          <div>
            <span className="mb-2 block text-[13px]/5 font-medium text-ink-2">Dividida entre</span>
            <Segmentado
              cheio
              rotulo="Divisão"
              valor={propria ? "propria" : "todos"}
              onMudar={(v) => setPropria(v === "propria")}
              opcoes={[
                { valor: "todos", rotulo: "Todos, como sempre" },
                { valor: "propria", rotulo: "Escolher" },
              ]}
            />
          </div>
          {propria && (
            <ul className="space-y-2">
              {dados.moradores.map((m) => {
                const peso = pesos[m.id] ?? 0;
                return (
                  <li key={m.id} className="flex items-center gap-4">
                    <Avatar nome={m.nome} cor={m.cor} tamanho={32} />
                    <span
                      className={cx(
                        "min-w-0 flex-1 truncate text-sm font-medium",
                        peso > 0 ? "text-ink" : "text-ink-3",
                      )}
                    >
                      {m.nome}
                    </span>
                    <span className="w-24">
                      <EntradaNumero
                        valor={peso}
                        onMudar={(n) => setPesos((p) => ({ ...p, [m.id]: n }))}
                        min={0}
                        max={99}
                        sufixo="peso"
                      />
                    </span>
                  </li>
                );
              })}
              <li className="text-xs leading-5 text-ink-3">
                Peso 0 tira a pessoa desta conta. Peso 2 faz pagar o dobro de quem tem peso 1.
              </li>
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ───────────────────────── Uma conta em um mês ───────────────────────── */

export function FormOcorrencia({
  item,
  mes,
  onFechar,
}: {
  item: ItemMes;
  mes: Mes;
  onFechar: () => void;
}) {
  const { dados, ajustarMes, avisar } = useApp();
  const { abrir } = useModais();
  const [valor, setValor] = useState(item.valor);
  const [pago, setPago] = useState(item.pago);
  const ehConta = item.refTipo === "conta";
  const conta = ehConta ? dados.contas.find((c) => c.id === item.refId) : undefined;

  const salvar = async () => {
    if (ehConta && valor <= 0) return avisar("Informe um valor maior que zero.", "erro");
    onFechar();
    await ajustarMes(item, mes, {
      pago,
      ...(ehConta ? { valor: valor === item.valorCadastrado ? null : valor } : {}),
    });
    avisar("Mês atualizado.");
  };

  const pular = async () => {
    onFechar();
    await ajustarMes(item, mes, { pulado: true });
    avisar(`"${item.nome}" não conta em ${nomeMes(mes).toLowerCase()}.`);
  };

  return (
    <Modal
      titulo={item.nome}
      descricao={`${nomeMes(mes)} de ${anoDe(mes)} · vence dia ${String(item.dia).padStart(2, "0")}`}
      onFechar={onFechar}
      onEnviar={salvar}
      rodape={
        <>
          {conta && (
            <Botao
              variante="fantasma"
              className="mr-auto"
              onClick={() => {
                onFechar();
                abrir({ tipo: "conta", conta });
              }}
            >
              <Pencil size={16} />
              Editar cadastro
            </Botao>
          )}
          <Botao variante="fantasma" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit">
            Salvar
          </Botao>
        </>
      }
    >
      {ehConta ? (
        <Campo
          rotulo={`Valor em ${nomeMes(mes).toLowerCase()}`}
          dica={
            valor !== item.valorCadastrado
              ? `O valor cadastrado é ${formatar(item.valorCadastrado)}. A mudança vale só para este mês.`
              : item.estimada
                ? "Este valor é uma estimativa. Troque pelo valor real quando a conta chegar."
                : undefined
          }
        >
          <EntradaValor valor={valor} onMudar={setValor} autoFocus />
        </Campo>
      ) : (
        <div className="rounded-2xl bg-surface-2 p-4">
          <p className="text-xs text-ink-3">Valor da fatura</p>
          <p className="tabular mt-1 text-lg font-semibold text-ink">{formatar(item.valor)}</p>
          <p className="mt-1 text-xs text-ink-3">
            O valor vem das compras lançadas no cartão. Para mudar, edite as compras na tela
            Cartões.
          </p>
        </div>
      )}
      <div className="px-1">
        <Alternar
          titulo={item.natureza === "receita" ? "Já recebi" : "Já está paga"}
          ligado={pago}
          onMudar={setPago}
        />
      </div>
      {conta?.recorrente && (
        <button
          type="button"
          onClick={pular}
          className="w-full rounded-lg border border-dashed border-line-strong px-4 py-4 text-left text-[13px]/5 text-ink-2 transition-colors hover:bg-surface-2"
        >
          <span className="font-medium text-ink">Não vale neste mês</span>
          <span className="block text-xs text-ink-3">
            Tira a conta só de {nomeMes(mes).toLowerCase()}, sem mexer nos outros meses.
          </span>
        </button>
      )}
    </Modal>
  );
}

/* ───────────────────────── Cartão ───────────────────────── */

export function FormCartao({
  cartao,
  foco,
  onFechar,
}: {
  cartao?: Cartao;
  foco?: "limite";
  onFechar: () => void;
}) {
  const { hoje, mesHoje, dados, lar, sessao, inserir, atualizar, removerCartao, avisar } = useApp();
  const { abrir } = useModais();
  const [nome, setNome] = useState(cartao?.nome ?? "");
  const [banco, setBanco] = useState(cartao?.banco ?? "");
  const [cor, setCor] = useState(cartao?.cor ?? 0);
  const [limite, setLimite] = useState(cartao?.limite ?? 0);
  const disponivelAtual = cartao ? limiteDoCartao(cartao, dados, mesHoje).livre : 0;
  const [disponivel, setDisponivel] = useState(disponivelAtual);
  // Só recalcula a correção se a pessoa mexeu no disponível.
  const [mexeuDisponivel, setMexeuDisponivel] = useState(false);
  const [fechamento, setFechamento] = useState(cartao?.diaFechamento ?? 28);
  const [vencimento, setVencimento] = useState(cartao?.diaVencimento ?? 5);
  const [daCasa, setDaCasa] = useState(!!cartao?.larId);
  const [imagem, setImagem] = useState<string | null>(cartao?.imagem ?? null);
  const [logo, setLogo] = useState<string | null>(cartao?.logo ?? null);
  const [visual, setVisual] = useState<"cor" | "foto">(cartao?.imagem ? "foto" : "cor");

  const salvar = async () => {
    if (!nome.trim()) return avisar("Dê um nome para o cartão.", "erro");
    if (visual === "foto" && !imagem)
      return avisar("Escolha a foto do cartão ou volte para Cor.", "erro");
    const larId = daCasa && lar ? lar.id : null;
    const linha: Cartao = {
      id: cartao?.id ?? novoId(),
      perfilId: cartao?.perfilId ?? sessao?.userId ?? "",
      larId,
      nome: nome.trim(),
      banco: banco.trim(),
      cor,
      limite,
      ...(mexeuDisponivel && limite > 0
        ? {
            limiteAjuste: ajusteParaDisponivel(
              { id: cartao?.id ?? "", limite },
              dados,
              mesHoje,
              disponivel,
            ),
            limiteConferidoEm: hoje,
          }
        : {
            limiteAjuste: cartao?.limiteAjuste ?? 0,
            limiteConferidoEm: cartao?.limiteConferidoEm ?? null,
          }),
      diaFechamento: fechamento,
      diaVencimento: vencimento,
      imagem: visual === "foto" ? imagem : null,
      logo: visual === "cor" ? logo : null,
    };
    onFechar();
    if (cartao) {
      await atualizar("cartoes", cartao.id, linha);
      if (cartao.larId !== larId) {
        // As compras acompanham o cartão: viram (ou deixam de ser) visíveis para a
        // casa. Em paralelo: um cartão do banco pode ter centenas de lançamentos.
        await Promise.all([
          ...dados.compras
            .filter((x) => x.cartaoId === cartao.id)
            .map((c) => atualizar("compras", c.id, { larId })),
          ...dados.lancamentos
            .filter((l) => l.refTipo === "fatura" && l.refId === cartao.id)
            .map((l) =>
              atualizar("lancamentos", l.id, { larId, perfilId: larId ? null : cartao.perfilId }),
            ),
        ]);
      }
    } else {
      await inserir("cartoes", linha);
    }
    avisar(cartao ? "Cartão atualizado." : "Cartão adicionado.");
  };

  const excluir = () =>
    abrir({
      tipo: "confirmar",
      titulo: `Excluir o cartão "${cartao?.nome}"?`,
      texto: "Todas as compras lançadas nele também são apagadas. Não dá para desfazer.",
      rotulo: "Excluir cartão",
      acao: async () => {
        if (cartao) await removerCartao(cartao.id);
        avisar("Cartão excluído.");
      },
    });

  return (
    <Modal
      titulo={cartao ? "Editar cartão" : "Novo cartão"}
      largura="sm:max-w-[560px]"
      onFechar={onFechar}
      onEnviar={salvar}
      rodape={
        <>
          {cartao && !cartao.externoId && <BotaoExcluir onClick={excluir} />}
          <Botao variante="fantasma" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit">
            Salvar
          </Botao>
        </>
      }
    >
      {/* Prévia ao vivo: o cartão como vai aparecer no app. */}
      <div className="flex justify-center rounded-2xl bg-surface-2 px-4 py-6">
        <CartaoVisual
          className="w-full max-w-76"
          cartao={{
            nome: nome || "Seu cartão",
            banco: banco || nome || "Banco",
            cor,
            larId: daCasa ? "casa" : null,
            imagem: visual === "foto" ? imagem : null,
            logo: visual === "cor" ? logo : null,
          }}
          situacao="Aberta"
          vence={`${String(vencimento).padStart(2, "0")}/--`}
          limiteLivre={limite > 0 ? limite : null}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Campo rotulo="Nome do cartão">
          <Entrada
            autoFocus={!cartao}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Platinum"
            maxLength={24}
          />
        </Campo>
        <Campo rotulo="Banco">
          <Entrada
            value={banco}
            onChange={(e) => setBanco(e.target.value)}
            placeholder="Ex.: Meu banco"
            maxLength={20}
          />
        </Campo>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px]/5 font-medium text-ink-2">Aparência do cartão</span>
          <Segmentado
            rotulo="Aparência do cartão"
            valor={visual}
            onMudar={setVisual}
            opcoes={[
              { valor: "cor", rotulo: "Cor" },
              { valor: "foto", rotulo: "Foto do cartão" },
            ]}
          />
        </div>
        {visual === "cor" ? (
          <>
            <div role="radiogroup" aria-label="Cor do cartão" className="flex flex-wrap gap-2">
              {CORES_CARTAO.map((c, i) => (
                <button
                  key={c.nome}
                  type="button"
                  role="radio"
                  aria-checked={cor === i}
                  aria-label={c.nome}
                  title={c.nome}
                  onClick={() => setCor(i)}
                  className={cx(
                    "h-10 w-14 rounded-lg transition-transform duration-150 hover:scale-105",
                    cor === i && "ring-2 ring-primary ring-offset-2 ring-offset-surface",
                  )}
                  style={{ background: `linear-gradient(135deg, ${c.de}, ${c.ate})` }}
                />
              ))}
            </div>
            <SeletorImagem
              rotulo="Logo do banco (opcional)"
              uso="logo"
              valor={logo}
              onMudar={setLogo}
              onErro={(m) => avisar(m, "erro")}
              dica="Aparece no lugar do nome do banco. Um PNG com fundo transparente fica melhor."
            />
          </>
        ) : (
          <SeletorImagem
            rotulo="Foto do cartão"
            uso="cartao"
            aceitaColar
            valor={imagem}
            onMudar={setImagem}
            onErro={(m) => avisar(m, "erro")}
            dica="Para ficar nítida, use uma imagem com pelo menos 640 px de largura. Um jeito fácil: abra a imagem do cartão no site do banco, tire uma captura de tela do cartão (Windows + Shift + S) e cole aqui. Evite fotos que mostrem o número do cartão: a imagem fica guardada junto com os dados."
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Campo rotulo="Limite total">
          <EntradaValor
            disabled={!!cartao?.externoId}
            valor={limite}
            onMudar={(v) => {
              setLimite(v);
              // Cartão novo, sem compras: o disponível acompanha o total.
              if (!cartao && !mexeuDisponivel) setDisponivel(v);
            }}
          />
        </Campo>
        <Campo rotulo="Disponível agora">
          <EntradaValor
            disabled={!!cartao?.externoId}
            valor={disponivel}
            autoFocus={foco === "limite" && !cartao?.externoId}
            onMudar={(v) => {
              setDisponivel(v);
              setMexeuDisponivel(true);
            }}
          />
        </Campo>
      </div>
      <p className="-mt-2 text-xs leading-5 text-ink-3">
        {cartao?.externoId
          ? "Os dois vêm do banco pelo Open Finance e se atualizam a cada busca."
          : "Copie os dois valores do app do banco. Depois disso, cada compra lançada aqui diminui o disponível e cada fatura paga devolve."}
        {disponivel > limite && limite > 0 && (
          <span className="block text-warn-text">O disponível está maior que o limite total.</span>
        )}
      </p>

      <div className="grid grid-cols-2 gap-4">
        <Campo
          rotulo="Dia do fechamento"
          dica="Compras depois deste dia vão para a fatura seguinte."
        >
          <EntradaNumero valor={fechamento} onMudar={setFechamento} min={1} max={31} />
        </Campo>
        <Campo rotulo="Dia do vencimento">
          <EntradaNumero valor={vencimento} onMudar={setVencimento} min={1} max={31} />
        </Campo>
      </div>

      {lar && (
        <div className="rounded-2xl bg-surface-2 p-4">
          <Alternar
            titulo="Cartão da casa"
            descricao="A fatura entra na divisão das contas da casa e os moradores veem as compras deste cartão."
            ligado={daCasa}
            onMudar={setDaCasa}
          />
        </div>
      )}
    </Modal>
  );
}

/* ───────────────────────── Compra no cartão ───────────────────────── */

export function FormCompra({
  compra,
  cartaoId: cartaoInicial,
  onFechar,
}: {
  compra?: Compra;
  cartaoId?: Id;
  onFechar: () => void;
}) {
  const { dados, sessao, hoje, mes, inserir, atualizar, remover, avisar } = useApp();
  const meus = dados.cartoes.filter((c) => c.perfilId === sessao?.userId);
  const [cartaoId, setCartaoId] = useState<Id>(
    compra?.cartaoId ?? cartaoInicial ?? meus[0]?.id ?? "",
  );
  const [descricao, setDescricao] = useState(compra?.descricao ?? "");
  const [cat, setCat] = useState(compra?.categoria ?? "outros");
  // Enquanto a pessoa não escolhe, a categoria acompanha o que foi digitado.
  const [catEscolhida, setCatEscolhida] = useState(!!compra);
  const [valor, setValor] = useState(compra?.valor ?? 0);
  const [data, setData] = useState(compra?.data ?? hoje);
  const [assinatura, setAssinatura] = useState(compra?.recorrente ?? false);
  const [parcelas, setParcelas] = useState(compra?.parcelas ?? 1);
  const [mesManual, setMesManual] = useState<Mes | null>(compra?.mesPrimeira ?? null);

  const cartao = meus.find((c) => c.id === cartaoId);
  const doBanco = !!compra?.externoId;
  const mesSugerido = cartao && data ? mesPrimeiraFatura(cartao, data) : mes;
  const mesPrimeira = mesManual ?? mesSugerido;
  const cadaParcela =
    !assinatura && parcelas > 1
      ? valorParcela(
          {
            id: "",
            cartaoId,
            perfilId: "",
            larId: null,
            descricao: "",
            valor,
            parcelas,
            recorrente: false,
            mesPrimeira,
            mesFim: null,
            data,
          },
          addMes(mesPrimeira, parcelas - 1),
        )
      : 0;

  const salvar = async () => {
    if (!descricao.trim()) return avisar("Descreva a compra.", "erro");
    // Do banco: valor, fatura e cartão seguem o banco (estorno tem valor
    // negativo); descrição e categoria são suas.
    if (doBanco && compra) {
      onFechar();
      await atualizar("compras", compra.id, { descricao: descricao.trim(), categoria: cat });
      avisar("Compra atualizada.");
      return;
    }
    if (!cartao) return avisar("Escolha um cartão.", "erro");
    if (valor <= 0) return avisar("Informe um valor maior que zero.", "erro");
    const linha: Compra = {
      id: compra?.id ?? novoId(),
      cartaoId: cartao.id,
      perfilId: cartao.perfilId,
      larId: cartao.larId,
      descricao: descricao.trim(),
      valor,
      parcelas: assinatura ? 1 : Math.max(1, parcelas),
      recorrente: assinatura,
      mesPrimeira,
      mesFim: compra?.mesFim ?? null,
      data,
      categoria: cat,
    };
    onFechar();
    if (compra) await atualizar("compras", compra.id, linha);
    else await inserir("compras", linha);
    avisar(compra ? "Compra atualizada." : "Compra lançada.");
  };

  const excluir = async () => {
    if (!compra) return;
    onFechar();
    await remover("compras", compra.id);
    avisar("Compra excluída.");
  };

  const encerrar = async () => {
    if (!compra) return;
    onFechar();
    await atualizar("compras", compra.id, { mesFim: mes });
    avisar(`Assinatura encerrada em ${nomeMes(mes).toLowerCase()}.`);
  };

  return (
    <Modal
      titulo={compra ? "Editar compra" : "Nova compra no cartão"}
      onFechar={onFechar}
      onEnviar={salvar}
      rodape={
        <>
          {compra && !compra.externoId && <BotaoExcluir onClick={excluir} />}
          <Botao variante="fantasma" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit">
            Salvar
          </Botao>
        </>
      }
    >
      {compra?.externoId && (
        <p className="flex items-start gap-2 rounded-lg bg-primary-soft p-4 text-xs leading-5 text-primary-text">
          <Landmark size={16} className="mt-0.5 shrink-0" />
          <span>
            Veio da fatura pelo Open Finance: valor, data e fatura seguem o banco. Descrição e
            categoria são suas. Some daqui só se sair da fatura no banco.
          </span>
        </p>
      )}
      {doBanco && compra && (
        <dl className="grid grid-cols-3 gap-4 rounded-lg border border-line p-4">
          {(
            [
              [compra.valor < 0 ? "Estorno" : "Valor", formatar(Math.abs(compra.valor))],
              ["Data", dataBR(compra.data)],
              ["Fatura", nomeMes(compra.mesPrimeira)],
            ] as const
          ).map(([rotulo, valor]) => (
            <div key={rotulo} className="min-w-0">
              <dt className="text-xs text-ink-3">{rotulo}</dt>
              <dd className="tabular truncate text-[13px]/5 font-semibold text-ink">{valor}</dd>
            </div>
          ))}
        </dl>
      )}
      {!doBanco && (
        <Campo rotulo="Cartão">
          <Selecao
            value={cartaoId}
            onChange={(e) => {
              setCartaoId(e.target.value);
              setMesManual(null);
            }}
          >
            {meus.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
                {c.larId ? " (da casa)" : ""}
              </option>
            ))}
          </Selecao>
        </Campo>
      )}

      <Campo rotulo="Descrição">
        <Entrada
          autoFocus={!compra}
          value={descricao}
          onChange={(e) => {
            setDescricao(e.target.value);
            if (!catEscolhida) setCat(sugerirCategoria(e.target.value));
          }}
          placeholder="Ex.: Mercado, tênis, streaming"
          maxLength={60}
        />
      </Campo>

      <Campo rotulo="Categoria">
        <Selecao
          value={cat}
          onChange={(e) => {
            setCat(e.target.value);
            setCatEscolhida(true);
          }}
        >
          {(CATEGORIAS_DE_COMPRA.some((c) => c.id === cat)
            ? CATEGORIAS_DE_COMPRA
            : [...CATEGORIAS_DE_COMPRA, categoria(cat)]
          ).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Selecao>
      </Campo>

      {!doBanco && (
        <>
          <Segmentado
            cheio
            rotulo="Tipo de cobrança"
            valor={assinatura ? "assinatura" : "compra"}
            onMudar={(v) => setAssinatura(v === "assinatura")}
            opcoes={[
              { valor: "compra", rotulo: "À vista ou parcelada" },
              { valor: "assinatura", rotulo: "Assinatura mensal" },
            ]}
          />

          <div className="grid grid-cols-2 gap-4">
            <Campo rotulo={assinatura ? "Valor por mês" : "Valor total"}>
              <EntradaValor valor={valor} onMudar={setValor} />
            </Campo>
            <Campo rotulo={assinatura ? "Data da primeira cobrança" : "Data da compra"}>
              <Entrada
                type="date"
                value={data}
                onChange={(e) => {
                  setData(e.target.value);
                  setMesManual(null);
                }}
              />
            </Campo>
          </div>

          {!assinatura && (
            <Campo
              rotulo="Parcelas"
              dica={
                parcelas > 1 && valor > 0
                  ? `${parcelas}x de ${formatar(cadaParcela)}, sem juros no cálculo.`
                  : undefined
              }
            >
              <EntradaNumero valor={parcelas} onMudar={setParcelas} min={1} max={48} sufixo="x" />
            </Campo>
          )}

          <Campo
            rotulo="Primeira cobrança na fatura de"
            dica={
              mesManual && mesManual !== mesSugerido
                ? `Pelo fechamento do cartão, seria ${nomeMes(mesSugerido).toLowerCase()}.`
                : "Calculado pela data da compra e pelo fechamento do cartão."
            }
          >
            <SeletorMes valor={mesPrimeira} onMudar={setMesManual} base={mes} />
          </Campo>
        </>
      )}

      {compra?.recorrente && !compra.mesFim && (
        <button
          type="button"
          onClick={encerrar}
          className="w-full rounded-lg border border-dashed border-line-strong px-4 py-4 text-left text-[13px]/5 transition-colors hover:bg-surface-2"
        >
          <span className="font-medium text-ink">Cancelei esta assinatura</span>
          <span className="block text-xs text-ink-3">
            A última cobrança fica em {nomeMes(mes).toLowerCase()} e o histórico é mantido.
          </span>
        </button>
      )}
    </Modal>
  );
}
