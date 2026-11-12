import {
  Banknote,
  Building2,
  Bus,
  ArrowLeftRight,
  Clapperboard,
  Gift,
  Scale,
  Coffee,
  CreditCard,
  Droplets,
  Flame,
  GraduationCap,
  HeartPulse,
  KeyRound,
  Landmark,
  PiggyBank,
  Receipt,
  Repeat,
  ShoppingBag,
  ShoppingBasket,
  UtensilsCrossed,
  Users,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface Categoria {
  id: string;
  nome: string;
  icone: LucideIcon;
  /** Já vem marcada como gasto de moradia ao escolher. */
  moradia?: boolean;
}

export const CATEGORIAS: Categoria[] = [
  { id: "aluguel", nome: "Aluguel", icone: KeyRound, moradia: true },
  { id: "financiamento", nome: "Financiamento", icone: Landmark, moradia: true },
  { id: "condominio", nome: "Condomínio", icone: Building2, moradia: true },
  { id: "luz", nome: "Luz", icone: Zap, moradia: true },
  { id: "agua", nome: "Água", icone: Droplets, moradia: true },
  { id: "gas", nome: "Gás", icone: Flame, moradia: true },
  { id: "internet", nome: "Internet e telefone", icone: Wifi, moradia: true },
  { id: "mercado", nome: "Mercado", icone: ShoppingBasket },
  { id: "alimentacao", nome: "Alimentação", icone: UtensilsCrossed },
  { id: "compras", nome: "Compras", icone: ShoppingBag },
  { id: "saude", nome: "Saúde", icone: HeartPulse },
  { id: "educacao", nome: "Educação", icone: GraduationCap },
  { id: "transporte", nome: "Transporte", icone: Bus },
  { id: "lazer", nome: "Lazer", icone: Clapperboard },
  { id: "assinatura", nome: "Assinaturas", icone: Repeat },
  { id: "familia", nome: "Família", icone: Users },
  { id: "reserva", nome: "Reserva", icone: PiggyBank },
  { id: "outros", nome: "Outros", icone: Receipt },
];

const EXTRAS: Record<string, Categoria> = {
  cartao: { id: "cartao", nome: "Cartão", icone: CreditCard },
  renda: { id: "renda", nome: "Renda extra", icone: Banknote },
  salario: { id: "salario", nome: "Salário", icone: Banknote },
  "dia-a-dia": { id: "dia-a-dia", nome: "Reservado p/ dia a dia", icone: Coffee },
  reembolso: { id: "reembolso", nome: "Reembolso", icone: Banknote },
  presente: { id: "presente", nome: "Presente", icone: Gift },
  ajuste: { id: "ajuste", nome: "Ajuste de saldo", icone: Scale },
  transferencia: { id: "transferencia", nome: "Transferência", icone: ArrowLeftRight },
  tarifa: { id: "tarifa", nome: "Tarifas e juros", icone: Landmark },
};

/** Palavras que sugerem a categoria de uma compra importada do banco. */
const PISTAS: [string, RegExp][] = [
  // Antes de tudo: o que não é compra de verdade.
  ["tarifa", /\biof\b|anuidade|seguro cart|tarifa|juros|encargo|multa por atraso/],
  // Pagar conta ou mandar Pix com o cartão (RecargaPay e parecidos).
  ["transferencia", /recarga ?pay|pix (no|via|com o?) ?cart/],
  // "Mercadolivre" e "Mercado Pago" não são supermercado.
  [
    "mercado",
    /supermerc|\bmercado\b(?! ?(livre|pago))|mercadinho|atacad|assai|carrefour|extra |pao de acucar|hortifrut|sacolao|padaria/,
  ],
  [
    "transporte",
    /uber|99 ?(pop|app|taxi)|cabify|posto|combust|shell|ipiranga|petrobr|estacion|metro|onibus|bilhete|sem parar|conectcar|pedagio/,
  ],
  [
    "saude",
    /farm|drog|raia|pacheco|panvel|clinic|hospital|laborat|odonto|medic|academia|smart ?fit|bluefit|unimed|amil/,
  ],
  [
    "assinatura",
    /netflix|spotify|disney|hbo|max\.com|prime video|amazon prime|youtube|apple\.com|icloud|google (one|storage)|deezer|globoplay|paramount|chatgpt|openai|telegram|discord|canva|notion|duolingo|dropbox|adobe|crunchyroll/,
  ],
  [
    "alimentacao",
    /ifood|rappi|restaur|lanch|burger|mc ?donald|pizza|sushi|cafe|bar |padoca|aiqfome|delivery/,
  ],
  ["lazer", /cinema|ingresso|show|steam|playstation|xbox|nintendo|teatro|parque/],
  [
    "compras",
    /amazon|mercado ?livre|magalu|magazine|shopee|shein|americanas|renner|riachuelo|c&a|zara|loja/,
  ],
  ["educacao", /curso|escola|faculd|universid|udemy|alura|livrar|livro|papelar/],
  ["internet", /vivo|claro|tim |oi |net virtua|internet|telefon/],
  ["luz", /enel|light|cemig|copel|celesc|energia|eletropaulo|coelba|celpe/],
  ["agua", /sabesp|cedae|copasa|sanepar|embasa|compesa|saneamento/],
];

export function sugerirCategoria(descricao: string): string {
  const texto = descricao.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return PISTAS.find(([, regra]) => regra.test(texto))?.[0] ?? "outros";
}

export function categoria(id: string): Categoria {
  return CATEGORIAS.find((c) => c.id === id) ?? EXTRAS[id] ?? CATEGORIAS[CATEGORIAS.length - 1];
}
