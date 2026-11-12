"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useArrastarRolagem } from "./arrastar";
import { cx } from "./ui";

/**
 * Faixa horizontal de cartões: dá para puxar com o mouse, rolar no toque ou
 * usar as setas. As setas e o esmaecimento das bordas só aparecem quando há
 * mais conteúdo para aquele lado.
 */
export function Carrossel({
  children,
  rotulo,
  className,
  role = "group",
}: {
  children: ReactNode;
  rotulo: string;
  className?: string;
  role?: "group" | "radiogroup";
}) {
  const ref = useArrastarRolagem<HTMLDivElement>();
  const [lados, setLados] = useState({ esquerda: false, direita: false });

  const medir = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setLados({
      esquerda: el.scrollLeft > 4,
      direita: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    medir();
    el.addEventListener("scroll", medir, { passive: true });
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => {
      el.removeEventListener("scroll", medir);
      observador.disconnect();
    };
  }, [ref, medir]);

  const rolar = (sentido: 1 | -1) =>
    ref.current?.scrollBy({ left: sentido * ref.current.clientWidth * 0.8, behavior: "smooth" });

  const mascara = `linear-gradient(to right, ${lados.esquerda ? "transparent 0, black 32px" : "black 0"}, ${lados.direita ? "black calc(100% - 32px), transparent 100%" : "black 100%"})`;

  return (
    <div className="relative">
      <div
        ref={ref}
        role={role}
        aria-label={rotulo}
        className={cx(
          "sem-rolagem flex snap-x snap-mandatory overflow-x-auto scroll-smooth",
          (lados.esquerda || lados.direita) && "cursor-grab",
          className,
        )}
        style={{ maskImage: mascara, WebkitMaskImage: mascara }}
      >
        {children}
      </div>
      {lados.esquerda && (
        <button
          type="button"
          aria-label="Ver cartões anteriores"
          onClick={() => rolar(-1)}
          className="absolute top-1/2 left-0 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-line bg-surface text-ink shadow-pop transition-colors hover:bg-surface-2 max-sm:hidden"
        >
          <ChevronLeft size={20} />
        </button>
      )}
      {lados.direita && (
        <button
          type="button"
          aria-label="Ver mais cartões"
          onClick={() => rolar(1)}
          className="absolute top-1/2 right-0 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-line bg-surface text-ink shadow-pop transition-colors hover:bg-surface-2 max-sm:hidden"
        >
          <ChevronRight size={20} />
        </button>
      )}
    </div>
  );
}
