// Ordem dos itens do menu lateral, escolhida por cada pessoa (arrastando ou
// com as setas). Fica guardada no aparelho, por perfil.

export type GrupoMenu = "menu" | "ajustes";

export interface OrdemMenu {
  menu: string[];
  ajustes: string[];
}

const GRUPOS: GrupoMenu[] = ["menu", "ajustes"];

/**
 * Confere uma ordem guardada contra os itens que existem hoje: tira o que não
 * existe mais (ou repetido) e põe no fim do grupo padrão o que é novo.
 */
export function normalizarOrdem(salva: unknown, padrao: OrdemMenu): OrdemMenu {
  const existentes = new Set([...padrao.menu, ...padrao.ajustes]);
  const vistos = new Set<string>();
  const lida = (salva ?? {}) as Partial<Record<GrupoMenu, unknown>>;
  const ordem: OrdemMenu = { menu: [], ajustes: [] };
  for (const g of GRUPOS) {
    const lista = Array.isArray(lida[g]) ? (lida[g] as unknown[]) : [];
    for (const href of lista) {
      if (typeof href !== "string" || !existentes.has(href) || vistos.has(href)) continue;
      vistos.add(href);
      ordem[g].push(href);
    }
  }
  for (const g of GRUPOS) {
    for (const href of padrao[g]) if (!vistos.has(href)) ordem[g].push(href);
  }
  return ordem;
}

/** Leva um item para a posição `indice` do grupo (pode trocar de grupo). */
export function moverItem(
  ordem: OrdemMenu,
  href: string,
  grupo: GrupoMenu,
  indice: number,
): OrdemMenu {
  const origem = GRUPOS.find((g) => ordem[g].includes(href));
  if (!origem) return ordem;
  const nova: OrdemMenu = { menu: [...ordem.menu], ajustes: [...ordem.ajustes] };
  const de = nova[origem].indexOf(href);
  nova[origem].splice(de, 1);
  // Ao descer dentro do mesmo grupo, o índice de destino já contava o item.
  const destino = origem === grupo && indice > de ? indice - 1 : indice;
  nova[grupo].splice(Math.max(0, Math.min(destino, nova[grupo].length)), 0, href);
  return nova;
}

/**
 * Sobe (-1) ou desce (+1) um item uma posição. Do fim do "Menu" desce para o
 * começo de "Ajustes", e do começo de "Ajustes" sobe para o fim do "Menu".
 */
export function moverUmPasso(ordem: OrdemMenu, href: string, direcao: -1 | 1): OrdemMenu {
  const grupo = GRUPOS.find((g) => ordem[g].includes(href));
  if (!grupo) return ordem;
  const i = ordem[grupo].indexOf(href);
  if (direcao === -1) {
    if (i > 0) return moverItem(ordem, href, grupo, i - 1);
    return grupo === "ajustes" ? moverItem(ordem, href, "menu", ordem.menu.length) : ordem;
  }
  if (i < ordem[grupo].length - 1) return moverItem(ordem, href, grupo, i + 2);
  return grupo === "menu" ? moverItem(ordem, href, "ajustes", 0) : ordem;
}

export const mesmaOrdem = (a: OrdemMenu, b: OrdemMenu) =>
  a.menu.join() === b.menu.join() && a.ajustes.join() === b.ajustes.join();
