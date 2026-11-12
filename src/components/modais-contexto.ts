"use client";

import { createContext, useContext } from "react";
import type { ItemMes } from "@/lib/calc";
import type {
  Carteira,
  Cartao,
  Compra,
  Conta,
  Id,
  Mes,
  Meta,
  Morador,
  Natureza,
  TipoTransacao,
  Transacao,
} from "@/lib/types";

/** Tudo o que pode ser aberto em janela, de qualquer tela. */
export type PedidoModal =
  | { tipo: "conta"; conta?: Conta; escopo?: "pessoal" | "casa"; natureza?: Natureza }
  | { tipo: "ocorrencia"; item: ItemMes; mes: Mes }
  | { tipo: "cartao"; cartao?: Cartao; foco?: "limite" }
  | { tipo: "compra"; compra?: Compra; cartaoId?: Id }
  | { tipo: "importar"; cartaoId?: Id }
  | { tipo: "aparencia" }
  | { tipo: "transacao"; transacao?: Transacao; tipoTransacao?: TipoTransacao }
  | { tipo: "carteira"; carteira?: Carteira }
  | { tipo: "importarExtrato" }
  | { tipo: "meta"; meta?: Meta }
  | { tipo: "aporte"; metaId: Id; retirada?: boolean }
  | { tipo: "morador"; morador?: Morador }
  | { tipo: "lar"; aba?: "criar" | "entrar" }
  | {
      tipo: "confirmar";
      titulo: string;
      texto: string;
      rotulo: string;
      acao: () => void | Promise<void>;
    };

export const ContextoModais = createContext<{
  abrir: (pedido: PedidoModal) => void;
  fechar: () => void;
} | null>(null);

export function useModais() {
  const ctx = useContext(ContextoModais);
  if (!ctx) throw new Error("useModais precisa estar dentro de ModaisProvider.");
  return ctx;
}
