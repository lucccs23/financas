"use client";
/* eslint-disable @next/next/no-img-element -- imagem escolhida pela pessoa, guardada como data URL */

import type { LucideIcon } from "lucide-react";
import { useApp } from "@/lib/app";
import type { Painel } from "@/lib/aparencia";
import { Emblema, type Tom } from "./ui";

/** Ilustração do canto de um painel: a imagem da pessoa, se ela escolheu uma, ou o desenho padrão. */
export function Ilustracao({
  painel,
  icone,
  tom,
  tamanho = 64,
}: {
  painel: Painel;
  icone: LucideIcon;
  tom: Tom;
  tamanho?: number;
}) {
  const { aparencia } = useApp();
  const imagem = aparencia.ilustracoes[painel];
  if (!imagem) return <Emblema icone={icone} tom={tom} tamanho={tamanho} />;
  const lado = Math.round(tamanho * 1.25);
  return (
    <img
      src={imagem}
      alt=""
      aria-hidden
      width={lado}
      height={lado}
      className="-my-2 -mr-2 shrink-0 object-contain drop-shadow-[0_10px_14px_rgba(16,24,40,0.18)]"
      style={{ width: lado, height: lado }}
    />
  );
}
