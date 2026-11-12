"use client";

// Busca em tudo (Ctrl+K): telas, contas, transações, compras, cartões, metas e
// moradores. Enter abre o item; setas mudam a escolha.

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Banknote,
  CreditCard,
  House,
  LayoutGrid,
  PiggyBank,
  Receipt,
  Search,
  ShoppingBag,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useApp } from "@/lib/app";
import { categoria } from "@/lib/categorias";
import { formatar } from "@/lib/dinheiro";
import { dataBR } from "@/lib/meses";
import { useModais, type PedidoModal } from "./modais-contexto";
import { cx } from "./ui";

interface Resultado {
  id: string;
  grupo: string;
  titulo: string;
  detalhe?: string;
  icone: LucideIcon;
  acao: () => void;
}

const PAGINAS: { titulo: string; href: string; icone: LucideIcon; palavras: string }[] = [
  { titulo: "Visão geral", href: "/", icone: LayoutGrid, palavras: "inicio painel resumo" },
  { titulo: "Transações", href: "/transacoes", icone: ArrowLeftRight, palavras: "extrato gastos dia a dia" },
  { titulo: "Fluxo de caixa", href: "/fluxo", icone: ArrowLeftRight, palavras: "entradas saidas meses categorias" },
  { titulo: "Cartões", href: "/cartoes", icone: CreditCard, palavras: "fatura parcelas limite" },
  { titulo: "Carteiras", href: "/carteiras", icone: Wallet, palavras: "saldo banco conta patrimonio" },
  { titulo: "Casa", href: "/casa", icone: House, palavras: "divisao moradores acerto pix" },
  { titulo: "Reserva", href: "/reserva", icone: PiggyBank, palavras: "metas guardar" },
  { titulo: "Contas", href: "/contas", icone: Receipt, palavras: "contas fixas recorrentes" },
  { titulo: "Minha renda", href: "/renda", icone: Banknote, palavras: "salario perfil copia celular" },
];

