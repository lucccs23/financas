"use client";

// Estrutura fixa do app: decide entre login, criação de perfil e as telas,
// e desenha barra lateral, cabeçalho com o mês, avisos e navegação do celular.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  Banknote,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChartColumn,
  ChevronsUpDown,
  Eye,
  EyeOff,
  Search,
  Wallet,
  CircleCheck,
  CreditCard,
  House,
  LayoutGrid,
  LogOut,
  Menu as IconeMenu,
  Moon,
  Palette,
  PiggyBank,
  Plus,
  Receipt,
  Sun,
  TriangleAlert,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useApp } from "@/lib/app";
import { alertas } from "@/lib/calc";
import { formatar } from "@/lib/dinheiro";
import { addMes, anoDe, nomeMes } from "@/lib/meses";
import { TelaEntrada, TelaPerfil } from "./entrada";
import { LEMA_APP, Logo, NOME_APP } from "./marca";
import { Busca } from "./busca";
import { ModaisProvider } from "./modais";
import { useModais } from "./modais-contexto";
import { Avatar, Botao, BotaoIcone, cx, Marcador, Menu, Painel, Ponto, type ItemMenu } from "./ui";

interface ItemNav {
  href: string;
  rotulo: string;
  curto?: string;
  icone: LucideIcon;
}

const MENU: ItemNav[] = [
  { href: "/", rotulo: "Visão geral", curto: "Início", icone: LayoutGrid },
  { href: "/transacoes", rotulo: "Transações", curto: "Extrato", icone: ArrowLeftRight },
  { href: "/fluxo", rotulo: "Fluxo de caixa", curto: "Fluxo", icone: ChartColumn },
  { href: "/cartoes", rotulo: "Cartões", icone: CreditCard },
  { href: "/carteiras", rotulo: "Carteiras", icone: Wallet },
  { href: "/casa", rotulo: "Casa", icone: House },
  { href: "/reserva", rotulo: "Reserva", icone: PiggyBank },
];

/** No celular cabem cinco atalhos; o resto fica no menu. */
const NO_CELULAR = ["/", "/transacoes", "/cartoes", "/casa", "/reserva"];

const AJUSTES: ItemNav[] = [
  { href: "/contas", rotulo: "Contas", icone: Receipt },
  { href: "/renda", rotulo: "Minha renda", icone: Banknote },
];

export function Casca({ children }: { children: ReactNode }) {
  const { estado } = useApp();

  if (estado === "carregando") {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="animate-pulse">
          <Logo tamanho={56} />
        </div>
      </div>
    );
  }
  if (estado === "deslogado" || estado === "semPerfil") {
    return (
      <>
        {estado === "deslogado" ? <TelaEntrada /> : <TelaPerfil />}
        <Avisos />
      </>
    );
  }
  return (
    <ModaisProvider>
      <Estrutura>{children}</Estrutura>
      <Avisos />
    </ModaisProvider>
  );
}

