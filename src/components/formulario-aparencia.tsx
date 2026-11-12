"use client";

// Janela de aparência: tema, cor de destaque e tamanho do texto. As mudanças
// valem na hora e ficam guardadas neste aparelho.

import { Check, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useApp } from "@/lib/app";
import { CORES_DESTAQUE, PAINEIS, type ModoTema } from "@/lib/aparencia";
import { SeletorImagem } from "./seletor-imagem";
import { Botao, cx, Modal, Segmentado } from "./ui";

const TEMAS: { id: ModoTema; nome: string; icone: LucideIcon; fundo: string; cartao: string; linha: string }[] = [
  { id: "claro", nome: "Claro", icone: Sun, fundo: "#f1f2f5", cartao: "#ffffff", linha: "#e3e5ea" },
  { id: "escuro", nome: "Escuro", icone: Moon, fundo: "#0b0c0f", cartao: "#1c1f25", linha: "#2c3039" },
  { id: "sistema", nome: "Automático", icone: Monitor, fundo: "", cartao: "", linha: "" },
];

/** Miniatura de uma tela do app, para escolher o tema vendo o resultado. */
function Miniatura({ fundo, cartao, linha, destaque }: { fundo: string; cartao: string; linha: string; destaque: string }) {
  return (
    <div className="flex h-full gap-2 p-2" style={{ background: fundo }}>
      <div className="w-1/4 rounded" style={{ background: cartao }}>
        <div className="m-2 h-2 w-2/3 rounded-full" style={{ background: destaque }} />
        <div className="mx-2 mt-1 h-1 w-1/2 rounded-full" style={{ background: linha }} />
        <div className="mx-2 mt-1 h-1 w-3/5 rounded-full" style={{ background: linha }} />
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex-1 rounded p-2" style={{ background: cartao }}>
          <div className="h-2 w-1/3 rounded-full" style={{ background: linha }} />
          <div className="mt-2 h-2 w-1/2 rounded-full" style={{ background: linha }} />
        </div>
        <div className="flex h-1/3 gap-2">
          <div className="flex-1 rounded" style={{ background: cartao }} />
          <div className="w-1/3 rounded" style={{ background: destaque }} />
        </div>
      </div>
    </div>
  );
}

export function FormAparencia({ onFechar }: { onFechar: () => void }) {
  const { aparencia, setAparencia, tema, avisar } = useApp();
  const temIlustracao = Object.keys(aparencia.ilustracoes).length > 0;
  const corAtual = CORES_DESTAQUE.find((c) => c.id === aparencia.cor) ?? CORES_DESTAQUE[0];
  const amostra = (escuro: boolean) => (escuro ? corAtual.escuro : corAtual.claro);

  return (
    <Modal
      titulo="Aparência"
      descricao="Vale só para este aparelho. Cada pessoa da casa pode deixar do seu jeito. (Fotos dos cartões ficam em cada cartão, em Cartões.)"
      onFechar={onFechar}
      onEnviar={onFechar}
      largura="sm:max-w-[600px]"
      rodape={
        <Botao variante="primario" type="submit">
          Pronto
        </Botao>
      }
    >
      <div>
        <p className="mb-2 text-[13px]/5 font-medium text-ink-2">Tema</p>
        <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2">
          {TEMAS.map((t) => {
            const ativo = aparencia.tema === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => setAparencia({ tema: t.id })}
                className={cx(
                  "overflow-hidden rounded-2xl border text-left transition-all",
                  ativo ? "border-primary ring-2 ring-primary/30" : "border-line hover:border-line-strong",
                )}
              >
                <div className="h-[72px] border-b border-line">
                  {t.id === "sistema" ? (
                    <div className="relative h-full">
                      <div className="absolute inset-0" style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }}>
                        <Miniatura fundo={TEMAS[0].fundo} cartao={TEMAS[0].cartao} linha={TEMAS[0].linha} destaque={amostra(false)} />
                      </div>
                      <div className="absolute inset-0" style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}>
                        <Miniatura fundo={TEMAS[1].fundo} cartao={TEMAS[1].cartao} linha={TEMAS[1].linha} destaque={amostra(true)} />
                      </div>
                    </div>
                  ) : (
                    <Miniatura fundo={t.fundo} cartao={t.cartao} linha={t.linha} destaque={amostra(t.id === "escuro")} />
                  )}
                </div>
                <span className="flex items-center gap-2 px-4 py-2 text-[13px]/5 font-medium text-ink">
                  <t.icone size={16} className="text-ink-3" />
                  {t.nome}
                </span>
              </button>
            );
          })}
        </div>
        {aparencia.tema === "sistema" && (
          <p className="mt-2 text-xs text-ink-3">
            Segue o tema do aparelho. Agora está {tema === "escuro" ? "escuro" : "claro"}.
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 text-[13px]/5 font-medium text-ink-2">Cor de destaque</p>
        <div role="radiogroup" aria-label="Cor de destaque" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {CORES_DESTAQUE.map((c) => {
            const ativo = aparencia.cor === c.id;
            const cor = tema === "escuro" ? c.escuro : c.claro;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => setAparencia({ cor: c.id })}
                className={cx(
                  "flex flex-col items-center gap-2 rounded-lg border px-1 py-2 transition-colors",
                  ativo ? "border-primary bg-primary-soft" : "border-line hover:bg-surface-2",
                )}
              >
                <span
                  className="grid h-8 w-8 place-items-center rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"
                  style={{ background: cor }}
                >
                  {ativo && (
                    <Check size={16} strokeWidth={3} color={c.id === "grafite" && tema === "escuro" ? "#111827" : "#fff"} />
                  )}
                </span>
                <span className="text-xs font-medium text-ink-2">{c.nome}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs leading-5 text-ink-3">
          Muda botões, menus e o logo. As cores dos gráficos e das pessoas continuam as mesmas, para
          não confundir.
        </p>
      </div>

      <div>
        <p className="mb-2 text-[13px]/5 font-medium text-ink-2">Tamanho do texto</p>
        <Segmentado
          cheio
          rotulo="Tamanho do texto"
          valor={aparencia.tamanho}
          onMudar={(v) => setAparencia({ tamanho: v })}
          opcoes={[
            { valor: "normal", rotulo: "Normal" },
            { valor: "grande", rotulo: "Grande" },
          ]}
        />
      </div>

      <div>
        <div className="mb-1 flex items-baseline justify-between gap-4">
          <p className="text-[13px]/5 font-medium text-ink-2">Ilustrações da Visão geral</p>
          {temIlustracao && (
            <button
              type="button"
              onClick={() => setAparencia({ ilustracoes: {} })}
              className="text-xs font-medium text-primary-text hover:underline"
            >
              Voltar todas ao padrão
            </button>
          )}
        </div>
        <p className="mb-4 text-xs leading-5 text-ink-3">
          Troque o desenho do canto de cada painel por uma imagem sua. Imagens com fundo
          transparente (PNG), como ícones 3D, ficam melhores.
        </p>
        <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
          {PAINEIS.map((p) => (
            <SeletorImagem
              key={p.id}
              rotulo={p.nome}
              uso="ilustracao"
              formato="quadrado"
              valor={aparencia.ilustracoes[p.id] ?? null}
              onMudar={(img) => {
                const ilustracoes = { ...aparencia.ilustracoes };
                if (img) ilustracoes[p.id] = img;
                else delete ilustracoes[p.id];
                setAparencia({ ilustracoes });
              }}
              onErro={(m) => avisar(m, "erro")}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}
