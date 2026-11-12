// Modelo de dados do app. Todo valor em dinheiro é guardado em centavos (inteiro).

export type Id = string;
/** Mês no formato "AAAA-MM". Comparar como texto funciona. */
export type Mes = string;

export interface Perfil {
  id: Id;
  nome: string;
  /** Índice da cor na paleta de pessoas (0 a 7). */
  cor: number;
  /** Valores atuais. Usados nos meses sem registro no histórico. */
  salario: number;
  orcamentoDiaADia: number;
  /** Mudanças de renda ao longo do tempo: cada entrada vale do mês "desde" em diante. */
  historico?: MudancaRenda[] | null;
}

export interface MudancaRenda {
  desde: Mes;
  salario: number;
  diaADia: number;
}

export interface Lar {
  id: Id;
  nome: string;
  codigo: string;
  criadoPor: Id;
}

export interface Morador {
  id: Id;
  larId: Id;
  nome: string;
  cor: number;
  /** Perfil que assumiu este morador. Vazio = morador sem conta no app. */
  perfilId: Id | null;
  /** Peso padrão na divisão das contas da casa. Zero = não participa. */
  peso: number;
  /** Preenchido só quando a pessoa escolhe mostrar o salário para a casa. */
  salarioCompartilhado: number | null;
}

export type Natureza = "despesa" | "receita";

export interface Conta {
  id: Id;
  /** Conta pessoal: perfilId preenchido. Conta da casa: larId preenchido. */
  perfilId: Id | null;
  larId: Id | null;
  natureza: Natureza;
  nome: string;
  valor: number;
  diaVencimento: number;
  recorrente: boolean;
  mesInicio: Mes;
  mesFim: Mes | null;
  estimada: boolean;
  moradia: boolean;
  categoria: string;
  /** Morador que paga a conta (só contas da casa). */
  pagadorId: Id | null;
  /** Pesos por morador nesta conta. Vazio = todos, com o peso padrão. */
  participantes: Record<Id, number> | null;
  /** Meta da reserva que recebe o valor quando a conta é marcada como paga. */
  metaId?: Id | null;
}

/** Situação de uma conta ou fatura em um mês específico. */
export interface Lancamento {
  id: Id;
  perfilId: Id | null;
  larId: Id | null;
  refTipo: "conta" | "fatura";
  refId: Id;
  mes: Mes;
  /** Valor real daquele mês, quando difere do cadastrado. */
  valor: number | null;
  pago: boolean;
  /** Conta não vale neste mês. */
  pulado: boolean;
}

export interface Cartao {
  id: Id;
  perfilId: Id;
  /** Preenchido quando o cartão é usado para a casa: a fatura entra na divisão. */
  larId: Id | null;
  nome: string;
  banco: string;
  cor: number;
  limite: number;
  diaFechamento: number;
  diaVencimento: number;
  /**
   * Correção do limite livre, para bater com o app do banco: compras que não
   * foram lançadas aqui, pagamentos antecipados etc. Calculada quando a pessoa
   * informa o limite disponível.
   */
  limiteAjuste?: number;
  /** Quando o limite disponível foi conferido com o banco (AAAA-MM-DD). */
  limiteConferidoEm?: string | null;
  /** Foto do cartão (data URL), usada no lugar do acabamento de cor. */
  imagem?: string | null;
  /** Logo do banco (data URL), no lugar do nome escrito. */
  logo?: string | null;
}

export interface Compra {
  id: Id;
  cartaoId: Id;
  perfilId: Id;
  larId: Id | null;
  descricao: string;
  /** Valor total da compra, ou valor mensal quando é assinatura. */
  valor: number;
  parcelas: number;
  /** Assinatura: cobra todo mês a partir de mesPrimeira. */
  recorrente: boolean;
  /** Mês da fatura em que cai a primeira parcela. */
  mesPrimeira: Mes;
  mesFim: Mes | null;
  data: string;
  categoria?: string;
}

export interface Acerto {
  id: Id;
  larId: Id;
  mes: Mes;
  deId: Id;
  paraId: Id;
  valor: number;
  feitoEm: string;
}

export interface Meta {
  id: Id;
  perfilId: Id | null;
  larId: Id | null;
  nome: string;
  alvo: number;
  cor: number;
}

export interface Aporte {
  id: Id;
  metaId: Id;
  perfilId: Id | null;
  larId: Id | null;
  /** Negativo = retirada. */
  valor: number;
  data: string;
  descricao: string;
  /** Lançamento que gerou esta movimentação (conta paga ligada à meta). */
  origem?: string | null;
}

export type TipoCarteira = "corrente" | "poupanca" | "dinheiro" | "investimento";

/** Onde o dinheiro fica: conta no banco, poupança, dinheiro vivo, investimento. Sempre pessoal. */
export interface Carteira {
  id: Id;
  perfilId: Id;
  nome: string;
  tipo: TipoCarteira;
  /** Saldo no dia em que a carteira foi cadastrada. As transações somam a partir dele. */
  saldoInicial: number;
  cor: number;
  /** Fica de fora do saldo total (ex.: conta que você só acompanha). */
  arquivada: boolean;
}

export type TipoTransacao = "saida" | "entrada" | "transferencia";

/**
 * Um gasto ou entrada avulsa do dia a dia (lanche, Uber, Pix recebido),
 * ou uma transferência entre carteiras. Contas fixas e compras no cartão
 * continuam nas próprias telas.
 */
export interface Transacao {
  id: Id;
  perfilId: Id;
  data: string;
  descricao: string;
  /** Centavos, sempre positivo. O tipo diz se entrou ou saiu. */
  valor: number;
  tipo: TipoTransacao;
  categoria: string;
  carteiraId: Id | null;
  /** Só em transferências: para onde o dinheiro foi. */
  carteiraDestinoId: Id | null;
  observacao: string;
}

export interface Dados {
  perfis: Perfil[];
  lares: Lar[];
  moradores: Morador[];
  contas: Conta[];
  lancamentos: Lancamento[];
  cartoes: Cartao[];
  compras: Compra[];
  acertos: Acerto[];
  metas: Meta[];
  aportes: Aporte[];
  carteiras: Carteira[];
  transacoes: Transacao[];
}

export type NomeTabela = keyof Dados;
export type Linha<K extends NomeTabela> = Dados[K][number];

export const TABELAS: NomeTabela[] = [
  "perfis",
  "lares",
  "moradores",
  "contas",
  "lancamentos",
  "cartoes",
  "compras",
  "acertos",
  "metas",
  "aportes",
  "carteiras",
  "transacoes",
];

export function dadosVazios(): Dados {
  return {
    perfis: [],
    lares: [],
    moradores: [],
    contas: [],
    lancamentos: [],
    cartoes: [],
    compras: [],
    acertos: [],
    metas: [],
    aportes: [],
    carteiras: [],
    transacoes: [],
  };
}