function Estrutura({ children }: { children: ReactNode }) {
  const caminho = usePathname();
  // Guarda em qual tela a gaveta foi aberta: ao navegar, ela fecha sozinha.
  const [gavetaEm, setGavetaEm] = useState<string | null>(null);
  const gaveta = gavetaEm === caminho;
  const setGaveta = (aberta: boolean) => setGavetaEm(aberta ? caminho : null);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1600px] gap-6 p-4 sm:p-6 ultra:max-w-[3040px] ultra:px-8">
      <aside className="sticky top-6 hidden h-[calc(100dvh-48px)] w-62 shrink-0 lg:block">
        <BarraLateral />
      </aside>
      <div className="min-w-0 flex-1 pb-24 lg:pb-0">
        <Cabecalho abrirGaveta={() => setGaveta(true)} />
        <main className="mt-4 sm:mt-6">{children}</main>
      </div>

      <NavInferior />

      {gaveta && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 animate-surgir bg-[var(--overlay)]"
            onClick={() => setGaveta(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[280px] animate-surgir p-4">
            <BarraLateral />
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Barra lateral ───────────────────────── */

function ativo(caminho: string, href: string): boolean {
  return href === "/" ? caminho === "/" : caminho.startsWith(href);
}

function GrupoNav({ titulo, itens }: { titulo: string; itens: ItemNav[] }) {
  const caminho = usePathname();
  return (
    <nav aria-label={titulo} className="mb-6">
      <p className="mb-2 px-4 text-xs font-medium text-ink-3">{titulo}</p>
      <ul className="space-y-1">
        {itens.map((item) => {
          const aqui = ativo(caminho, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={aqui ? "page" : undefined}
                className={cx(
                  "flex h-10 items-center gap-4 rounded-lg px-4 text-sm transition-colors",
                  aqui
                    ? "bg-surface-2 font-semibold text-ink"
                    : "font-medium text-ink-2 hover:bg-surface-2 hover:text-ink",
                )}
              >
                <item.icone
                  size={16}
                  strokeWidth={aqui ? 2.3 : 2}
                  className={aqui ? "text-primary" : "text-ink-3"}
                />
                {item.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function BarraLateral() {
  const { perfil, lar, tema, setTema, backend, iniciar, modo } = useApp();
  const { abrir } = useModais();
  const router = useRouter();

  const sair = async () => {
    await backend.sair();
    await iniciar();
  };

  const itensPerfil: (ItemMenu | "divisor")[] = [
    { rotulo: "Perfil e renda", icone: UserRound, acao: () => router.push("/renda") },
    { rotulo: "Aparência", icone: Palette, acao: () => abrir({ tipo: "aparencia" }) },
    "divisor",
    {
      rotulo: modo === "nuvem" ? "Sair" : "Trocar de perfil",
      icone: LogOut,
      acao: sair,
    },
  ];

  return (
    <div className="flex h-full flex-col rounded-card border border-line bg-surface p-4 shadow-card">
      <Link href="/" className="mb-6 flex items-center gap-4 rounded-lg px-2 pt-2 pb-1">
        <Logo tamanho={40} />
        <span>
          <span className="block text-[15px] leading-5 font-semibold tracking-[-0.02em] text-ink">
            {NOME_APP}
          </span>
          <span className="block text-xs text-ink-3">{LEMA_APP}</span>
        </span>
      </Link>

      <div className="rolagem-fina min-h-0 flex-1 overflow-y-auto">
        <GrupoNav titulo="Menu" itens={MENU} />
        <GrupoNav titulo="Ajustes" itens={AJUSTES} />
      </div>

      <div className="flex h-12 items-center justify-between px-4">
        <button
          type="button"
          onClick={() => abrir({ tipo: "aparencia" })}
          title="Tema, cor e tamanho do texto"
          className="-ml-1 flex items-center gap-4 rounded-lg px-1 py-1 text-sm font-medium text-ink-2 transition-colors hover:text-ink"
        >
          <Palette size={16} className="text-ink-3" />
          Aparência
        </button>
        <div role="radiogroup" aria-label="Tema" className="flex rounded-full bg-surface-2 p-1">
          {(
            [
              ["claro", Sun, "Claro"],
              ["escuro", Moon, "Escuro"],
            ] as const
          ).map(([valor, Icone, rotulo]) => (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={tema === valor}
              aria-label={rotulo}
              title={rotulo}
              onClick={() => setTema(valor)}
              className={cx(
                "grid h-8 w-8 place-items-center rounded-full transition-all",
                tema === valor
                  ? "bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,40,0.15)] dark:bg-surface-3"
                  : "text-ink-3 hover:text-ink",
              )}
            >
              <Icone size={16} />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 border-t border-line pt-2">
        <Menu
          direcao="cima"
          alinhar="esquerda"
          largura={218}
          itens={itensPerfil}
          gatilho={(abrir) => (
            <button
              type="button"
              onClick={abrir}
              className="flex w-full items-center gap-4 rounded-lg p-2 text-left transition-colors hover:bg-surface-2"
            >
              <Avatar nome={perfil?.nome ?? "?"} cor={perfil?.cor ?? 0} tamanho={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">
                  {perfil?.nome}
                </span>
                <span className="flex items-center gap-2 text-xs text-ink-3">
                  <Ponto cor={lar ? "var(--good)" : "var(--warn)"} tamanho={8} />
                  <span className="truncate">{lar ? lar.nome : "Sem casa ainda"}</span>
                </span>
              </span>
              <ChevronsUpDown size={16} className="shrink-0 text-ink-3" />
            </button>
          )}
        />
      </div>
    </div>
  );
}

/* ───────────────────────── Cabeçalho ───────────────────────── */

function Cabecalho({ abrirGaveta }: { abrirGaveta: () => void }) {
  const { mes, mesHoje, setMes } = useApp();
  return (
    <Painel className="relative z-30 flex items-center gap-1 px-2 py-2 sm:px-4 sm:py-4">
      <BotaoIcone
        icone={IconeMenu}
        rotulo="Abrir menu"
        className="lg:hidden"
        onClick={abrirGaveta}
      />
      <BotaoIcone
        icone={ChevronLeft}
        rotulo="Mês anterior"
        tamanho={32}
        onClick={() => setMes(addMes(mes, -1))}
      />
      <BotaoIcone
        icone={ChevronRight}
        rotulo="Próximo mês"
        tamanho={32}
        onClick={() => setMes(addMes(mes, 1))}
      />
      <button
        type="button"
        aria-live="polite"
        disabled={mes === mesHoje}
        title={mes === mesHoje ? undefined : "Voltar para o mês atual"}
        onClick={() => setMes(mesHoje)}
        className="ml-2 truncate rounded-lg text-left text-lg font-semibold tracking-[-0.03em] text-ink disabled:cursor-default sm:ml-2 sm:text-[26px]/8"
      >
        <span className="max-[400px]:hidden">{nomeMes(mes)}</span>
        <span className="min-[401px]:hidden">{nomeMes(mes).slice(0, 3)}</span>{" "}
        <span className="font-normal text-ink-3">{anoDe(mes)}</span>
      </button>
      {mes !== mesHoje && (
        <Botao
          tamanho="sm"
          variante="suave"
          className="ml-2 max-sm:hidden"
          onClick={() => setMes(mesHoje)}
        >
          Voltar para hoje
        </Botao>
      )}
      <div className="ml-auto flex items-center gap-2">
        <BotaoBusca />
        <BotaoOcultar />
        <Sino />
        <Adicionar />
      </div>
    </Painel>
  );
}

export function prazo(dias: number): string {
  if (dias < -1) return `atrasada há ${-dias} dias`;
  if (dias === -1) return "venceu ontem";
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  return `vence em ${dias} dias`;
}

function Sino() {
  const { dados, perfil, hoje, marcarPago } = useApp();
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const lista = useMemo(
    () => (perfil && hoje ? alertas(dados, perfil.id, hoje) : []),
    [dados, perfil, hoje],
  );

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        aria-label={`Avisos de vencimento: ${lista.length}`}
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
        className="relative grid h-10 w-10 place-items-center rounded-lg border border-line bg-surface text-ink-2 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <Bell size={20} />
        {lista.length > 0 && (
          <span className="tabular absolute -top-2 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-bad px-1 text-[10.5px]/4 font-semibold text-white ring-2 ring-surface">
            {lista.length}
          </span>
        )}
      </button>
      {aberto && (
        <div className="absolute top-[calc(100%+8px)] right-0 z-40 w-88 animate-subir rounded-2xl border border-line bg-surface shadow-pop max-sm:fixed max-sm:inset-x-4 max-sm:top-20 max-sm:w-auto">
          <div className="border-b border-line px-4 py-4">
            <p className="text-sm font-semibold text-ink">Vencimentos</p>
            <p className="text-xs text-ink-3">
              Contas que você paga, atrasadas ou dos próximos 5 dias.
            </p>
          </div>
          {lista.length === 0 ? (
            <div className="flex items-center gap-4 px-4 py-6">
              <CircleCheck size={20} className="text-good" />
              <p className="text-sm text-ink-2">Tudo em dia por aqui.</p>
            </div>
          ) : (
            <ul className="rolagem-fina max-h-86 overflow-y-auto px-4 py-2">
              {lista.map((a) => (
                <li
                  key={a.item.chave + a.mes}
                  className="flex items-center gap-4 border-b border-line py-2 last:border-0"
                >
                  <Marcador
                    marcado={false}
                    rotulo={`Marcar ${a.item.nome} como paga`}
                    onMudar={() => marcarPago(a.item, a.mes, true)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {a.item.nome}
                    </span>
                    <span
                      className={cx(
                        "flex items-center gap-1 text-xs",
                        a.dias < 0
                          ? "text-bad-text"
                          : a.dias === 0
                            ? "text-warn-text"
                            : "text-ink-3",
                      )}
                    >
                      {a.dias <= 0 && <TriangleAlert size={12} />}
                      {prazo(a.dias)}
                    </span>
                  </span>
                  <span className="tabular text-sm font-semibold text-ink">
                    {formatar(a.item.valor)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Botão da busca (Ctrl+K). */
function BotaoBusca() {
  const [aberta, setAberta] = useState(false);
  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberta((a) => !a);
      }
    };
    document.addEventListener("keydown", atalho);
    return () => document.removeEventListener("keydown", atalho);
  }, []);
  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        aria-label="Buscar (Ctrl+K)"
        title="Buscar (Ctrl+K)"
        className="flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink max-md:w-10 max-md:justify-center max-md:px-0"
      >
        <Search size={16} />
        <span className="max-md:hidden">Buscar</span>
        <kbd className="ml-4 rounded border border-line bg-surface-2 px-1 text-[11px]/4 max-md:hidden">
          Ctrl K
        </kbd>
      </button>
      {aberta && <Busca onFechar={() => setAberta(false)} />}
    </>
  );
}

/** Esconde todos os valores em dinheiro (para abrir o app perto de outras pessoas). */
function BotaoOcultar() {
  const { ocultarValores, setOcultarValores } = useApp();
  return (
    <BotaoIcone
      icone={ocultarValores ? EyeOff : Eye}
      rotulo={ocultarValores ? "Mostrar valores" : "Esconder valores"}
      tamanho={40}
      aria-pressed={ocultarValores}
      onClick={() => setOcultarValores(!ocultarValores)}
      className="border border-line bg-surface"
    />
  );
}

function Adicionar() {
  const { dados, lar, sessao } = useApp();
  const { abrir } = useModais();
  const router = useRouter();
  const temCartao = dados.cartoes.some((c) => c.perfilId === sessao?.userId);

  const guardar = () => {
    if (dados.metas.length === 0) abrir({ tipo: "meta" });
    else if (dados.metas.length === 1) abrir({ tipo: "aporte", metaId: dados.metas[0].id });
    else router.push("/reserva");
  };

  const itens: (ItemMenu | "divisor")[] = [
    {
      rotulo: "Gasto do dia a dia",
      descricao: "Lanche, Uber, farmácia",
      icone: ArrowLeftRight,
      acao: () => abrir({ tipo: "transacao", tipoTransacao: "saida" }),
    },
    {
      rotulo: "Conta minha",
      descricao: "Despesa só sua",
      icone: Receipt,
      acao: () => abrir({ tipo: "conta", escopo: "pessoal" }),
    },
    ...(lar
      ? [
          {
            rotulo: "Conta da casa",
            descricao: "Dividida entre os moradores",
            icone: House,
            acao: () => abrir({ tipo: "conta", escopo: "casa" }),
          } satisfies ItemMenu,
        ]
      : []),
    {
      rotulo: temCartao ? "Compra no cartão" : "Novo cartão",
      descricao: temCartao ? "À vista, parcelada ou assinatura" : "Cadastre para lançar compras",
      icone: CreditCard,
      acao: () => abrir(temCartao ? { tipo: "compra" } : { tipo: "cartao" }),
    },
    "divisor",
    {
      rotulo: "Renda",
      descricao: "Freela, extra, aluguel recebido",
      icone: Banknote,
      acao: () => abrir({ tipo: "conta", natureza: "receita" }),
    },
    {
      rotulo: "Guardar na reserva",
      descricao: "Registrar um valor guardado",
      icone: PiggyBank,
      acao: guardar,
    },
  ];

  return (
    <Menu
      largura={268}
      itens={itens}
      gatilho={(alternar) => (
        <Botao variante="primario" onClick={alternar} className="max-sm:!w-10 max-sm:!px-0">
          <Plus size={16} strokeWidth={2.4} />
          <span className="max-sm:hidden">Adicionar</span>
          <ChevronDown size={16} className="-mr-1 opacity-80 max-sm:hidden" />
        </Botao>
      )}
    />
  );
}

/* ───────────────────────── Celular e avisos ───────────────────────── */

function NavInferior() {
  const caminho = usePathname();
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto grid max-w-[560px] grid-cols-5">
        {MENU.filter((m) => NO_CELULAR.includes(m.href)).map((item) => {
          const aqui = ativo(caminho, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={aqui ? "page" : undefined}
                className={cx(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px]/4 font-medium transition-colors",
                  aqui ? "text-primary-text" : "text-ink-3",
                )}
              >
                <item.icone size={20} strokeWidth={aqui ? 2.3 : 1.9} />
                {item.curto ?? item.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Avisos() {
  const { avisos } = useApp();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-8"
    >
      {avisos.map((a) => (
        <div
          key={a.id}
          role="status"
          className="flex max-w-[440px] animate-subir items-center gap-2 rounded-2xl bg-ink px-4 py-2 text-[13px]/5 font-medium text-surface shadow-pop"
        >
          {a.tipo === "ok" ? (
            <CircleCheck size={16} className="shrink-0 text-[#5adba5]" />
          ) : (
            <TriangleAlert size={16} className="shrink-0 text-[#ffb347]" />
          )}
          {a.texto}
        </div>
      ))}
    </div>
  );
}
