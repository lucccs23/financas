"use client";

// Importar a fatura do cartão a partir do arquivo CSV que o banco exporta.
// Passo 1: escolher o cartão e o arquivo. Passo 2: conferir a prévia.

import { useMemo, useRef, useState } from "react";
import { FileUp, Upload } from "lucide-react";
import { useApp } from "@/lib/app";
import { mesPrimeiraFatura, valorParcela } from "@/lib/calc";
import { CATEGORIAS } from "@/lib/categorias";
import { novoId } from "@/lib/dados/backend";
import { formatar } from "@/lib/dinheiro";
import {
  adivinharColunas,
  lerCsv,
  lerFatura,
  lerFaturaTexto,
  type Colunas,
  type FaturaPdf,
  type LinhaImportada,
} from "@/lib/importar";
import { SenhaDoPdf, textoDoPdf } from "@/lib/pdf";
import { addMes, dataBR, nomeMes } from "@/lib/meses";
import type { Compra, Id, Mes } from "@/lib/types";
import { SeletorMes } from "./formularios-contas";
import { Alternar, Botao, Campo, cx, Entrada, Etiqueta, Modal, Selecao } from "./ui";

/** Tira "Parcela 2/10" e parecidos do nome, para a mesma compra ser reconhecida nos próximos meses. */
function semParcela(descricao: string): string {
  return descricao
    .replace(/\s*[-–]?\s*parc(?:ela)?\.?\s*\d{1,2}\s*(?:\/|de)\s*\d{1,2}\s*$/i, "")
    .replace(/\s*\(?\d{1,2}\s*(?:\/|de)\s*\d{1,2}\)?\s*$/i, "")
    .trim();
}

const normal = (t: string) => semParcela(t).toLowerCase().replace(/\s+/g, " ");

