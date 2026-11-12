"use client";

// Peças visuais de base. Todas as telas são montadas com elas, para o app
// inteiro ter o mesmo acabamento.

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { Check, ChevronDown, X, type LucideIcon } from "lucide-react";
import { lerCentavos, mascara, partes } from "@/lib/dinheiro";

/** Ícone com metade do tamanho da caixa, na grade de 4 (32 → 16, 40 → 20, 64 → 32). */
export function iconeNaGrade(caixa: number): number {
  return Math.max(12, Math.round(caixa / 2 / 4) * 4);
}

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/* ───────────────────────── Cores das pessoas ───────────────────────── */

const fatia = (n: number) => ((Math.trunc(n) % 8) + 8) % 8;

export const corPessoa = (n: number) => `var(--s${fatia(n) + 1})`;
/** Cor do texto escrito por cima da cor da pessoa. */
export const tintaPessoa = (n: number) => (fatia(n) === 3 ? "var(--s4-ink)" : "#ffffff");

export const NOMES_CORES = [
  "Azul",
  "Laranja",
  "Verde-água",
  "Amarelo",
  "Rosa",
  "Verde",
  "Violeta",
  "Vermelho",
];

/* ───────────────────────── Painel ───────────────────────── */

export function Painel({
  className,
  children,
  ...resto
}: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cx(
        // min-w-0: dentro de uma grade, o painel encolhe em vez de ser empurrado pelo conteúdo.
        "@container min-w-0 rounded-card border border-line bg-surface shadow-card",
        className,
      )}
      {...resto}
    >
      {children}
    </section>
  );
}

export function TituloPainel({
  children,
  detalhe,
}: {
  children: ReactNode;
  detalhe?: ReactNode;
}) {
  return (
    <h2 className="flex items-baseline gap-2 text-[15px]/6 font-semibold tracking-[-0.01em] text-ink">
      {children}
      {detalhe && (
        <span className="text-[13px]/5 font-normal text-ink-3">· {detalhe}</span>
      )}
    </h2>
  );
}

/* ───────────────────────── Botões ───────────────────────── */

const VARIANTES = {
  primario:
    "bg-primary text-primary-ink hover:bg-primary-hover shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_2px_rgba(16,24,40,0.2)]",
  secundario:
    "border border-line bg-surface text-ink hover:bg-surface-2 shadow-[0_1px_2px_rgba(16,24,40,0.05)]",
  suave: "bg-surface-2 text-ink hover:bg-surface-3",
  fantasma: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  perigo: "bg-bad-soft text-bad-text hover:brightness-95",
} as const;

const TAMANHOS = {
  sm: "h-8 gap-2 rounded-lg px-4 text-[13px]/5",
  md: "h-10 gap-2 rounded-lg px-4 text-sm",
} as const;

/** Aparência de botão para usar em links. */
export function classesBotao(
  variante: keyof typeof VARIANTES = "secundario",
  tamanho: keyof typeof TAMANHOS = "md",
): string {
  return cx(
    "inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-[background-color,filter,transform] duration-150 active:scale-[0.98]",
    VARIANTES[variante],
    TAMANHOS[tamanho],
  );
}

export function Botao({
  variante = "secundario",
  tamanho = "md",
  className,
  children,
  ...resto
}: {
  variante?: keyof typeof VARIANTES;
  tamanho?: keyof typeof TAMANHOS;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-[background-color,filter,transform] duration-150 active:scale-[0.98] disabled:opacity-50",
        VARIANTES[variante],
        TAMANHOS[tamanho],
        className,
      )}
      {...resto}
    >
      {children}
    </button>
  );
}

export function BotaoIcone({
  icone: Icone,
  rotulo,
  className,
  tamanho = 40,
  ...resto
}: {
  icone: LucideIcon;
  rotulo: string;
  tamanho?: number;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      style={{ width: tamanho, height: tamanho }}
      className={cx(
        "inline-grid shrink-0 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40",
        className,
      )}
      {...resto}
    >
      <Icone size={iconeNaGrade(tamanho)} strokeWidth={2} />
    </button>
  );
}

