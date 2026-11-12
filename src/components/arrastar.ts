"use client";

import { useEffect, useRef } from "react";

/**
 * Deixa uma faixa com rolagem horizontal ser "puxada" com o mouse, como no
 * celular. No toque, o navegador já faz isso sozinho. Um arrasto não conta
 * como clique, para não abrir o cartão sem querer.
 */
export function useArrastarRolagem<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let ativo = false;
    let moveu = false;
    let inicioX = 0;
    let inicioRolagem = 0;

    const descer = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      if (el.scrollWidth <= el.clientWidth) return;
      ativo = true;
      moveu = false;
      inicioX = e.clientX;
      inicioRolagem = el.scrollLeft;
    };
    const mover = (e: PointerEvent) => {
      if (!ativo) return;
      const dx = e.clientX - inicioX;
      if (!moveu && Math.abs(dx) > 4) {
        moveu = true;
        // Durante o arrasto o encaixe atrapalha; volta ao soltar.
        el.style.scrollSnapType = "none";
        el.style.cursor = "grabbing";
        el.style.userSelect = "none";
      }
      if (moveu) el.scrollLeft = inicioRolagem - dx;
    };
    const soltar = () => {
      if (!ativo) return;
      ativo = false;
      el.style.cursor = "";
      el.style.userSelect = "";
      if (moveu) {
        // Reativa o encaixe depois de um instante, para assentar no cartão mais próximo.
        const alvo = el.scrollLeft;
        el.style.scrollSnapType = "";
        el.scrollLeft = alvo;
      }
    };
    const clicar = (e: MouseEvent) => {
      if (moveu) {
        e.preventDefault();
        e.stopPropagation();
        moveu = false;
      }
    };
    const arrastarImagem = (e: DragEvent) => e.preventDefault();

    el.addEventListener("pointerdown", descer);
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
    el.addEventListener("click", clicar, true);
    el.addEventListener("dragstart", arrastarImagem);
    return () => {
      el.removeEventListener("pointerdown", descer);
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
      el.removeEventListener("click", clicar, true);
      el.removeEventListener("dragstart", arrastarImagem);
    };
  }, []);

  return ref;
}
