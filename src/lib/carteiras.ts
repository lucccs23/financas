import { ChartLine, Landmark, PiggyBank, Wallet, type LucideIcon } from "lucide-react";
import type { TipoCarteira } from "./types";

export const TIPOS_CARTEIRA: { id: TipoCarteira; nome: string; icone: LucideIcon }[] = [
  { id: "corrente", nome: "Conta corrente", icone: Landmark },
  { id: "poupanca", nome: "Poupança", icone: PiggyBank },
  { id: "dinheiro", nome: "Dinheiro", icone: Wallet },
  { id: "investimento", nome: "Investimento", icone: ChartLine },
];

export function tipoCarteira(id: TipoCarteira) {
  return TIPOS_CARTEIRA.find((t) => t.id === id) ?? TIPOS_CARTEIRA[0];
}