/* ───────────────────────── Dinheiro ───────────────────────── */

/**
 * Valor em destaque: "R$" e centavos recuam, o número inteiro aparece.
 * O tamanho vem da classe de fonte passada em className.
 */
export function Valor({
  centavos,
  className,
  aprox,
}: {
  centavos: number;
  className?: string;
  aprox?: boolean;
}) {
  const p = partes(centavos);
  return (
    <span
      className={cx(
        "dinheiro inline-flex items-baseline font-semibold tracking-[-0.035em] whitespace-nowrap text-ink",
        className,
      )}
    >
      {aprox && (
        <span className="mr-[0.2em] text-[0.62em] font-medium text-ink-3">≈</span>
      )}
      <span className="mr-[0.2em] text-[0.74em] text-ink-3">
        {p.negativo ? "− R$" : "R$"}
      </span>
      <span>{p.inteiro}</span>
      <span className="ml-[0.04em] text-[0.46em] font-medium tracking-normal text-ink-3">
        ,{p.centavos}
      </span>
    </span>
  );
}

/* ───────────────────────── Avatar e emblema ───────────────────────── */

export function Avatar({
  nome,
  cor,
  tamanho = 32,
  anel,
}: {
  nome: string;
  cor: number;
  tamanho?: number;
  anel?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cx(
        "inline-grid shrink-0 place-items-center rounded-full font-semibold select-none",
        anel && "ring-2 ring-surface",
      )}
      style={{
        width: tamanho,
        height: tamanho,
        fontSize: Math.round(tamanho * 0.42),
        background: corPessoa(cor),
        color: tintaPessoa(cor),
      }}
    >
      {(nome.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

const TONS = {
  azul: ["#6aa5ff", "#1f55d6"],
  verde: ["#5adba5", "#0d9467"],
  ambar: ["#ffcd6b", "#ee8a00"],
  rosa: ["#ff9cbc", "#e0407a"],
  violeta: ["#ab9dff", "#5741d6"],
  ciano: ["#6ad9ee", "#0b89ab"],
  grafite: ["#7b8494", "#252b38"],
} as const;

export type Tom = keyof typeof TONS;

/** Ilustração de canto dos cartões: um ladrilho inclinado com ícone e sombra colorida. */
export function Emblema({
  icone: Icone,
  tom = "azul",
  tamanho = 64,
}: {
  icone: LucideIcon;
  tom?: Tom;
  tamanho?: number;
}) {
  const [claro, escuro] = TONS[tom];
  const raio = Math.round(tamanho * 0.3);
  return (
    <div
      aria-hidden
      className="relative shrink-0"
      style={{ width: tamanho, height: tamanho }}
    >
      <div
        className="absolute inset-[7%] translate-x-[9%] translate-y-[7%] rotate-[9deg] opacity-25"
        style={{ background: escuro, borderRadius: raio }}
      />
      <div
        className="absolute inset-[7%] grid -rotate-6 place-items-center text-white"
        style={{
          borderRadius: raio,
          background: `linear-gradient(145deg, ${claro}, ${escuro})`,
          boxShadow: `0 14px 22px -12px ${escuro}, inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -2px 0 rgba(0,0,0,0.1)`,
        }}
      >
        <Icone size={iconeNaGrade(tamanho)} strokeWidth={1.9} />
      </div>
    </div>
  );
}

/** Ícone pequeno em ladrilho suave, para linhas de lista. */
export function Ladrilho({
  icone: Icone,
  tamanho = 40,
  className,
}: {
  icone: LucideIcon;
  tamanho?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cx(
        "inline-grid shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-text",
        className,
      )}
      style={{ width: tamanho, height: tamanho }}
    >
      <Icone size={iconeNaGrade(tamanho)} strokeWidth={2} />
    </span>
  );
}

/* ───────────────────────── Etiquetas e marcadores ───────────────────────── */

const TONS_ETIQUETA = {
  neutro: "bg-surface-2 text-ink-2",
  primario: "bg-primary-soft text-primary-text",
  bom: "bg-good-soft text-good-text",
  alerta: "bg-warn-soft text-warn-text",
  ruim: "bg-bad-soft text-bad-text",
} as const;

export function Etiqueta({
  tom = "neutro",
  children,
  className,
}: {
  tom?: keyof typeof TONS_ETIQUETA;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px]/4 font-medium whitespace-nowrap",
        TONS_ETIQUETA[tom],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Ponto({ cor, tamanho = 8 }: { cor: string; tamanho?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{ width: tamanho, height: tamanho, background: cor }}
    />
  );
}

/** Caixa redonda de "pago". */
export function Marcador({
  marcado,
  onMudar,
  rotulo,
}: {
  marcado: boolean;
  onMudar: (v: boolean) => void;
  rotulo: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcado}
      aria-label={rotulo}
      title={rotulo}
      onClick={() => onMudar(!marcado)}
      className={cx(
        "inline-grid h-6 w-6 shrink-0 place-items-center rounded-full border-[1.5px] transition-all duration-150",
        marcado
          ? "border-primary bg-primary text-primary-ink"
          : "border-line-strong bg-surface text-transparent hover:border-primary",
      )}
    >
      <Check size={12} strokeWidth={3} />
    </button>
  );
}

/* ───────────────────────── Controles de formulário ───────────────────────── */

const ENTRADA =
  "h-10 w-full rounded-lg border border-line bg-surface px-4 text-sm text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-3 hover:border-line-strong focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:bg-surface-2 disabled:text-ink-3";

export function Campo({
  rotulo,
  dica,
  children,
  className,
}: {
  rotulo: string;
  dica?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-2 block text-[13px]/5 font-medium text-ink-2">{rotulo}</span>
      {children}
      {dica && <span className="mt-2 block text-xs leading-5 text-ink-3">{dica}</span>}
    </label>
  );
}

export function Entrada({ className, ...resto }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(ENTRADA, className)} {...resto} />;
}

