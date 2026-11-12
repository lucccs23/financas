"use client";

// Janelas de transação avulsa, carteira e importação de extrato.

import { useMemo, useRef, useState } from "react";
import { EyeOff, FileUp, Landmark, Trash2 } from "lucide-react";
import { useApp } from "@/lib/app";
import { saldoCarteira } from "@/lib/calc-extra";
import { CATEGORIAS, categoria, sugerirCategoria } from "@/lib/categorias";
import { novoId } from "@/lib/dados/backend";
import { formatar } from "@/lib/dinheiro";
import { adivinharColunas, lerCsv, lerExtrato, type Colunas } from "@/lib/importar";
import { dataBR } from "@/lib/meses";
import type { Carteira, Id, TipoCarteira, TipoTransacao, Transacao } from "@/lib/types";
import { TIPOS_CARTEIRA } from "@/lib/carteiras";
import { useModais } from "./modais-contexto";
import {
  Alternar,
  Botao,
  Campo,
  cx,
  Entrada,
  EntradaValor,
  Etiqueta,
  Modal,
  Segmentado,
  Selecao,
  SeletorCor,
} from "./ui";

const CATEGORIAS_ENTRADA = [
  { id: "salario", nome: "Salário" },
  { id: "renda", nome: "Renda extra" },
  { id: "reembolso", nome: "Reembolso" },
  { id: "presente", nome: "Presente" },
  { id: "outros", nome: "Outros" },
];

/* ───────────────────────── Transação ───────────────────────── */

