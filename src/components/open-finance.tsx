"use client";

// Bancos ligados pelo Open Finance (Meu Pluggy).
//
// A busca é um "serviço" do app inteiro (BuscaNoBancoProvider): o botão
// Atualizar do topo, o painel de Carteiras e o sino olham o mesmo estado.
// Atualizar busca na hora os dados mais novos, acompanha a busca no GitHub (na
// fila, rodando, pronta ou com falha) e recarrega a tela quando os dados chegam.
// Quem conversa com os bancos é o Meu Pluggy, sozinho (em geral uma vez por
// dia): ele não aceita pedido de atualização de fora.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ExternalLink, Landmark, RefreshCw } from "lucide-react";
import { useApp } from "@/lib/app";
import type { AndamentoBusca } from "@/lib/dados/backend";
import { buscaParada, type StatusOpenFinance } from "@/lib/open-finance";
import { BotaoIcone, Botao, Etiqueta, Painel, TituloPainel, cx } from "./ui";

const SITUACAO = {
  ok: { tom: "bom", texto: "Em dia" },
  atualizando: { tom: "primario", texto: "Atualizando no banco" },
  reconectar: { tom: "alerta", texto: "Reconecte no Meu Pluggy" },
  erro: { tom: "ruim", texto: "Com problema" },
} as const;

/** O que a tela mostra enquanto a busca anda. */
const FASES: Record<AndamentoBusca["situacao"], string> = {
  fila: "Na fila do GitHub...",
  rodando: "Buscando os dados mais novos...",
  pronta: "Gravando...",
  falhou: "A busca falhou.",
};

/** A vez mais recente em que o Meu Pluggy falou com algum banco. */
function bancosAtualizadosEm(status: StatusOpenFinance) {
  const datas = status.conexoes
    .map((c) => c.atualizadoNoBancoEm)
    .filter((d): d is string => !!d)
    .sort();
  return datas.at(-1) ?? null;
}

/** "hoje às 13:05", "ontem às 19:00" ou "08/11 às 07:02". */
export function quando(iso: string) {
  const d = new Date(iso);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const hoje = new Date();
  const ontem = new Date(hoje.getTime() - 86_400_000);
  const mesmoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (mesmoDia(d, hoje)) return `hoje às ${hora}`;
  if (mesmoDia(d, ontem)) return `ontem às ${hora}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${hora}`;
}

/* ───────────────────────── O serviço ───────────────────────── */

interface BuscaNoBanco {
  /** O app tem busca no banco (modo GitHub com Open Finance configurado). */
  disponivel: boolean;
  status: StatusOpenFinance | null;
  buscando: boolean;
  /** O passo atual, enquanto busca. */
  fase: string | null;
  /** Página da última busca no GitHub (para ver uma falha). */
  endereco: string | null;
  /** A última busca pedida pelo app falhou. */
  falhou: boolean;
  atualizar: () => Promise<void>;
}

const Contexto = createContext<BuscaNoBanco>({
  disponivel: false,
  status: null,
  buscando: false,
  fase: null,
  endereco: null,
  falhou: false,
  atualizar: async () => undefined,
});

export const useBuscaNoBanco = () => useContext(Contexto);

/** Quanto esperar a busca no GitHub antes de desistir de acompanhar. */
const LIMITE_MS = 8 * 60_000;

