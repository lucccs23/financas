/* eslint-disable @next/next/no-img-element -- imagens vêm como data URL, guardadas com os dados */
import { Nfc } from "lucide-react";
import { formatar } from "@/lib/dinheiro";
import type { Cartao } from "@/lib/types";
import { corCartao } from "@/lib/visual-cartao";
import { cx } from "./ui";

type Situacao = "Aberta" | "Paga" | "Sem fatura";

/**
 * Desenho do cartão de crédito.
 * Sem foto: o app desenha o cartão com banco, chip, nome, vencimento e limite.
 * Com foto: a foto aparece inteira, sem nada por cima (ela já traz banco, nome
 * e bandeira), e a situação, o vencimento e o limite ficam numa linha embaixo.
 */
export function CartaoVisual({
  cartao,
  situacao,
  vence,
  limiteLivre,
  selecionado,
  className,
}: {
  cartao: Pick<Cartao, "nome" | "banco" | "cor" | "larId" | "imagem" | "logo">;
  situacao: Situacao;
  vence: string;
  limiteLivre: number | null;
  selecionado?: boolean;
  className?: string;
}) {
  const foto = cartao.imagem || null;
  if (foto) {
    return (
      <div className={cx("flex flex-col gap-2", className)}>
        <div
          className={cx(
            "relative aspect-[1.586] overflow-hidden rounded-2xl bg-[#111]",
            selecionado && "ring-2 ring-primary ring-offset-2 ring-offset-surface",
          )}
          style={{ boxShadow: "0 14px 28px -16px rgba(0,0,0,0.7)" }}
        >
          <img src={foto} alt={cartao.banco || cartao.nome} className="absolute inset-0 h-full w-full object-cover" />
        </div>
        <div className="flex items-center gap-2 px-1 text-xs text-ink-3">
          <EtiquetaSituacao situacao={situacao} />
          <span className="tabular min-w-0 flex-1 truncate">vence {vence}</span>
          {limiteLivre !== null && (
            <span className="tabular truncate">
              livre <strong className="font-semibold text-ink">{formatar(limiteLivre)}</strong>
            </span>
          )}
        </div>
      </div>
    );
  }

  const cor = corCartao(cartao.cor);
  return (
    <div
      className={cx(
        "relative flex aspect-[1.586] flex-col justify-between overflow-hidden rounded-2xl p-6 text-white transition-shadow",
        selecionado && "ring-2 ring-primary ring-offset-2 ring-offset-surface",
        className,
      )}
      style={{
        background: `linear-gradient(135deg, ${cor.de} 0%, ${cor.ate} 100%)`,
        boxShadow: `0 14px 28px -16px ${cor.ate}, inset 0 1px 0 rgba(255,255,255,0.22)`,
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07]"
        style={{ background: "repeating-linear-gradient(115deg, #fff 0 1px, transparent 1px 5px)" }}
      />
      <div
        aria-hidden
        className="absolute -top-1/2 -right-1/4 h-[150%] w-[70%] rotate-12 opacity-[0.09]"
        style={{ background: "linear-gradient(90deg, transparent, #fff, transparent)" }}
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          {cartao.logo ? (
            <img
              src={cartao.logo}
              alt={cartao.banco || cartao.nome}
              className="h-8 max-w-[65%] object-contain object-left drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]"
            />
          ) : (
            <p className="truncate text-[15px]/6 font-semibold tracking-[-0.01em]">{cartao.banco || cartao.nome}</p>
          )}
          {cartao.larId && (
            <p className="mt-1 text-[10px]/4 font-medium tracking-[0.12em] text-white/70 uppercase">Cartão da casa</p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-black/25 px-2 py-1 text-[11px]/4 font-medium backdrop-blur-sm">
          {situacao}
        </span>
      </div>

      <div className="relative flex items-center gap-4">
        <svg aria-hidden width="40" height="28" viewBox="0 0 38 28" fill="none">
          <rect width="38" height="28" rx="5" fill="rgba(255,255,255,0.82)" />
          <path d="M13 0v9H0M25 0v9h13M13 28v-9H0M25 28v-9h13M13 9v10M25 9v10" stroke="rgba(0,0,0,0.28)" strokeWidth="1.2" />
        </svg>
        <p className="min-w-0 flex-1 truncate text-center text-[12px]/4 font-medium tracking-[0.32em] text-white/85 uppercase">
          {/* Cartão chamado pelo banco: o nome já está em cima. */}
          {cartao.nome.trim().toLowerCase() !== cartao.banco.trim().toLowerCase() && cartao.nome}
        </p>
        <Nfc aria-hidden size={20} className="shrink-0 text-white/70" />
      </div>

      <div className="relative flex items-end justify-between gap-4 [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">
        <div>
          <p className="text-[9.5px]/4 font-medium tracking-[0.14em] text-white/70 uppercase">Vence</p>
          <p className="tabular text-[14px]/5 font-semibold">{vence}</p>
        </div>
        {limiteLivre !== null && (
          <div className="text-right">
            <p className="text-[9.5px]/4 font-medium tracking-[0.14em] text-white/70 uppercase">Limite livre</p>
            <p className="tabular text-[14px]/5 font-semibold">{formatar(limiteLivre)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function EtiquetaSituacao({ situacao }: { situacao: Situacao }) {
  return (
    <span
      className={cx(
        "inline-flex h-6 shrink-0 items-center rounded-full px-2 text-[11px]/4 font-medium",
        situacao === "Aberta"
          ? "bg-primary-soft text-primary-text"
          : situacao === "Paga"
            ? "bg-good-soft text-good-text"
            : "bg-surface-2 text-ink-3",
      )}
    >
      {situacao}
    </span>
  );
}