export function EntradaValor({
  valor,
  onMudar,
  autoFocus,
  disabled,
}: {
  valor: number;
  onMudar: (centavos: number) => void;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  return (
    <span className="relative block">
      <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm text-ink-3">
        R$
      </span>
      <input
        inputMode="numeric"
        autoFocus={autoFocus}
        disabled={disabled}
        className={cx(ENTRADA, "tabular pl-10 font-medium")}
        value={mascara(valor)}
        onChange={(e) => onMudar(lerCentavos(e.target.value))}
        onFocus={(e) => e.target.select()}
      />
    </span>
  );
}

export function EntradaNumero({
  valor,
  onMudar,
  min = 0,
  max,
  sufixo,
}: {
  valor: number;
  onMudar: (n: number) => void;
  min?: number;
  max?: number;
  sufixo?: string;
}) {
  return (
    <span className="relative block">
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        className={cx(ENTRADA, "tabular", sufixo && "pr-12")}
        value={Number.isFinite(valor) ? valor : ""}
        onChange={(e) => {
          const n = e.target.value === "" ? min : Number(e.target.value);
          onMudar(Math.max(min, max !== undefined ? Math.min(max, n) : n));
        }}
        onFocus={(e) => e.target.select()}
      />
      {sufixo && (
        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs text-ink-3">
          {sufixo}
        </span>
      )}
    </span>
  );
}

export function Selecao({
  className,
  children,
  ...resto
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block">
      <select className={cx(ENTRADA, "appearance-none pr-10", className)} {...resto}>
        {children}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-ink-3"
      />
    </span>
  );
}

export function Segmentado<T extends string>({
  opcoes,
  valor,
  onMudar,
  rotulo,
  cheio,
}: {
  opcoes: { valor: T; rotulo: string; desativado?: boolean }[];
  valor: T;
  onMudar: (v: T) => void;
  rotulo: string;
  cheio?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={rotulo}
      className={cx(
        "inline-flex rounded-lg bg-surface-2 p-1",
        cheio && "flex w-full",
      )}
    >
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            disabled={o.desativado}
            onClick={() => onMudar(o.valor)}
            className={cx(
              "h-8 rounded-lg px-4 text-[13px]/5 font-medium whitespace-nowrap transition-all duration-150 disabled:opacity-45",
              cheio && "flex-1",
              ativo
                ? "bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,40,0.12)] dark:bg-surface-3"
                : "text-ink-2 hover:text-ink",
            )}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

export function Alternar({
  ligado,
  onMudar,
  titulo,
  descricao,
}: {
  ligado: boolean;
  onMudar: (v: boolean) => void;
  titulo: string;
  descricao?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-ink">
          {titulo}
        </label>
        {descricao && (
          <p className="mt-1 text-xs leading-5 text-ink-3">{descricao}</p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={ligado}
        onClick={() => onMudar(!ligado)}
        className={cx(
          "relative mt-1 h-6 w-10 shrink-0 rounded-full transition-colors duration-200",
          ligado ? "bg-primary" : "bg-line-strong",
        )}
      >
        <span
          className={cx(
            "absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform duration-200",
            ligado && "translate-x-4",
          )}
        />
      </button>
    </div>
  );
}

/** Escolha de cor entre as oito da paleta de pessoas. */
export function SeletorCor({
  valor,
  onMudar,
  usadas = [],
}: {
  valor: number;
  onMudar: (n: number) => void;
  usadas?: number[];
}) {
  return (
    <div role="radiogroup" aria-label="Cor" className="flex flex-wrap gap-2">
      {NOMES_CORES.map((nome, i) => {
        const ativo = i === valor;
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={ativo}
            aria-label={nome + (usadas.includes(i) ? " (já usada)" : "")}
            title={nome + (usadas.includes(i) ? " (já usada)" : "")}
            onClick={() => onMudar(i)}
            className={cx(
              "grid h-10 w-10 place-items-center rounded-full transition-transform duration-150 hover:scale-105",
              ativo && "ring-2 ring-offset-2 ring-offset-surface",
              !ativo && usadas.includes(i) && "opacity-40",
            )}
            style={
              {
                background: corPessoa(i),
                color: tintaPessoa(i),
                "--tw-ring-color": corPessoa(i),
              } as React.CSSProperties
            }
          >
            {ativo && <Check size={16} strokeWidth={3} />}
          </button>
        );
      })}
    </div>
  );
}

/* ───────────────────────── Modal ───────────────────────── */

export function Modal({
  titulo,
  descricao,
  onFechar,
  onEnviar,
  children,
  rodape,
  largura = "sm:max-w-[520px]",
}: {
  titulo: string;
  descricao?: ReactNode;
  onFechar: () => void;
  onEnviar?: () => void;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: string;
}) {
  const idTitulo = useId();
  const painel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    document.addEventListener("keydown", aoTeclar);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = anterior;
    };
  }, [onFechar]);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    onEnviar?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div
        className="absolute inset-0 animate-surgir bg-[var(--overlay)] backdrop-blur-[2px]"
        onClick={onFechar}
      />
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className={cx(
          "relative flex max-h-[92dvh] w-full animate-subir flex-col rounded-t-3xl border border-line bg-surface shadow-pop sm:rounded-3xl",
          largura,
        )}
      >
        <header className="flex items-start justify-between gap-4 px-6 pt-6 pb-1">
          <div className="min-w-0">
            <h2 id={idTitulo} className="text-lg font-semibold tracking-[-0.02em] text-ink">
              {titulo}
            </h2>
            {descricao && (
              <p className="mt-1 text-[13px] leading-5 text-ink-3">{descricao}</p>
            )}
          </div>
          <BotaoIcone icone={X} rotulo="Fechar" onClick={onFechar} className="-mr-2" />
        </header>
        <form onSubmit={enviar} className="flex min-h-0 flex-1 flex-col">
          <div className="rolagem-fina min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {children}
          </div>
          {rodape && (
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-4">
              {rodape}
            </footer>
          )}
        </form>
      </div>
    </div>
  );
}

