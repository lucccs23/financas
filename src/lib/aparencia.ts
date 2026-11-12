// Preferências de aparência. Ficam em cada aparelho (no navegador), porque
// cada pessoa pode querer o app de um jeito no próprio celular.

export type ModoTema = "claro" | "escuro" | "sistema";
export type CorDestaque = "azul" | "violeta" | "verde" | "rosa" | "laranja" | "grafite";
export type TamanhoTexto = "normal" | "grande";

/** Painéis da Visão geral que têm ilustração no canto. */
export type Painel = "saldo" | "contas" | "casa" | "cartoes" | "moradia" | "reserva";

export const PAINEIS: { id: Painel; nome: string }[] = [
  { id: "saldo", nome: "Saldo previsto" },
  { id: "contas", nome: "Contas a pagar" },
  { id: "casa", nome: "Divisão da casa" },
  { id: "cartoes", nome: "Cartões" },
  { id: "moradia", nome: "Moradia" },
  { id: "reserva", nome: "Reserva" },
];

export interface Aparencia {
  tema: ModoTema;
  cor: CorDestaque;
  tamanho: TamanhoTexto;
  /** Imagens escolhidas pela pessoa no lugar das ilustrações padrão. */
  ilustracoes: Partial<Record<Painel, string>>;
}

export const APARENCIA_PADRAO: Aparencia = {
  tema: "sistema",
  cor: "azul",
  tamanho: "normal",
  ilustracoes: {},
};

/** Cores de destaque: amostra clara e escura, só para desenhar o seletor. */
export const CORES_DESTAQUE: { id: CorDestaque; nome: string; claro: string; escuro: string }[] = [
  { id: "azul", nome: "Azul", claro: "#2563eb", escuro: "#3b82f6" },
  { id: "violeta", nome: "Violeta", claro: "#6d4fe0", escuro: "#8b74f0" },
  { id: "verde", nome: "Verde", claro: "#0b8a5c", escuro: "#22b07d" },
  { id: "rosa", nome: "Rosa", claro: "#d43a70", escuro: "#ec5f8f" },
  { id: "laranja", nome: "Laranja", claro: "#c9530e", escuro: "#f07a35" },
  { id: "grafite", nome: "Grafite", claro: "#1f2937", escuro: "#e5e7eb" },
];

const CHAVES = {
  tema: "quinhao:tema",
  cor: "quinhao:cor",
  tamanho: "quinhao:tamanho",
  ilustracoes: "quinhao:ilustracoes",
} as const;

function lerIlustracoes(): Aparencia["ilustracoes"] {
  try {
    const lido = JSON.parse(localStorage.getItem(CHAVES.ilustracoes) ?? "{}") as Record<string, unknown>;
    return Object.fromEntries(
      PAINEIS.filter((p) => typeof lido[p.id] === "string").map((p) => [p.id, lido[p.id] as string]),
    );
  } catch {
    return {};
  }
}

export function lerAparencia(): Aparencia {
  try {
    const tema = localStorage.getItem(CHAVES.tema);
    const cor = localStorage.getItem(CHAVES.cor);
    const tamanho = localStorage.getItem(CHAVES.tamanho);
    return {
      tema: tema === "claro" || tema === "escuro" ? tema : "sistema",
      cor: CORES_DESTAQUE.some((c) => c.id === cor) ? (cor as CorDestaque) : "azul",
      tamanho: tamanho === "grande" ? "grande" : "normal",
      ilustracoes: lerIlustracoes(),
    };
  } catch {
    return APARENCIA_PADRAO;
  }
}

/** Guarda neste aparelho. Devolve false se não couber (imagens grandes demais). */
export function guardarAparencia(a: Aparencia): boolean {
  try {
    localStorage.setItem(CHAVES.tema, a.tema);
    localStorage.setItem(CHAVES.cor, a.cor);
    localStorage.setItem(CHAVES.tamanho, a.tamanho);
    localStorage.setItem(CHAVES.ilustracoes, JSON.stringify(a.ilustracoes));
    return true;
  } catch {
    // Sem armazenamento (janela anônima) ou sem espaço: vale só até fechar.
    return false;
  }
}

export function sistemaEscuro(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function aplicarAparencia(a: Aparencia) {
  const raiz = document.documentElement;
  const escuro = a.tema === "escuro" || (a.tema === "sistema" && sistemaEscuro());
  raiz.dataset.theme = escuro ? "dark" : "light";
  raiz.dataset.cor = a.cor;
  raiz.dataset.tamanho = a.tamanho;
}

/** Roda antes da primeira pintura (no <head>), para a tela não piscar. Mesma lógica de cima. */
export const SCRIPT_APARENCIA = `(function(){try{var l=localStorage,t=l.getItem("${CHAVES.tema}"),c=l.getItem("${CHAVES.cor}")||"azul",z=l.getItem("${CHAVES.tamanho}")||"normal";var e=t==="escuro"||(t!=="claro"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.dataset.theme=e?"dark":"light";r.dataset.cor=c;r.dataset.tamanho=z;if(l.getItem("quinhao:ocultar")==="1")r.dataset.ocultar=""}catch(_){}})()`;