/** Arquivos de banco costumam vir em UTF-8 ou em Windows-1252 (acentos antigos). */
async function lerTexto(arquivo: File): Promise<string> {
  const bytes = await arquivo.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

interface Linha extends LinhaImportada {
  incluir: boolean;
  duplicada: boolean;
}

export function FormImportar({
  cartaoId: inicial,
  onFechar,
}: {
  cartaoId?: Id;
  onFechar: () => void;
}) {
  const { dados, sessao, mes, hoje, inserir, avisar } = useApp();
  const meus = dados.cartoes.filter((c) => c.perfilId === sessao?.userId);
  const [cartaoId, setCartaoId] = useState<Id>(
    meus.some((c) => c.id === inicial) ? (inicial as Id) : (meus[0]?.id ?? ""),
  );
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [tabela, setTabela] = useState<string[][] | null>(null);
  // Fatura em PDF: as compras já saem lidas do texto do documento.
  const [pdf, setPdf] = useState<FaturaPdf | null>(null);
  const [arquivoComSenha, setArquivoComSenha] = useState<File | null>(null);
  const [senha, setSenha] = useState("");
  const [lendo, setLendo] = useState(false);
  const [colunas, setColunas] = useState<Colunas>({ data: 0, descricao: 1, valor: 2 });
  const [cabecalho, setCabecalho] = useState(true);
  const [fatura, setFatura] = useState<Mes>(mes);
  const [projetar, setProjetar] = useState(true);
  const [ajustes, setAjustes] = useState<Record<number, Partial<Linha>>>({});
  const [ocupado, setOcupado] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  const cartao = meus.find((c) => c.id === cartaoId);

  /** Usa a fatura lida: escolhe o mês pela compra mais recente e mostra a prévia. */
  const usarLidas = (nome: string, lidas: LinhaImportada[]) => {
    if (!cartao) return;
    const compras = lidas.filter((l) => l.valor > 0);
    const ultima = (compras.length ? compras : lidas)
      .map((l) => l.data)
      .sort()
      .at(-1) as string;
    setNomeArquivo(nome);
    setFatura(mesPrimeiraFatura(cartao, ultima));
    setAjustes({});
  };

  const abrirPdf = async (arquivo: File, comSenha?: string) => {
    setLendo(true);
    try {
      const lido = lerFaturaTexto(await textoDoPdf(arquivo, comSenha), hoje);
      if (!lido.linhas.length) {
        avisar(
          "Não achei compras nesse PDF. Ele precisa ser a fatura com a lista de lançamentos.",
          "erro",
        );
        return;
      }
      setArquivoComSenha(null);
      setSenha("");
      setTabela(null);
      setPdf(lido);
      usarLidas(arquivo.name, lido.linhas);
    } catch (e) {
      if (e instanceof SenhaDoPdf) {
        setArquivoComSenha(arquivo);
        setNomeArquivo(arquivo.name);
        if (e.incorreta) avisar("Senha incorreta. Tente de novo.", "erro");
        return;
      }
      avisar(e instanceof Error ? e.message : "Não consegui ler esse PDF.", "erro");
    } finally {
      setLendo(false);
    }
  };

  const escolher = async (arquivo: File | undefined) => {
    if (!arquivo || !cartao) return;
    if (arquivo.type === "application/pdf" || /\.pdf$/i.test(arquivo.name)) {
      await abrirPdf(arquivo);
      return;
    }
    setPdf(null);
    setArquivoComSenha(null);
    const texto = await lerTexto(arquivo);
    const linhas = lerCsv(texto);
    if (linhas.length < 1) return avisar("O arquivo está vazio.", "erro");
    const palpite = adivinharColunas(linhas);
    const lido = lerFatura(linhas, palpite.colunas, palpite.cabecalho);
    if (!lido.linhas.length) {
      return avisar("Não achei compras nesse arquivo. Confira se é o CSV da fatura.", "erro");
    }
    // A fatura é a da compra mais recente do arquivo, pelo fechamento do cartão.
    setTabela(linhas);
    setColunas(palpite.colunas);
    setCabecalho(palpite.cabecalho);
    usarLidas(arquivo.name, lido.linhas);
  };

  const linhas: Linha[] = useMemo(() => {
    if ((!tabela && !pdf) || !cartaoId) return [];
    const existentes = dados.compras.filter((c) => c.cartaoId === cartaoId);
    const fonte = pdf ? pdf.linhas : lerFatura(tabela ?? [], colunas, cabecalho).linhas;
    return fonte.map((l, i) => {
      // Parcela: a mesma compra já cai nesta fatura. À vista: mesma compra, mesmo dia e valor.
      const duplicada = existentes.some(
        (c) =>
          normal(c.descricao) === normal(l.descricao) &&
          (l.parcela
            ? valorParcela(c, fatura) === Math.abs(l.valor)
            : c.data === l.data && c.parcelas <= 1 && c.valor === Math.abs(l.valor)),
      );
      return { ...l, incluir: l.valor > 0 && !duplicada, duplicada, ...ajustes[i] };
    });
  }, [tabela, pdf, colunas, cabecalho, cartaoId, dados.compras, fatura, ajustes]);

  const escolhidas = linhas.filter((l) => l.incluir && l.valor > 0);
  const total = escolhidas.reduce((s, l) => s + l.valor, 0);
  const ajustar = (i: number, m: Partial<Linha>) =>
    setAjustes((a) => ({ ...a, [i]: { ...a[i], ...m } }));

  const importar = async () => {
    if (!cartao || !escolhidas.length) return;
    setOcupado(true);
    // Em paralelo: no modo GitHub vira uma gravação só.
    const novas = escolhidas.map((l): Compra => {
      const parcelado = projetar && l.parcela;
      const compra: Compra = {
        id: novoId(),
        cartaoId: cartao.id,
        perfilId: cartao.perfilId,
        larId: cartao.larId,
        descricao: semParcela(l.descricao) || l.descricao,
        valor: parcelado ? l.valor * l.parcela!.total : l.valor,
        parcelas: parcelado ? l.parcela!.total : 1,
        recorrente: false,
        mesPrimeira: parcelado ? addMes(fatura, -(l.parcela!.numero - 1)) : fatura,
        mesFim: null,
        data: l.data,
        categoria: l.categoria,
      };
      return compra;
    });
    await Promise.all(novas.map((c) => inserir("compras", c)));
    setOcupado(false);
    onFechar();
    avisar(
      `${escolhidas.length} compras importadas na fatura de ${nomeMes(fatura).toLowerCase()}.`,
    );
  };

  const nomesColunas = (tabela?.[0] ?? []).map((n, i) => (cabecalho && n ? n : `Coluna ${i + 1}`));

  return (
    <Modal
      titulo="Importar fatura"
      descricao="Use o PDF ou o CSV da fatura que o banco gera no app ou no site. O arquivo é lido aqui mesmo, sem ser enviado para lugar nenhum."
      onFechar={onFechar}
      onEnviar={importar}
      largura="sm:max-w-[760px]"
      rodape={
        <>
          {(tabela || pdf) && (
            <span className="tabular mr-auto text-[13px]/5 text-ink-3">
              {escolhidas.length} compras · {formatar(total)}
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
      {meus.length === 0 ? (
        <p className="text-sm text-ink-2">Cadastre um cartão seu antes de importar.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Cartão">
              <Selecao value={cartaoId} onChange={(e) => setCartaoId(e.target.value)}>
                {meus.map((c) => (
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
                <span className="truncate">
                  {lendo ? "Lendo o arquivo..." : nomeArquivo || "Escolher PDF ou CSV"}
                </span>
              </button>
              <input
                ref={entrada}
                type="file"
                accept=".pdf,.csv,application/pdf,text/csv,text/plain"
                className="hidden"
                onChange={(e) => {
                  void escolher(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </Campo>
          </div>

          {arquivoComSenha && (
            <div className="space-y-4 rounded-2xl bg-surface-2 p-4">
              <p className="text-[13px]/5 text-ink-2">
                Este PDF tem senha. Muitos bancos usam parte do CPF; a senha fica só neste aparelho,
                para abrir o arquivo.
              </p>
              <div className="flex gap-2">
                <Entrada
                  type="password"
                  autoFocus
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void abrirPdf(arquivoComSenha, senha);
                    }
                  }}
                  placeholder="Senha do PDF"
                  aria-label="Senha do PDF"
                />
                <Botao onClick={() => abrirPdf(arquivoComSenha, senha)} disabled={!senha || lendo}>
                  Abrir
                </Botao>
              </div>
            </div>
          )}

          {pdf?.totalInformado != null && (
            <p
              className={cx(
                "tabular rounded-2xl px-4 py-2 text-[13px]/5",
                linhas.filter((l) => l.valor > 0).reduce((s, l) => s + l.valor, 0) ===
                  pdf.totalInformado
                  ? "bg-good-soft text-good-text"
                  : "bg-warn-soft text-warn-text",
              )}
            >
              Total da fatura no PDF: {formatar(pdf.totalInformado)} · soma das compras lidas:{" "}
              {formatar(linhas.filter((l) => l.valor > 0).reduce((s, l) => s + l.valor, 0))}
              {linhas.filter((l) => l.valor > 0).reduce((s, l) => s + l.valor, 0) ===
              pdf.totalInformado
                ? " · tudo certo"
                : " · confira se faltou alguma compra"}
            </p>
          )}

          {!tabela && !pdf ? (
            <div className="flex items-start gap-4 rounded-2xl bg-surface-2 p-4 text-[13px] leading-5 text-ink-3">
              <Upload size={16} className="mt-0.5 shrink-0" />
              <p>
                O app tenta reconhecer sozinho a data, a descrição e o valor de cada compra, e
                sugere uma categoria pelo nome da loja. Você confere tudo antes de importar. Compras
                que já estão lançadas aparecem desmarcadas.
              </p>
            </div>
          ) : (
            <>
              {tabela && (
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
                        rotulo={
                          campo === "data"
                            ? "Coluna da data"
                            : campo === "descricao"
                              ? "Coluna da descrição"
                              : "Coluna do valor"
                        }
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
                </details>
              )}

              <div className="grid gap-4 rounded-2xl bg-surface-2 p-4 sm:grid-cols-2">
                <Campo
                  rotulo="Entra na fatura de"
                  dica="Calculado pela compra mais recente do arquivo."
                >
                  <SeletorMes valor={fatura} onMudar={setFatura} base={mes} />
                </Campo>
                <div className="space-y-4 sm:pt-6">
                  <Alternar
                    titulo="Projetar parcelas futuras"
                    descricao='Uma compra "3/10" já aparece nas faturas dos próximos meses.'
                    ligado={projetar}
                    onMudar={setProjetar}
                  />
                  {tabela && (
                    <Alternar
                      titulo="Primeira linha é o cabeçalho"
                      ligado={cabecalho}
                      onMudar={(v) => {
                        setCabecalho(v);
                        setAjustes({});
                      }}
                    />
                  )}
                </div>
              </div>

              <ul className="divide-y divide-line rounded-2xl border border-line">
                {linhas.map((l, i) => {
                  const credito = l.valor <= 0;
                  return (
                    <li
                      key={i}
                      className={cx(
                        "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2",
                        (!l.incluir || credito) && "opacity-55",
                      )}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Importar ${l.descricao}`}
                        checked={l.incluir && !credito}
                        disabled={credito}
                        onChange={(e) => ajustar(i, { incluir: e.target.checked })}
                        className="h-4 w-4 shrink-0 accent-[var(--primary)]"
                      />
                      <span className="min-w-0 flex-1 basis-40">
                        <span className="block truncate text-sm font-medium text-ink">
                          {l.descricao}
                        </span>
                        <span className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                          {dataBR(l.data)}
                          {l.parcela && (
                            <Etiqueta>
                              {l.parcela.numero}/{l.parcela.total}
                            </Etiqueta>
                          )}
                          {credito && <Etiqueta>pagamento ou estorno</Etiqueta>}
                          {l.duplicada && <Etiqueta tom="alerta">já lançada</Etiqueta>}
                        </span>
                      </span>
                      <select
                        aria-label={`Categoria de ${l.descricao}`}
                        value={l.categoria}
                        disabled={credito}
                        onChange={(e) => ajustar(i, { categoria: e.target.value })}
                        className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-ink-2 outline-none focus:border-primary"
                      >
                        {CATEGORIAS.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome}
                          </option>
                        ))}
                      </select>
                      <span className="tabular min-w-[96px] text-right text-sm font-semibold whitespace-nowrap text-ink">
                        {formatar(l.valor)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