/* ───────────────────────── Menu suspenso ───────────────────────── */

export interface ItemMenu {
  rotulo: string;
  icone?: LucideIcon;
  descricao?: string;
  perigo?: boolean;
  acao: () => void;
}

export function Menu({
  gatilho,
  itens,
  alinhar = "direita",
  direcao = "baixo",
  largura = 240,
}: {
  gatilho: (abrir: () => void, aberto: boolean) => ReactNode;
  itens: (ItemMenu | "divisor")[];
  alinhar?: "direita" | "esquerda";
  direcao?: "baixo" | "cima";
  largura?: number;
}) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  return (
    <div ref={raiz} className="relative">
      {gatilho(() => setAberto((a) => !a), aberto)}
      {aberto && (
        <div
          role="menu"
          style={{ width: largura }}
          className={cx(
            "absolute z-40 animate-subir rounded-2xl border border-line bg-surface p-2 shadow-pop",
            direcao === "baixo" ? "top-[calc(100%+8px)]" : "bottom-[calc(100%+8px)]",
            alinhar === "direita" ? "right-0" : "left-0",
          )}
        >
          {itens.map((item, i) =>
            item === "divisor" ? (
              <div key={i} className="my-2 h-px bg-line" />
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                onClick={() => {
                  setAberto(false);
                  item.acao();
                }}
                className={cx(
                  "flex w-full items-center gap-4 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-surface-2",
                  item.perigo ? "text-bad-text" : "text-ink",
                )}
              >
                {item.icone && (
                  <item.icone
                    size={16}
                    className={item.perigo ? "text-bad-text" : "text-ink-3"}
                  />
                )}
                <span className="min-w-0">
                  <span className="block font-medium">{item.rotulo}</span>
                  {item.descricao && (
                    <span className="block text-xs text-ink-3">{item.descricao}</span>
                  )}
                </span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Estado vazio e cabeçalho de página ───────────────────────── */

export function Vazio({
  icone: Icone,
  titulo,
  texto,
  children,
  compacto,
}: {
  icone: LucideIcon;
  titulo: string;
  texto?: ReactNode;
  children?: ReactNode;
  compacto?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center text-center",
        compacto ? "px-4 py-6" : "px-6 py-12",
      )}
    >
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-ink-3">
        <Icone size={24} strokeWidth={1.8} />
      </span>
      <p className="mt-4 text-sm font-semibold text-ink">{titulo}</p>
      {texto && (
        <p className="mt-1 max-w-86 text-[13px] leading-5 text-ink-3">{texto}</p>
      )}
      {children && <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

export function CabecalhoPagina({
  titulo,
  texto,
  children,
}: {
  titulo: string;
  texto?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 px-1">
      <div className="min-w-0">
        <h1 className="text-[22px]/8 font-semibold tracking-[-0.025em] text-ink">{titulo}</h1>
        {texto && <p className="mt-1 text-sm text-ink-3">{texto}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** Linha de lista padrão: algo à esquerda, título e detalhe, valor à direita. */
export function LinhaLista({
  inicio,
  titulo,
  detalhe,
  fim,
  onClick,
  apagada,
}: {
  inicio?: ReactNode;
  titulo: ReactNode;
  detalhe?: ReactNode;
  fim?: ReactNode;
  onClick?: () => void;
  apagada?: boolean;
}) {
  const conteudo = (
    <>
      <span className="min-w-0 flex-1">
        <span
          className={cx(
            "block truncate text-sm font-medium",
            apagada ? "text-ink-3 line-through decoration-line-strong" : "text-ink",
          )}
        >
          {titulo}
        </span>
        {detalhe && <span className="mt-1 block truncate text-xs text-ink-3">{detalhe}</span>}
      </span>
      {fim}
    </>
  );
  return (
    <div className="flex items-center gap-4 py-2">
      {inicio}
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="-mx-2 flex min-w-0 flex-1 items-center gap-4 rounded-lg px-2 py-1 text-left transition-colors hover:bg-surface-2"
        >
          {conteudo}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-4">{conteudo}</div>
      )}
    </div>
  );
}
