"use client";

import { CartoesResumo, DivisaoCasa, ReservaResumo } from "@/components/visao-casa";
import { cx } from "@/components/ui";
import { useApp } from "@/lib/app";
import {
  AindaPodeGastar,
  DistribuicaoGastos,
  ResultadoMes,
  TransacoesRecentes,
} from "@/components/visao-dia";
import { ContasAPagar, Moradia, SaldoPrevisto } from "@/components/visao-pessoal";

// No computador: duas colunas (esquerda larga, direita com contas e moradia).
// Em telas menores os painéis viram uma coluna só, na ordem de uso.
// Em ultrawide, os seis painéis do meio ficam em duas linhas de três.
export default function VisaoGeral() {
  const { lar } = useApp();
  return (
    <div className="grid gap-4 sm:gap-6 md:max-xl:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_408px] xl:items-start ultra:grid-cols-[minmax(0,1fr)_480px]">
      <div className="grid min-w-0 gap-4 max-xl:contents sm:gap-6 ultra:grid-cols-3">
        <div className="md:max-xl:col-span-2 ultra:col-span-3">
          <SaldoPrevisto />
        </div>
        <div className="grid gap-4 max-xl:contents sm:gap-6 xl:grid-cols-2 ultra:contents">
          <div className="min-w-0 max-xl:order-3">
            <AindaPodeGastar />
          </div>
          <div className="min-w-0 max-xl:order-4">
            <DistribuicaoGastos />
          </div>
        </div>
        <div className="grid gap-4 max-xl:contents sm:gap-6 xl:grid-cols-2 ultra:contents">
          {/* Sem casa criada, o quadro da casa sai daqui (a tela Casa continua no
              menu) e os cartões ocupam a linha. */}
          {lar && (
            <div className="min-w-0 max-xl:order-5">
              <DivisaoCasa />
            </div>
          )}
          <div
            className={cx(
              "min-w-0 max-xl:order-6",
              !lar && "md:max-xl:col-span-2 xl:col-span-2 ultra:col-span-1",
            )}
          >
            <CartoesResumo />
          </div>
        </div>
        <div className="grid gap-4 max-xl:contents sm:gap-6 xl:grid-cols-2 ultra:contents">
          <div className="min-w-0 max-xl:order-8">
            <TransacoesRecentes />
          </div>
          <div className="min-w-0 max-xl:order-9">
            <ResultadoMes />
          </div>
        </div>
        <div className="max-xl:order-10 md:max-xl:col-span-2 ultra:col-span-3">
          <ReservaResumo />
        </div>
      </div>
      <div className="grid min-w-0 gap-4 max-xl:contents sm:gap-6">
        <div className="min-w-0 max-xl:order-2">
          <ContasAPagar />
        </div>
        <div className="min-w-0 max-xl:order-7">
          <Moradia />
        </div>
      </div>
    </div>
  );
}