export function FormTransacao({
  transacao,
  tipo: tipoInicial,
  onFechar,
}: {
  transacao?: Transacao;
  tipo?: TipoTransacao;
  onFechar: () => void;
}) {
  const { dados, sessao, hoje, inserir, atualizar, remover, avisar } = useApp();
  const carteiras = dados.carteiras.filter((c) => !c.arquivada || c.id === transacao?.carteiraId);
  const [tipo, setTipo] = useState<TipoTransacao>(transacao?.tipo ?? tipoInicial ?? "saida");
  const [descricao, setDescricao] = useState(transacao?.descricao ?? "");
  const [valor, setValor] = useState(transacao?.valor ?? 0);
  const [data, setData] = useState(transacao?.data ?? hoje);
  const [cat, setCat] = useState(transacao?.categoria ?? "outros");
  const [catEscolhida, setCatEscolhida] = useState(!!transacao);
  const [carteiraId, setCarteiraId] = useState<Id>(transacao?.carteiraId ?? carteiras[0]?.id ?? "");
  const [destinoId, setDestinoId] = useState<Id>(transacao?.carteiraDestinoId ?? "");
  const [observacao, setObservacao] = useState(transacao?.observacao ?? "");
  const [soSaldo, setSoSaldo] = useState(transacao?.soSaldo ?? false);
  const doBanco = !!transacao?.externoId;

  const listaBase = tipo === "entrada" ? CATEGORIAS_ENTRADA : CATEGORIAS;
  // Categoria que não está na lista (ex.: "Transferência", vinda do banco)
  // continua escolhida, em vez de virar "Outros" ao salvar.
  const categorias = listaBase.some((c) => c.id === cat)
    ? listaBase
    : [...listaBase, categoria(cat)];

  const salvar = async () => {
    // Do banco: valor, data, tipo e carteira seguem o banco; o resto é seu.
    if (doBanco && transacao) {
      if (!descricao.trim()) return avisar("Descreva a transação.", "erro");
      onFechar();
      await atualizar("transacoes", transacao.id, {
        descricao: descricao.trim(),
        categoria: cat,
        observacao: observacao.trim(),
        soSaldo,
      });
      avisar("Transação atualizada.");
      return;
    }
    if (valor <= 0) return avisar("Informe um valor maior que zero.", "erro");
    if (tipo !== "transferencia" && !descricao.trim())
      return avisar("Descreva a transação.", "erro");
    if (tipo === "transferencia" && (!carteiraId || !destinoId || carteiraId === destinoId)) {
      return avisar("Escolha duas carteiras diferentes para a transferência.", "erro");
    }
    const origem = carteiras.find((c) => c.id === carteiraId);
    const destino = carteiras.find((c) => c.id === destinoId);
    const linha: Transacao = {
      id: transacao?.id ?? novoId(),
      perfilId: transacao?.perfilId ?? sessao?.userId ?? "",
      data,
      descricao:
        tipo === "transferencia"
          ? descricao.trim() || `${origem?.nome ?? ""} → ${destino?.nome ?? ""}`
          : descricao.trim(),
      valor,
      tipo,
      categoria: tipo === "transferencia" ? "transferencia" : cat,
      carteiraId: carteiraId || null,
      carteiraDestinoId: tipo === "transferencia" ? destinoId : null,
      observacao: observacao.trim(),
      soSaldo: tipo !== "transferencia" && soSaldo,
    };
    onFechar();
    if (transacao) await atualizar("transacoes", transacao.id, linha);
    else await inserir("transacoes", linha);
    avisar(transacao ? "Transação atualizada." : "Transação lançada.");
  };

  const excluir = async () => {
    if (!transacao) return;
    onFechar();
    await remover("transacoes", transacao.id);
    avisar("Transação excluída.");
  };

  // O que veio do banco voltaria na próxima busca se fosse excluído: em vez
  // disso, sai do resumo do mês e fica só no extrato e no saldo.
  const tirarDoResumo = async () => {
    if (!transacao) return;
    onFechar();
    await atualizar("transacoes", transacao.id, { soSaldo: true });
    avisar("Fora do resumo do mês. Continua no extrato e no saldo da carteira.");
  };

  return (
    <Modal
      titulo={transacao ? "Editar transação" : "Nova transação"}
      descricao={
        transacao
          ? undefined
          : "Gastos e entradas do dia a dia: lanche, Uber, Pix recebido. Contas fixas e compras no cartão têm o próprio lugar."
      }
      onFechar={onFechar}
      onEnviar={salvar}
      rodape={
        <>
          {transacao && doBanco && !transacao.soSaldo && (
            <Botao variante="fantasma" onClick={tirarDoResumo} className="mr-auto">
              <EyeOff size={16} />
              Tirar do resumo
            </Botao>
          )}
          {transacao && !doBanco && (
            <Botao variante="fantasma" onClick={excluir} className="mr-auto !text-bad-text">
              <Trash2 size={16} />
              Excluir
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
      {transacao?.externoId && (
        <p className="flex items-start gap-2 rounded-lg bg-primary-soft p-4 text-xs leading-5 text-primary-text">
          <Landmark size={16} className="mt-0.5 shrink-0" />
          <span>
            Veio do banco pelo Open Finance: valor, data e carteira seguem o banco. Descrição,
            categoria e anotação são suas.
          </span>
        </p>
      )}
      {doBanco && transacao ? (
        <ResumoDoBanco
          itens={[
            [transacao.tipo === "entrada" ? "Entrou" : "Saiu", formatar(transacao.valor)],
            ["Data", dataBR(transacao.data)],
            ["Carteira", carteiras.find((c) => c.id === transacao.carteiraId)?.nome ?? "—"],
          ]}
        />
      ) : (
        <>
          <Segmentado
            cheio
            rotulo="Tipo"
            valor={tipo}
            onMudar={(v) => {
              setTipo(v);
              if (!catEscolhida) setCat(v === "entrada" ? "renda" : "outros");
            }}
            opcoes={[
              { valor: "saida", rotulo: "Saída" },
              { valor: "entrada", rotulo: "Entrada" },
              { valor: "transferencia", rotulo: "Transferência", desativado: carteiras.length < 2 },
            ]}
          />

          <div className="grid grid-cols-2 gap-4">
            <Campo rotulo="Valor">
              <EntradaValor valor={valor} onMudar={setValor} autoFocus={!transacao} />
            </Campo>
            <Campo rotulo="Data">
              <Entrada type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </Campo>
          </div>
        </>
      )}

      <Campo rotulo={tipo === "transferencia" ? "Descrição (opcional)" : "Descrição"}>
        <Entrada
          value={descricao}
          onChange={(e) => {
            setDescricao(e.target.value);
            if (!catEscolhida && tipo === "saida") setCat(sugerirCategoria(e.target.value));
          }}
          placeholder={tipo === "entrada" ? "Ex.: Pix do freela" : "Ex.: Almoço, Uber, padaria"}
          maxLength={60}
        />
      </Campo>

      {tipo !== "transferencia" && (
        <Campo rotulo="Categoria">
          <Selecao
            value={categorias.some((c) => c.id === cat) ? cat : "outros"}
            onChange={(e) => {
              setCat(e.target.value);
              setCatEscolhida(true);
            }}
          >
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Selecao>
        </Campo>
      )}

      {tipo === "transferencia" ? (
        <div className="grid grid-cols-2 gap-4">
          <Campo rotulo="Sai de">
            <Selecao value={carteiraId} onChange={(e) => setCarteiraId(e.target.value)}>
              {carteiras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Selecao>
          </Campo>
          <Campo rotulo="Vai para">
            <Selecao value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
              <option value="">Escolha</option>
              {carteiras
                .filter((c) => c.id !== carteiraId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
            </Selecao>
          </Campo>
        </div>
      ) : (
        !doBanco &&
        carteiras.length > 0 && (
          <Campo
            rotulo={tipo === "entrada" ? "Entrou em" : "Saiu de"}
            dica="Atualiza o saldo da carteira em Carteiras."
          >
            <Selecao value={carteiraId} onChange={(e) => setCarteiraId(e.target.value)}>
              <option value="">Nenhuma carteira</option>
              {carteiras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Selecao>
          </Campo>
        )
      )}

      <Campo rotulo="Anotação (opcional)">
        <Entrada
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          maxLength={120}
        />
      </Campo>

      {tipo !== "transferencia" && (
        <Alternar
          ligado={soSaldo}
          onMudar={setSoSaldo}
          titulo="Só mexe no saldo"
          descricao="Fica no extrato e no saldo da carteira, mas fora do resumo do mês. Para pagamento de fatura, dinheiro entre contas suas ou algo que já conta em Contas."
        />
      )}
    </Modal>
  );
}

function ResumoDoBanco({ itens }: { itens: [string, string][] }) {
  return (
    <dl className="grid grid-cols-3 gap-4 rounded-lg border border-line p-4">
      {itens.map(([rotulo, valor]) => (
        <div key={rotulo} className="min-w-0">
          <dt className="text-xs text-ink-3">{rotulo}</dt>
          <dd className="tabular truncate text-[13px]/5 font-semibold text-ink">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ───────────────────────── Carteira ───────────────────────── */

export function FormCarteira({
  carteira,
  onFechar,
}: {
  carteira?: Carteira;
  onFechar: () => void;
}) {
  const { dados, sessao, hoje, inserir, atualizar, remover, avisar } = useApp();
  const { abrir } = useModais();
  const [nome, setNome] = useState(carteira?.nome ?? "");
  const [tipo, setTipo] = useState<TipoCarteira>(carteira?.tipo ?? "corrente");
  const [cor, setCor] = useState(carteira?.cor ?? 0);
  const saldoAtual = carteira ? saldoCarteira(carteira, dados.transacoes) : 0;
  const [saldo, setSaldo] = useState(carteira ? saldoAtual : 0);
  const [arquivada, setArquivada] = useState(carteira?.arquivada ?? false);
  const negativo = useRef(false);

  const salvar = async () => {
    if (!nome.trim()) return avisar("Dê um nome para a carteira.", "erro");
    const valorSaldo = negativo.current ? -saldo : saldo;
    onFechar();
    if (!carteira) {
      await inserir("carteiras", {
        id: novoId(),
        perfilId: sessao?.userId ?? "",
        nome: nome.trim(),
        tipo,
        saldoInicial: valorSaldo,
        cor,
        arquivada: false,
      });
      avisar("Carteira criada.");
      return;
    }
    await atualizar("carteiras", carteira.id, { nome: nome.trim(), tipo, cor, arquivada });
    // Mudar o saldo vira um ajuste lançado hoje, para o histórico continuar certo.
    const diferenca = valorSaldo - saldoAtual;
    if (diferenca !== 0) {
      await inserir("transacoes", {
        id: novoId(),
        perfilId: carteira.perfilId,
        data: hoje,
        descricao: "Ajuste de saldo",
        valor: Math.abs(diferenca),
        tipo: diferenca > 0 ? "entrada" : "saida",
        categoria: "ajuste",
        carteiraId: carteira.id,
        carteiraDestinoId: null,
        observacao: "Correção do saldo feita na carteira.",
      });
    }
    avisar("Carteira atualizada.");
  };

  const excluir = () => {
    if (!carteira) return;
    const usadas = dados.transacoes.filter(
      (t) => t.carteiraId === carteira.id || t.carteiraDestinoId === carteira.id,
    ).length;
    abrir({
      tipo: "confirmar",
      titulo: `Excluir a carteira "${carteira.nome}"?`,
      texto: usadas
        ? `As ${usadas} transações dela continuam no extrato, sem carteira. Se só quiser tirar do saldo total, prefira "Arquivar".`
        : "Não dá para desfazer.",
      rotulo: "Excluir carteira",
      acao: async () => {
        // Em paralelo: no modo GitHub vira uma gravação só.
        await Promise.all(
          dados.transacoes.flatMap((t) => [
            ...(t.carteiraId === carteira.id
              ? [atualizar("transacoes", t.id, { carteiraId: null })]
              : []),
            ...(t.carteiraDestinoId === carteira.id
              ? [atualizar("transacoes", t.id, { carteiraDestinoId: null })]
              : []),
          ]),
        );
        await remover("carteiras", carteira.id);
        avisar("Carteira excluída.");
      },
    });
  };

  return (
    <Modal
      titulo={carteira ? "Editar carteira" : "Nova carteira"}
      descricao={
        carteira
          ? undefined
          : "Uma conta no banco, a poupança, o dinheiro na carteira ou um investimento."
      }
      onFechar={onFechar}
      onEnviar={salvar}
      rodape={
        <>
          {carteira && !carteira.externoId && (
            <Botao variante="fantasma" onClick={excluir} className="mr-auto !text-bad-text">
              <Trash2 size={16} />
              Excluir
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
      <Campo rotulo="Nome">
        <Entrada
          autoFocus={!carteira}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Conta do banco, Carteira"
          maxLength={30}
        />
      </Campo>
      <Campo rotulo="Tipo">
        <Selecao value={tipo} onChange={(e) => setTipo(e.target.value as TipoCarteira)}>
          {TIPOS_CARTEIRA.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </Selecao>
      </Campo>
      <Campo
        rotulo={carteira ? "Saldo hoje" : "Saldo atual"}
        dica={
          carteira?.externoId
            ? "Vem do banco pelo Open Finance e se atualiza a cada busca."
            : carteira
              ? "Se o saldo do banco estiver diferente, corrija aqui: a diferença vira um ajuste no extrato."
              : "Quanto tem nela hoje. Daqui pra frente, as transações atualizam o saldo."
        }
      >
        <EntradaValor valor={saldo} onMudar={setSaldo} disabled={!!carteira?.externoId} />
      </Campo>
      <div>
        <span className="mb-2 block text-[13px]/5 font-medium text-ink-2">Cor</span>
        <SeletorCor valor={cor} onMudar={setCor} />
      </div>
      {carteira && (
        <div className="px-1">
          <Alternar
            titulo="Arquivar"
            descricao={
              carteira.externoId
                ? "Some do saldo total e das listas, mas o histórico fica. Ela continua vindo do banco; para parar de vez, tire a conexão no GitHub."
                : "Some do saldo total e das listas, mas o histórico fica."
            }
            ligado={arquivada}
            onMudar={setArquivada}
          />
        </div>
      )}
    </Modal>
  );
}

/* ───────────────────────── Importar extrato ───────────────────────── */

async function lerTexto(arquivo: File): Promise<string> {
  const bytes = await arquivo.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export function FormImportarExtrato({ onFechar }: { onFechar: () => void }) {
  const { dados, sessao, inserir, avisar } = useApp();
  const carteiras = dados.carteiras.filter((c) => !c.arquivada);
  const [carteiraId, setCarteiraId] = useState<Id>(carteiras[0]?.id ?? "");
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [tabela, setTabela] = useState<string[][] | null>(null);
  const [colunas, setColunas] = useState<Colunas>({ data: 0, descricao: 1, valor: 2 });
  const [cabecalho, setCabecalho] = useState(true);
  const [inverter, setInverter] = useState(false);
  const [ajustes, setAjustes] = useState<Record<number, { incluir?: boolean; categoria?: string }>>(
    {},
  );
  const [ocupado, setOcupado] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  const escolher = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    const linhas = lerCsv(await lerTexto(arquivo));
    const palpite = adivinharColunas(linhas);
    const lido = lerExtrato(linhas, palpite.colunas, palpite.cabecalho);
    if (!lido.linhas.length) return avisar("Não achei movimentações nesse arquivo.", "erro");
    setNomeArquivo(arquivo.name);
    setTabela(linhas);
    setColunas(palpite.colunas);
    setCabecalho(palpite.cabecalho);
    setAjustes({});
  };

  const linhas = useMemo(() => {
    if (!tabela) return [];
    const chave = (d: string, v: number, s: string) =>
      `${d}|${v}|${s.toLowerCase().replace(/\s+/g, " ")}`;
    const existentes = new Set(dados.transacoes.map((t) => chave(t.data, t.valor, t.descricao)));
    return lerExtrato(tabela, colunas, cabecalho, inverter).linhas.map((l, i) => {
      const duplicada = existentes.has(chave(l.data, l.valor, l.descricao));
      return { ...l, duplicada, incluir: !duplicada, ...ajustes[i] };
    });
  }, [tabela, colunas, cabecalho, inverter, ajustes, dados.transacoes]);

  const escolhidas = linhas.filter((l) => l.incluir);
  const saidas = escolhidas.filter((l) => l.tipo === "saida").reduce((s, l) => s + l.valor, 0);
  const entradas = escolhidas.filter((l) => l.tipo === "entrada").reduce((s, l) => s + l.valor, 0);

  const importar = async () => {
    if (!escolhidas.length) return;
    setOcupado(true);
    // Em paralelo: no modo GitHub vira uma gravação só.
    await Promise.all(
      escolhidas.map((l) =>
        inserir("transacoes", {
          id: novoId(),
          perfilId: sessao?.userId ?? "",
          data: l.data,
          descricao: l.descricao,
          valor: l.valor,
          tipo: l.tipo,
          categoria: l.categoria,
          carteiraId: carteiraId || null,
          carteiraDestinoId: null,
          observacao: "",
        }),
      ),
    );
    setOcupado(false);
    onFechar();
    avisar(`${escolhidas.length} transações importadas.`);
  };

  const nomesColunas = (tabela?.[0] ?? []).map((n, i) => (cabecalho && n ? n : `Coluna ${i + 1}`));

  return (
    <Modal
      titulo="Importar extrato"
      descricao="Use o arquivo CSV do extrato da conta, que o banco gera no app ou no site."
      onFechar={onFechar}
      onEnviar={importar}
      largura="sm:max-w-[760px]"
      rodape={
        <>
          {tabela && (
            <span className="tabular mr-auto text-[13px]/5 text-ink-3">
              {escolhidas.length} · entradas {formatar(entradas)} · saídas {formatar(saidas)}
            </span>
          )}
          <Botao variante="fantasma" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" disabled={!escolhidas.length || ocupado}>
            {ocupado ? "Importando..." : "Importar"}
          </Botao>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          rotulo="Carteira"
          dica={
            carteiras.length
              ? undefined
              : "Crie uma carteira em Carteiras para os saldos acompanharem."
          }
        >
          <Selecao value={carteiraId} onChange={(e) => setCarteiraId(e.target.value)}>
            <option value="">Nenhuma carteira</option>
            {carteiras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Selecao>
        </Campo>
        <Campo rotulo="Arquivo">
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            className="flex h-12 w-full items-center gap-2 rounded-lg border border-dashed border-line-strong bg-surface-2 px-4 text-left text-sm text-ink-2 transition-colors hover:bg-surface-3"
          >
            <FileUp size={16} className="shrink-0 text-ink-3" />
            <span className="truncate">{nomeArquivo || "Escolher arquivo .csv"}</span>
          </button>
          <input
            ref={entrada}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              void escolher(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </Campo>
      </div>

      {tabela && (
        <>
          <details className="group rounded-2xl border border-line px-4 py-4">
            <summary className="cursor-pointer list-none text-[13px]/5 text-ink-2 [&::-webkit-details-marker]:hidden">
              <span className="font-medium text-ink">Colunas do arquivo:</span>{" "}
              {nomesColunas[colunas.data]}, {nomesColunas[colunas.descricao]} e{" "}
              {nomesColunas[colunas.valor]}.{" "}
              <span className="font-medium text-primary-text group-open:hidden">Ajustar</span>
            </summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {(["data", "descricao", "valor"] as const).map((campo) => (
                <Campo
                  key={campo}
                  rotulo={campo === "data" ? "Data" : campo === "descricao" ? "Descrição" : "Valor"}
                >
                  <Selecao
                    value={colunas[campo]}
                    onChange={(e) => {
                      setColunas((c) => ({ ...c, [campo]: Number(e.target.value) }));
                      setAjustes({});
                    }}
                  >
                    {nomesColunas.map((n, i) => (
                      <option key={i} value={i}>
                        {n}
                      </option>
                    ))}
                  </Selecao>
                </Campo>
              ))}
            </div>
            <div className="mt-4 space-y-4">
              <Alternar
                titulo="Primeira linha é o cabeçalho"
                ligado={cabecalho}
                onMudar={setCabecalho}
              />
              <Alternar
                titulo="Inverter entradas e saídas"
                descricao="Para bancos que mostram os gastos como valores positivos."
                ligado={inverter}
                onMudar={setInverter}
              />
            </div>
          </details>

          <ul className="divide-y divide-line rounded-2xl border border-line">
            {linhas.map((l, i) => (
              <li
                key={i}
                className={cx(
                  "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2",
                  !l.incluir && "opacity-55",
                )}
              >
                <input
                  type="checkbox"
                  aria-label={`Importar ${l.descricao}`}
                  checked={l.incluir}
                  onChange={(e) =>
                    setAjustes((a) => ({ ...a, [i]: { ...a[i], incluir: e.target.checked } }))
                  }
                  className="h-4 w-4 shrink-0 accent-[var(--primary)]"
                />
                <span className="min-w-0 flex-1 basis-40">
                  <span className="block truncate text-sm font-medium text-ink">{l.descricao}</span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                    {dataBR(l.data)}
                    {l.duplicada && <Etiqueta tom="alerta">já lançada</Etiqueta>}
                  </span>
                </span>
                {l.tipo === "saida" ? (
                  <select
                    aria-label={`Categoria de ${l.descricao}`}
                    value={l.categoria}
                    onChange={(e) =>
                      setAjustes((a) => ({ ...a, [i]: { ...a[i], categoria: e.target.value } }))
                    }
                    className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-ink-2 outline-none focus:border-primary"
                  >
                    {CATEGORIAS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Etiqueta tom="bom">entrada</Etiqueta>
                )}
                <span
                  className={cx(
                    "tabular min-w-[96px] text-right text-sm font-semibold whitespace-nowrap",
                    l.tipo === "entrada" ? "text-good-text" : "text-ink",
                  )}
                >
                  {l.tipo === "entrada" ? "+ " : ""}
                  {formatar(l.valor)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