export function BuscaNoBancoProvider({ children }: { children: ReactNode }) {
  const { backend, recarregar, avisar } = useApp();
  const of = backend.openFinance;
  const [status, setStatus] = useState<StatusOpenFinance | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [fase, setFase] = useState<string | null>(null);
  const [endereco, setEndereco] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);
  const relogio = useRef<ReturnType<typeof setInterval> | null>(null);

  const lerStatus = useCallback(async () => {
    if (!of) return null;
    try {
      const s = await of.status();
      setStatus(s);
      return s;
    } catch {
      return null;
    }
  }, [of]);

  useEffect(() => {
    if (!of) return;
    let vivo = true;
    of.status()
      .then((s) => vivo && setStatus(s))
      .catch(() => undefined);
    // Ao voltar para o app, a hora da última busca (e o aviso de parada) se atualiza.
    const aoVoltar = () => {
      if (document.visibilityState === "visible" && !relogio.current) {
        of.status()
          .then((s) => vivo && setStatus(s))
          .catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      vivo = false;
      document.removeEventListener("visibilitychange", aoVoltar);
      if (relogio.current) clearInterval(relogio.current);
    };
  }, [of]);

  const terminar = useCallback(() => {
    if (relogio.current) clearInterval(relogio.current);
    relogio.current = null;
    setBuscando(false);
    setFase(null);
  }, []);

  const atualizar = useCallback(async () => {
    if (!of || relogio.current) return;
    const antes = status?.buscadoEm ?? null;
    const pedidaEm = Date.now();
    setBuscando(true);
    setFalhou(false);
    setFase("Pedindo a busca...");
    try {
      await of.buscarAgora();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível iniciar a busca.", "erro");
      terminar();
      return;
    }
    avisar("Buscando os dados mais novos: leva uns 2 minutos. Pode continuar usando o app.");

    relogio.current = setInterval(async () => {
      // Como anda a busca no GitHub (a desta vez: pedida há pouco).
      const andamento = await of.andamento?.().catch(() => null);
      const destaVez = andamento && Date.parse(andamento.pedidaEm) >= pedidaEm - 60_000;
      if (destaVez) {
        setEndereco(andamento.endereco);
        setFase(FASES[andamento.situacao]);
        if (andamento.situacao === "falhou") {
          terminar();
          setFalhou(true);
          avisar(
            "A busca no banco falhou. Abra Carteiras > Bancos conectados para ver o motivo.",
            "erro",
          );
          return;
        }
      }
      // Os dados chegaram quando o arquivo de situação muda.
      const s = await lerStatus();
      if (s && s.buscadoEm !== antes) {
        terminar();
        await recarregar();
        // O GitHub pode demorar um pouco a entregar o arquivo novo: confere de novo.
        setTimeout(() => void recarregar(), 45_000);
        const n = s.importado;
        const novos = n ? n.transacoes + n.compras : 0;
        const noBanco = bancosAtualizadosEm(s);
        avisar(
          novos
            ? `Pronto: ${novos} ${novos === 1 ? "movimentação nova" : "movimentações novas"} dos bancos.`
            : `Pronto: nada novo.${noBanco ? ` O Meu Pluggy falou com os bancos ${quando(noBanco)}.` : ""}`,
        );
        return;
      }
      if (Date.now() - pedidaEm > LIMITE_MS) {
        terminar();
        avisar("A busca está demorando. Os dados aparecem sozinhos quando ela terminar.", "erro");
      }
    }, 10_000);
  }, [of, status, avisar, terminar, lerStatus, recarregar]);

  const valor = useMemo(
    () => ({ disponivel: !!of && !!status, status, buscando, fase, endereco, falhou, atualizar }),
    [of, status, buscando, fase, endereco, falhou, atualizar],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/* ───────────────────────── Botão do topo ───────────────────────── */

/** Atualizar: pede aos bancos dados novos. Aparece quando há busca no banco. */
export function BotaoAtualizar() {
  const { disponivel, status, buscando, fase, atualizar } = useBuscaNoBanco();
  if (!disponivel || !status) return null;
  const rotulo = buscando
    ? (fase ?? "Atualizando...")
    : `Buscar os dados mais novos (última busca ${quando(status.buscadoEm)})`;
  return (
    <BotaoIcone
      icone={RefreshCw}
      rotulo={rotulo}
      disabled={buscando}
      onClick={() => void atualizar()}
      className={cx(
        "border border-line bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.05)] disabled:opacity-100",
        buscando && "text-primary [&_svg]:animate-spin",
      )}
    />
  );
}

/* ───────────────────────── Painel de Carteiras ───────────────────────── */

export function PainelOpenFinance() {
  const { disponivel, status, buscando, fase, endereco, falhou, atualizar } = useBuscaNoBanco();
  if (!disponivel || !status) return null;

  return (
    <Painel className="p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <TituloPainel detalhe="Open Finance">Bancos conectados</TituloPainel>
          <p className="mt-2 text-[13px]/5 text-ink-3">
            {buscando && fase ? (
              <span className="font-medium text-primary-text">{fase}</span>
            ) : (
              <>
                Última busca {quando(status.buscadoEm)}. O app busca sozinho às 7h, 13h e 19h,
                e &quot;Atualizar&quot; busca na hora. Os bancos passam os dados ao Meu Pluggy
                sozinhos, em geral uma vez por dia: a hora de cada um está abaixo.
              </>
            )}
          </p>
          {!buscando && buscaParada(status) && (
            <p className="mt-2 text-[13px]/5 text-warn-text">
              A busca automática não roda há mais de 12 horas. Use &quot;Atualizar&quot; e, se
              continuar, confira em Actions, no repositório dos dados no GitHub, se a tarefa
              &quot;Buscar no banco&quot; está ativa.
            </p>
          )}
          {!buscando && falhou && endereco && (
            <p className="mt-2 text-[13px]/5 text-bad-text">
              A última busca falhou.{" "}
              <a
                href={endereco}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium underline underline-offset-4"
              >
                Ver o motivo no GitHub
                <ExternalLink size={12} />
              </a>
            </p>
          )}
        </div>
        <Botao onClick={() => void atualizar()} disabled={buscando}>
          <RefreshCw size={16} className={cx(buscando && "animate-spin")} />
          {buscando ? "Atualizando..." : "Atualizar"}
        </Botao>
      </div>
      <ul className="mt-4 divide-y divide-line">
        {status.conexoes.map((c, i) => {
          const s = SITUACAO[c.situacao] ?? SITUACAO.erro;
          return (
            <li key={i} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-2">
                <Landmark size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{c.banco}</span>
                <span className="block truncate text-xs text-ink-3">
                  {c.erro ??
                    [
                      c.perfil,
                      `${c.contas} ${c.contas === 1 ? "conta" : "contas"}`,
                      c.atualizadoNoBancoEm && `banco atualizado ${quando(c.atualizadoNoBancoEm)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                </span>
              </span>
              <Etiqueta tom={s.tom}>{s.texto}</Etiqueta>
            </li>
          );
        })}
      </ul>
    </Painel>
  );
}