const normal = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function Busca({ onFechar }: { onFechar: () => void }) {
  const { dados } = useApp();
  const { abrir } = useModais();
  const router = useRouter();
  const [termo, setTermo] = useState("");
  const [escolhido, setEscolhido] = useState(0);
  const lista = useRef<HTMLUListElement>(null);

  const resultados = useMemo(() => {
    const t = normal(termo.trim());
    const bate = (...textos: (string | undefined)[]) => !t || textos.some((x) => x && normal(x).includes(t));
    const ir = (href: string) => () => {
      onFechar();
      router.push(href);
    };
    const janela = (p: PedidoModal) => () => {
      onFechar();
      abrir(p);
    };
    const r: Resultado[] = [];
    for (const p of PAGINAS) {
      if (bate(p.titulo, p.palavras)) r.push({ id: p.href, grupo: "Telas", titulo: p.titulo, icone: p.icone, acao: ir(p.href) });
    }
    if (t) {
      for (const c of dados.contas) {
        if (bate(c.nome, categoria(c.categoria).nome))
          r.push({ id: c.id, grupo: "Contas", titulo: c.nome, detalhe: formatar(c.valor), icone: categoria(c.categoria).icone, acao: janela({ tipo: "conta", conta: c }) });
      }
      for (const x of [...dados.transacoes].sort((a, b) => b.data.localeCompare(a.data))) {
        if (bate(x.descricao, x.observacao, categoria(x.categoria).nome))
          r.push({ id: x.id, grupo: "Transações", titulo: x.descricao, detalhe: `${dataBR(x.data)} · ${formatar(x.valor)}`, icone: categoria(x.categoria).icone, acao: janela({ tipo: "transacao", transacao: x }) });
      }
      for (const c of dados.compras) {
        if (bate(c.descricao))
          r.push({ id: c.id, grupo: "Compras no cartão", titulo: c.descricao, detalhe: `${dataBR(c.data)} · ${formatar(c.valor)}`, icone: ShoppingBag, acao: janela({ tipo: "compra", compra: c }) });
      }
      for (const c of dados.cartoes) {
        if (bate(c.nome, c.banco)) r.push({ id: c.id, grupo: "Cartões", titulo: c.nome, detalhe: c.banco, icone: CreditCard, acao: janela({ tipo: "cartao", cartao: c }) });
      }
      for (const c of dados.carteiras) {
        if (bate(c.nome)) r.push({ id: c.id, grupo: "Carteiras", titulo: c.nome, icone: Wallet, acao: janela({ tipo: "carteira", carteira: c }) });
      }
      for (const m of dados.metas) {
        if (bate(m.nome)) r.push({ id: m.id, grupo: "Reserva", titulo: m.nome, icone: PiggyBank, acao: janela({ tipo: "meta", meta: m }) });
      }
      for (const m of dados.moradores) {
        if (bate(m.nome)) r.push({ id: m.id, grupo: "Moradores", titulo: m.nome, icone: UserRound, acao: janela({ tipo: "morador", morador: m }) });
      }
    }
    return r.slice(0, 40);
  }, [termo, dados, abrir, router, onFechar]);

  const atual = Math.min(escolhido, Math.max(0, resultados.length - 1));

  useEffect(() => {
    lista.current?.querySelector(`[data-indice="${atual}"]`)?.scrollIntoView({ block: "nearest" });
  }, [atual]);

  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = anterior;
    };
  }, []);

  const teclar = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onFechar();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setEscolhido((i) => Math.min(i + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setEscolhido((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      resultados[atual]?.acao();
    }
  };

  let grupoAnterior = "";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh] sm:p-6 sm:pt-[12vh]">
      <div className="absolute inset-0 animate-surgir bg-[var(--overlay)] backdrop-blur-[2px]" onClick={onFechar} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar"
        className="relative flex max-h-[70vh] w-full max-w-[584px] animate-subir flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-pop"
      >
        <label className="flex items-center gap-4 border-b border-line px-6">
          <Search size={20} className="shrink-0 text-ink-3" />
          <input
            autoFocus
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value);
              setEscolhido(0);
            }}
            onKeyDown={teclar}
            placeholder="Buscar contas, transações, compras, telas..."
            aria-label="Buscar"
            role="combobox"
            aria-expanded="true"
            aria-controls="resultados-busca"
            aria-activedescendant={resultados[atual] ? `busca-${atual}` : undefined}
            className="h-14 w-full bg-transparent text-[15px]/6 text-ink outline-none placeholder:text-ink-3"
          />
          <kbd className="hidden shrink-0 rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px]/4 text-ink-3 sm:block">Esc</kbd>
        </label>
        <ul ref={lista} id="resultados-busca" role="listbox" className="rolagem-fina overflow-y-auto p-2">
          {resultados.length === 0 && <li className="px-4 py-8 text-center text-sm text-ink-3">Nada encontrado para &quot;{termo}&quot;.</li>}
          {resultados.map((r, i) => {
            const cabecalho = r.grupo !== grupoAnterior;
            grupoAnterior = r.grupo;
            return (
              <li key={`${r.grupo}-${r.id}`} role="presentation">
                {cabecalho && <p className="px-4 pt-4 pb-1 text-[11px]/4 font-semibold tracking-[0.08em] text-ink-3 uppercase">{r.grupo}</p>}
                <button
                  type="button"
                  id={`busca-${i}`}
                  role="option"
                  aria-selected={i === atual}
                  data-indice={i}
                  onMouseMove={() => setEscolhido(i)}
                  onClick={r.acao}
                  className={cx(
                    "flex w-full items-center gap-4 rounded-lg px-4 py-2 text-left transition-colors",
                    i === atual ? "bg-primary-soft" : "hover:bg-surface-2",
                  )}
                >
                  <r.icone size={16} className={i === atual ? "text-primary-text" : "text-ink-3"} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{r.titulo}</span>
                  {r.detalhe && <span className="tabular shrink-0 truncate text-xs text-ink-3">{r.detalhe}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
