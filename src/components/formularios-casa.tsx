"use client";

// Janelas da casa e da reserva: morador, criar ou entrar em uma casa,
// meta, movimentação e confirmação.

import { useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { useApp } from "@/lib/app";
import { saldoDaMeta } from "@/lib/calc";
import { novoId, type PreviaLar } from "@/lib/dados/backend";
import { formatar } from "@/lib/dinheiro";
import type { Aporte, Id, Meta, Morador } from "@/lib/types";
import {
  Avatar,
  Botao,
  Campo,
  cx,
  Entrada,
  EntradaNumero,
  EntradaValor,
  Modal,
  Segmentado,
  SeletorCor,
} from "./ui";
import { useModais } from "./modais-contexto";

function proximaCor(usadas: number[]): number {
  for (let i = 0; i < 8; i++) if (!usadas.includes(i)) return i;
  return usadas.length % 8;
}

/* ───────────────────────── Morador ───────────────────────── */

export function FormMorador({ morador, onFechar }: { morador?: Morador; onFechar: () => void }) {
  const { dados, lar, eu, inserir, atualizar, remover, avisar } = useApp();
  const { abrir } = useModais();
  const usadas = dados.moradores.filter((m) => m.id !== morador?.id).map((m) => m.cor);
  const [nome, setNome] = useState(morador?.nome ?? "");
  const [cor, setCor] = useState(morador?.cor ?? proximaCor(usadas));
  const [peso, setPeso] = useState(morador?.peso ?? 1);

  const salvar = async () => {
    if (!lar) return;
    if (!nome.trim()) return avisar("Informe o nome.", "erro");
    onFechar();
    if (morador) {
      await atualizar("moradores", morador.id, { nome: nome.trim(), cor, peso });
    } else {
      await inserir("moradores", {
        id: novoId(),
        larId: lar.id,
        nome: nome.trim(),
        cor,
        perfilId: null,
        peso,
        salarioCompartilhado: null,
      });
    }
    avisar(morador ? "Morador atualizado." : "Morador adicionado.");
  };

  const emUso =
    !!morador &&
    (dados.contas.some((c) => c.pagadorId === morador.id) ||
      dados.acertos.some((a) => a.deId === morador.id || a.paraId === morador.id));
  const podeExcluir = !!morador && morador.id !== eu?.id && morador.perfilId === null;

  const excluir = () => {
    if (!morador) return;
    if (emUso) {
      avisar(
        "Este morador paga contas ou tem acertos registrados. Troque o pagador dessas contas ou deixe o peso em 0.",
        "erro",
      );
      return;
    }
    abrir({
      tipo: "confirmar",
      titulo: `Tirar ${morador.nome} da casa?`,
      texto: "A pessoa sai da divisão de todas as contas.",
      rotulo: "Tirar da casa",
      acao: async () => {
        await remover("moradores", morador.id);
        avisar("Morador removido.");
      },
    });
  };

  return (
    <Modal
      titulo={morador ? "Editar morador" : "Novo morador"}
      descricao={
        morador
          ? undefined
          : "Quem mora na casa entra na divisão mesmo sem usar o app. Depois, a pessoa pode criar um perfil e assumir este cadastro com o código da casa."
      }
      onFechar={onFechar}
      onEnviar={salvar}
      rodape={
        <>
          {podeExcluir && (
            <Botao variante="fantasma" onClick={excluir} className="mr-auto !text-bad-text">
              <Trash2 size={16} />
              Tirar da casa
            </Botao>
          )}
          <Botao variante="fantasma" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit">
            Salvar
          </Botao>
        </>
      }
    >
      <Campo rotulo="Nome">
        <Entrada
          autoFocus={!morador}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Mãe, Ana"
          maxLength={30}
        />
      </Campo>
      <div>
        <span className="mb-2 block text-[13px]/5 font-medium text-ink-2">Cor</span>
        <SeletorCor valor={cor} onMudar={setCor} usadas={usadas} />
      </div>
      <Campo
        rotulo="Peso na divisão"
        dica="Peso 1 para todos divide por igual. Peso 2 faz a pessoa pagar o dobro de quem tem peso 1. Peso 0 tira a pessoa da divisão padrão."
      >
        <EntradaNumero valor={peso} onMudar={setPeso} min={0} max={99} />
      </Campo>
    </Modal>
  );
}

/* ───────────────────────── Criar ou entrar em uma casa ───────────────────────── */

export function FormLar({ aba: abaInicial, onFechar }: { aba?: "criar" | "entrar"; onFechar: () => void }) {
  const { backend, perfil, recarregar, avisar } = useApp();
  const [aba, setAba] = useState<"criar" | "entrar">(abaInicial ?? "criar");
  const [nome, setNome] = useState("Nossa casa");
  const [codigo, setCodigo] = useState("");
  const [previa, setPrevia] = useState<PreviaLar | null>(null);
  const [escolhido, setEscolhido] = useState<Id | "novo">("novo");
  const [ocupado, setOcupado] = useState(false);

  const executar = async (acao: () => Promise<void>, sucesso: string) => {
    setOcupado(true);
    try {
      await acao();
      await recarregar();
      avisar(sucesso);
      onFechar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível concluir.", "erro");
    } finally {
      setOcupado(false);
    }
  };

  const criar = () => {
    if (!perfil) return;
    if (!nome.trim()) return avisar("Dê um nome para a casa.", "erro");
    return executar(
      () =>
        backend.criarLar({
          larId: novoId(),
          moradorId: novoId(),
          nome: nome.trim(),
          moradorNome: perfil.nome,
          cor: perfil.cor,
        }),
      "Casa criada. Agora cadastre quem mora com você.",
    );
  };

  const procurar = async () => {
    if (codigo.trim().length < 4) return avisar("Digite o código da casa.", "erro");
    setOcupado(true);
    try {
      const achado = await backend.consultarLar(codigo);
      if (!achado) avisar("Nenhuma casa com esse código.", "erro");
      setPrevia(achado);
      // Se já existe um morador com o nome do perfil, é quase certo que é a própria pessoa.
      const mesmoNome = achado?.vagos.find(
        (v) => v.nome.trim().toLowerCase() === perfil?.nome.trim().toLowerCase(),
      );
      setEscolhido(mesmoNome?.id ?? achado?.vagos[0]?.id ?? "novo");
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível procurar.", "erro");
    } finally {
      setOcupado(false);
    }
  };

  const entrar = () => {
    if (!perfil || !previa) return;
    return executar(
      () =>
        backend.entrarNoLar({
          codigo,
          moradorId: escolhido === "novo" ? null : escolhido,
          novoId: novoId(),
          nome: perfil.nome,
          cor: perfil.cor,
        }),
      `Você entrou em "${previa.nome}".`,
    );
  };

  const enviar = () => (aba === "criar" ? criar() : previa ? entrar() : procurar());

  return (
    <Modal
      titulo="Sua casa"
      descricao="Uma casa junta as contas que você divide com quem mora com você."
      onFechar={onFechar}
      onEnviar={enviar}
      rodape={
        <>
          <Botao variante="fantasma" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" disabled={ocupado}>
            {aba === "criar" ? "Criar casa" : previa ? "Entrar na casa" : "Procurar"}
          </Botao>
        </>
      }
    >
      <Segmentado
        cheio
        rotulo="O que fazer"
        valor={aba}
        onMudar={(v) => {
          setAba(v);
          setPrevia(null);
        }}
        opcoes={[
          { valor: "criar", rotulo: "Criar uma casa" },
          { valor: "entrar", rotulo: "Tenho um código" },
        ]}
      />

      {aba === "criar" ? (
        <Campo
          rotulo="Nome da casa"
          dica="Depois de criar, você recebe um código para passar a quem mora com você."
        >
          <Entrada autoFocus value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} />
        </Campo>
      ) : (
        <>
          <Campo rotulo="Código da casa" dica="Quem criou a casa encontra o código na tela Casa.">
            <Entrada
              autoFocus
              value={codigo}
              onChange={(e) => {
                setCodigo(e.target.value.toUpperCase());
                setPrevia(null);
              }}
              placeholder="ABC123"
              maxLength={8}
              className="tabular text-center text-lg font-semibold tracking-[0.3em] uppercase"
            />
          </Campo>

          {previa && (
            <div className="rounded-2xl bg-surface-2 p-4">
              <p className="text-sm font-semibold text-ink">{previa.nome}</p>
              <p className="mt-1 text-xs text-ink-3">Quem é você nesta casa?</p>
              <div role="radiogroup" aria-label="Quem é você" className="mt-4 space-y-2">
                {previa.vagos.map((m) => (
                  <OpcaoMorador
                    key={m.id}
                    ativo={escolhido === m.id}
                    onClick={() => setEscolhido(m.id)}
                    inicio={<Avatar nome={m.nome} cor={m.cor} tamanho={32} />}
                    titulo={m.nome}
                    detalhe="Já cadastrado na casa"
                  />
                ))}
                <OpcaoMorador
                  ativo={escolhido === "novo"}
                  onClick={() => setEscolhido("novo")}
                  inicio={
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-surface-3 text-ink-2">
                      <UserPlus size={16} />
                    </span>
                  }
                  titulo="Sou um morador novo"
                  detalhe="Entra com o nome do seu perfil"
                />
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

function OpcaoMorador({
  ativo,
  onClick,
  inicio,
  titulo,
  detalhe,
}: {
  ativo: boolean;
  onClick: () => void;
  inicio: React.ReactNode;
  titulo: string;
  detalhe: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={ativo}
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-4 rounded-lg border px-4 py-2 text-left transition-colors",
        ativo ? "border-primary bg-primary-soft" : "border-line bg-surface hover:bg-surface-3",
      )}
    >
      {inicio}
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{titulo}</span>
        <span className="block text-xs text-ink-3">{detalhe}</span>
      </span>
    </button>
  );
}

/* ───────────────────────── Reserva: meta e movimentação ───────────────────────── */

export function FormMeta({ meta, onFechar }: { meta?: Meta; onFechar: () => void }) {
  const { lar, sessao, inserir, atualizar, removerMeta, avisar } = useApp();
  const { abrir } = useModais();
  const [nome, setNome] = useState(meta?.nome ?? "");
  const [alvo, setAlvo] = useState(meta?.alvo ?? 0);
  const [cor, setCor] = useState(meta?.cor ?? 2);
  const [escopo, setEscopo] = useState<"pessoal" | "casa">(meta?.larId ? "casa" : "pessoal");

  const salvar = async () => {
    if (!nome.trim()) return avisar("Dê um nome para a meta.", "erro");
    const daCasa = escopo === "casa" && lar;
    const linha: Meta = {
      id: meta?.id ?? novoId(),
      perfilId: daCasa ? null : (sessao?.userId ?? null),
      larId: daCasa ? lar.id : null,
      nome: nome.trim(),
      alvo,
      cor,
    };
    onFechar();
    if (meta) await atualizar("metas", meta.id, { nome: linha.nome, alvo, cor });
    else await inserir("metas", linha);
    avisar(meta ? "Meta atualizada." : "Meta criada.");
  };

  const excluir = () =>
    abrir({
      tipo: "confirmar",
      titulo: `Excluir a meta "${meta?.nome}"?`,
      texto: "O histórico do que foi guardado nela também é apagado.",
      rotulo: "Excluir meta",
      acao: async () => {
        if (meta) await removerMeta(meta.id);
        avisar("Meta excluída.");
      },
    });

  return (
    <Modal
      titulo={meta ? "Editar meta" : "Nova meta"}
      onFechar={onFechar}
      onEnviar={salvar}
      rodape={
        <>
          {meta && (
            <Botao variante="fantasma" onClick={excluir} className="mr-auto !text-bad-text">
              <Trash2 size={16} />
              Excluir
            </Botao>
          )}
          <Botao variante="fantasma" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit">
            Salvar
          </Botao>
        </>
      }
    >
      {!meta && lar && (
        <Segmentado
          rotulo="De quem é a meta"
          valor={escopo}
          onMudar={setEscopo}
          opcoes={[
            { valor: "pessoal", rotulo: "Só minha" },
            { valor: "casa", rotulo: "Da casa" },
          ]}
        />
      )}
      <Campo rotulo="Nome">
        <Entrada
          autoFocus={!meta}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Reserva de emergência, viagem"
          maxLength={40}
        />
      </Campo>
      <Campo rotulo="Quanto quer juntar" dica="Deixe zerado se não houver um valor alvo.">
        <EntradaValor valor={alvo} onMudar={setAlvo} />
      </Campo>
      <div>
        <span className="mb-2 block text-[13px]/5 font-medium text-ink-2">Cor</span>
        <SeletorCor valor={cor} onMudar={setCor} />
      </div>
    </Modal>
  );
}

export function FormAporte({
  metaId,
  retirada,
  onFechar,
}: {
  metaId: Id;
  retirada?: boolean;
  onFechar: () => void;
}) {
  const { dados, hoje, sessao, inserir, avisar } = useApp();
  const meta = dados.metas.find((m) => m.id === metaId);
  const [tipo, setTipo] = useState<"guardar" | "retirar">(retirada ? "retirar" : "guardar");
  const [valor, setValor] = useState(0);
  const [data, setData] = useState(hoje);
  const [descricao, setDescricao] = useState("");

  const salvar = async () => {
    if (!meta) return;
    if (valor <= 0) return avisar("Informe um valor maior que zero.", "erro");
    const guardado = saldoDaMeta(meta, dados);
    if (tipo === "retirar" && valor > guardado) {
      return avisar(`Só há ${formatar(guardado)} guardado nesta meta.`, "erro");
    }
    const linha: Aporte = {
      id: novoId(),
      metaId: meta.id,
      perfilId: meta.larId ? null : (sessao?.userId ?? null),
      larId: meta.larId,
      valor: tipo === "guardar" ? valor : -valor,
      data,
      descricao: descricao.trim(),
    };
    onFechar();
    await inserir("aportes", linha);
    avisar(tipo === "guardar" ? "Valor guardado." : "Retirada registrada.");
  };

  return (
    <Modal
      titulo={meta?.nome ?? "Reserva"}
      onFechar={onFechar}
      onEnviar={salvar}
      rodape={
        <>
          <Botao variante="fantasma" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit">
            {tipo === "guardar" ? "Guardar" : "Retirar"}
          </Botao>
        </>
      }
    >
      <Segmentado
        cheio
        rotulo="Movimentação"
        valor={tipo}
        onMudar={setTipo}
        opcoes={[
          { valor: "guardar", rotulo: "Guardar" },
          { valor: "retirar", rotulo: "Retirar" },
        ]}
      />
      <div className="grid grid-cols-2 gap-4">
        <Campo rotulo="Valor">
          <EntradaValor valor={valor} onMudar={setValor} autoFocus />
        </Campo>
        <Campo rotulo="Data">
          <Entrada type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Campo>
      </div>
      <Campo rotulo="Anotação (opcional)">
        <Entrada
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex.: 13º salário"
          maxLength={60}
        />
      </Campo>
    </Modal>
  );
}

/* ───────────────────────── Confirmação ───────────────────────── */

export function Confirmar({
  titulo,
  texto,
  rotulo,
  acao,
  onFechar,
}: {
  titulo: string;
  texto: string;
  rotulo: string;
  acao: () => void | Promise<void>;
  onFechar: () => void;
}) {
  return (
    <Modal
      titulo={titulo}
      onFechar={onFechar}
      onEnviar={async () => {
        onFechar();
        await acao();
      }}
      largura="sm:max-w-[424px]"
      rodape={
        <>
          <Botao variante="fantasma" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao variante="perigo" type="submit" autoFocus>
            {rotulo}
          </Botao>
        </>
      }
    >
      <p className="text-sm leading-6 text-ink-2">{texto}</p>
    </Modal>
  );
}
