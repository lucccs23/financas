"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Confirmar, FormAporte, FormLar, FormMeta, FormMorador } from "./formularios-casa";
import { FormCartao, FormCompra, FormConta, FormOcorrencia } from "./formularios-contas";
import { FormAparencia } from "./formulario-aparencia";
import { FormImportar } from "./formulario-importar";
import { FormCarteira, FormImportarExtrato, FormTransacao } from "./formularios-transacoes";
import { ContextoModais, type PedidoModal } from "./modais-contexto";

/** Mantém uma janela aberta por vez e a desenha por cima de qualquer tela. */
export function ModaisProvider({ children }: { children: ReactNode }) {
  const [pedido, setPedido] = useState<{ p: PedidoModal; n: number } | null>(null);

  const abrir = useCallback(
    (p: PedidoModal) => setPedido((atual) => ({ p, n: (atual?.n ?? 0) + 1 })),
    [],
  );
  const fechar = useCallback(() => setPedido(null), []);
  const valor = useMemo(() => ({ abrir, fechar }), [abrir, fechar]);

  return (
    <ContextoModais.Provider value={valor}>
      {children}
      {pedido && <Janela key={pedido.n} pedido={pedido.p} onFechar={fechar} />}
    </ContextoModais.Provider>
  );
}

function Janela({ pedido, onFechar }: { pedido: PedidoModal; onFechar: () => void }) {
  switch (pedido.tipo) {
    case "conta":
      return (
        <FormConta
          conta={pedido.conta}
          escopo={pedido.escopo}
          natureza={pedido.natureza}
          onFechar={onFechar}
        />
      );
    case "ocorrencia":
      return <FormOcorrencia item={pedido.item} mes={pedido.mes} onFechar={onFechar} />;
    case "cartao":
      return <FormCartao cartao={pedido.cartao} foco={pedido.foco} onFechar={onFechar} />;
    case "compra":
      return <FormCompra compra={pedido.compra} cartaoId={pedido.cartaoId} onFechar={onFechar} />;
    case "transacao":
      return <FormTransacao transacao={pedido.transacao} tipo={pedido.tipoTransacao} onFechar={onFechar} />;
    case "carteira":
      return <FormCarteira carteira={pedido.carteira} onFechar={onFechar} />;
    case "importarExtrato":
      return <FormImportarExtrato onFechar={onFechar} />;
    case "aparencia":
      return <FormAparencia onFechar={onFechar} />;
    case "importar":
      return <FormImportar cartaoId={pedido.cartaoId} onFechar={onFechar} />;
    case "meta":
      return <FormMeta meta={pedido.meta} onFechar={onFechar} />;
    case "aporte":
      return <FormAporte metaId={pedido.metaId} retirada={pedido.retirada} onFechar={onFechar} />;
    case "morador":
      return <FormMorador morador={pedido.morador} onFechar={onFechar} />;
    case "lar":
      return <FormLar aba={pedido.aba} onFechar={onFechar} />;
    case "confirmar":
      return (
        <Confirmar
          titulo={pedido.titulo}
          texto={pedido.texto}
          rotulo={pedido.rotulo}
          acao={pedido.acao}
          onFechar={onFechar}
        />
      );
  }
}
