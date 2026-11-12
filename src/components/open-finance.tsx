"use client";

// Bancos ligados pelo Open Finance (Meu Pluggy): situação de cada conexão,
// quando foi a última busca e o botão para buscar agora.

import { useCallback, useEffect, useRef, useState } from "react";
import { Landmark, RefreshCw } from "lucide-react";
import { useApp } from "@/lib/app";
import type { StatusOpenFinance } from "@/lib/open-finance";
import { Botao, Etiqueta, Painel, TituloPainel, cx } from "./ui";

const SITUACAO = {
  ok: { tom: "bom", texto: "Em dia" },
  atualizando: { tom: "primario", texto: "Atualizando no banco" },
  reconectar: { tom: "alerta", texto: "Reconecte no Meu Pluggy" },
  erro: { tom: "ruim", texto: "Com problema" },
} as const;

/** "hoje às 13:05", "ontem às 19:00" ou "08/11 às 07:02". */
function quando(iso: string) {
  const d = new Date(iso);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const hoje = new Date();
  const ontem = new Date(hoje.getTime() - 86_400_000);
  const mesmoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (mesmoDia(d, hoje)) return `hoje às ${hora}`;
  if (mesmoDia(d, ontem)) return `ontem às ${hora}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${hora}`;
}

export function PainelOpenFinance() {
  const { backend, recarregar, avisar } = useApp();
  const of = backend.openFinance;
  const [status, setStatus] = useState<StatusOpenFinance | null>(null);
  const [buscando, setBuscando] = useState(false);
  const espera = useRef<ReturnType<typeof setInterval> | null>(null);

  const ler = useCallback(async () => {
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
    return () => {
      vivo = false;
      if (espera.current) clearInterval(espera.current);
    };
  }, [of]);

  if (!of || !status) return null;

  const buscar = async () => {
    setBuscando(true);
    const antes = status.buscadoEm;
    try {
      await of.buscarAgora();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível iniciar a busca.", "erro");
      setBuscando(false);
      return;
    }
    avisar("Buscando no banco. Leva uns 2 minutos; pode continuar usando o app.");
    const limite = Date.now() + 6 * 60_000;
    espera.current = setInterval(async () => {
      const s = await ler();
      const chegou = s && s.buscadoEm !== antes;
      if (!chegou && Date.now() < limite) return;
      if (espera.current) clearInterval(espera.current);
      espera.current = null;
      setBuscando(false);
      if (chegou) {
        await recarregar();
        const n = s.importado;
        const novos = n ? n.transacoes + n.compras : 0;
        avisar(
          novos
            ? `Pronto: ${novos} ${novos === 1 ? "movimentação nova" : "movimentações novas"} do banco.`
            : "Pronto: nada novo no banco desde a última busca.",
        );
      } else {
        avisar("A busca está demorando. Os dados aparecem sozinhos quando ela terminar.", "erro");
      }
    }, 15_000);
  };

  return (
    <Painel className="p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <TituloPainel detalhe="Open Finance">Bancos conectados</TituloPainel>
          <p className="mt-2 text-[13px]/5 text-ink-3">
            Última busca {quando(status.buscadoEm)}. O app busca sozinho às 7h, 13h e 19h.
          </p>
        </div>
        <Botao onClick={buscar} disabled={buscando}>
          <RefreshCw size={16} className={cx(buscando && "animate-spin")} />
          {buscando ? "Buscando..." : "Buscar agora"}
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
