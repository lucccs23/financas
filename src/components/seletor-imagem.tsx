"use client";
/* eslint-disable @next/next/no-img-element -- prévia de data URL */

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2, TriangleAlert } from "lucide-react";
import { prepararImagem, type UsoImagem } from "@/lib/imagem";
import { Botao, cx } from "./ui";

/** Escolher, colar, trocar e remover uma imagem. A imagem já sai pronta (recortada e leve). */
export function SeletorImagem({
  valor,
  onMudar,
  uso,
  rotulo,
  dica,
  onErro,
  formato = "largo",
  aceitaColar = false,
}: {
  valor: string | null;
  onMudar: (dataUrl: string | null) => void;
  uso: UsoImagem;
  rotulo: string;
  dica?: string;
  onErro: (mensagem: string) => void;
  formato?: "largo" | "quadrado";
  /** Aceita Ctrl+V com uma imagem copiada (ex.: captura de tela). Use em um seletor por janela. */
  aceitaColar?: boolean;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [preparando, setPreparando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const usar = async (arquivo: Blob | undefined | null) => {
    if (!arquivo) return;
    setPreparando(true);
    try {
      const pronta = await prepararImagem(arquivo, uso);
      onMudar(pronta.dataUrl);
      setAviso(
        pronta.pequena
          ? `Essa imagem é pequena (${pronta.larguraOriginal} px de largura) e vai aparecer borrada. Procure uma versão maior: o ideal é ter pelo menos ${uso === "cartao" ? "640" : "120"} px.`
          : null,
      );
    } catch (e) {
      onErro(e instanceof Error ? e.message : "Não foi possível usar essa imagem.");
    } finally {
      setPreparando(false);
    }
  };

  // Colar com Ctrl+V: pega a primeira imagem da área de transferência.
  const usarRef = useRef(usar);
  useEffect(() => {
    usarRef.current = usar;
  });
  useEffect(() => {
    if (!aceitaColar) return;
    const aoColar = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      if (!item) return;
      e.preventDefault();
      void usarRef.current(item.getAsFile());
    };
    document.addEventListener("paste", aoColar);
    return () => document.removeEventListener("paste", aoColar);
  }, [aceitaColar]);

  return (
    <div>
      <span className="mb-2 block text-[13px]/5 font-medium text-ink-2">{rotulo}</span>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            void usar(e.dataTransfer.files?.[0]);
          }}
          aria-label={valor ? `Trocar ${rotulo.toLowerCase()}` : `Escolher ${rotulo.toLowerCase()}`}
          className={cx(
            "relative grid shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed transition-colors",
            formato === "quadrado" ? "h-16 w-16" : "h-12 w-28",
            arrastando ? "border-primary bg-primary-soft" : "border-line-strong bg-surface-2 hover:bg-surface-3",
          )}
          style={
            valor
              ? {
                  backgroundImage:
                    "linear-gradient(45deg, var(--surface-3) 25%, transparent 25%, transparent 75%, var(--surface-3) 75%), linear-gradient(45deg, var(--surface-3) 25%, transparent 25%, transparent 75%, var(--surface-3) 75%)",
                  backgroundSize: "12px 12px",
                  backgroundPosition: "0 0, 6px 6px",
                }
              : undefined
          }
        >
          {valor ? (
            <img src={valor} alt="" className="h-full w-full object-contain p-1" />
          ) : (
            <ImagePlus size={20} className="text-ink-3" />
          )}
        </button>
        <div className="flex min-w-0 flex-wrap gap-2">
          <Botao tamanho="sm" onClick={() => entrada.current?.click()} disabled={preparando}>
            {preparando ? "Preparando..." : valor ? "Trocar" : "Escolher imagem"}
          </Botao>
          {valor && (
            <Botao
              tamanho="sm"
              variante="fantasma"
              onClick={() => {
                onMudar(null);
                setAviso(null);
              }}
            >
              <Trash2 size={16} />
              Remover
            </Botao>
          )}
        </div>
      </div>
      {aviso && (
        <p className="mt-2 flex items-start gap-2 rounded-lg bg-warn-soft px-2 py-2 text-xs leading-5 text-warn-text">
          <TriangleAlert size={12} className="mt-0.5 shrink-0" />
          {aviso}
        </p>
      )}
      {(dica || aceitaColar) && (
        <p className="mt-2 text-xs leading-5 text-ink-3">
          {aceitaColar && (
            <>
              Também dá para colar uma imagem copiada com <kbd className="rounded border border-line bg-surface-2 px-1 font-sans text-[11px]/4">Ctrl</kbd>+<kbd className="rounded border border-line bg-surface-2 px-1 font-sans text-[11px]/4">V</kbd>.{" "}
            </>
          )}
          {dica}
        </p>
      )}
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void usar(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
