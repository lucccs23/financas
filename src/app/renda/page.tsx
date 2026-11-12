"use client";

import { useEffect, useRef, useState } from "react";
import { Banknote, Check, Copy, Download, LogOut, Plus, Trash2, Upload } from "lucide-react";
import { useApp, usePerfil } from "@/lib/app";
import { formatar } from "@/lib/dinheiro";
import { anoDe, mesCurto, nomeMes } from "@/lib/meses";
import { registrarRenda, rendaNoMes } from "@/lib/calc";
import type { Dados, Mes } from "@/lib/types";
import { SeletorMes } from "@/components/formularios-contas";
import { useModais } from "@/components/modais-contexto";
import {
  Alternar,
  Botao,
  CabecalhoPagina,
  Campo,
  Entrada,
  EntradaValor,
  Ladrilho,
  Painel,
  Segmentado,
  SeletorCor,
  TituloPainel,
} from "@/components/ui";

export default function PaginaRenda() {
  const { dados, eu, mes, modo, sessao, backend, atualizar, iniciar, avisar } = useApp();
  const perfil = usePerfil();
  const { abrir } = useModais();
  const [nome, setNome] = useState(perfil.nome);
  const [cor, setCor] = useState(perfil.cor);
  const arquivo = useRef<HTMLInputElement>(null);

  const perfilMudou = nome.trim() !== perfil.nome || cor !== perfil.cor;
  const rendas = dados.contas.filter((c) => c.natureza === "receita");

  const salvarPerfil = async () => {
    if (!nome.trim()) return avisar("Informe o nome.", "erro");
    await atualizar("perfis", perfil.id, { nome: nome.trim(), cor });
    if (eu) await atualizar("moradores", eu.id, { nome: nome.trim(), cor });
    avisar("Perfil atualizado.");
  };

  const exportar = async () => {
    const json = await backend.exportar?.();
    if (!json) return;
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "financas-copia.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const importar = async (file: File | undefined) => {
    if (!file) return;
    let texto: string;
    let resumo: string;
    try {
      texto = await file.text();
      const lido = JSON.parse(texto) as Partial<Dados>;
      const n = (t: keyof Dados) => (Array.isArray(lido[t]) ? lido[t].length : 0);
      if (!n("perfis")) throw new Error();
      resumo = `${n("perfis")} ${n("perfis") === 1 ? "perfil" : "perfis"}, ${n("contas")} contas, ${n("compras")} compras e ${n("metas")} metas`;
    } catch {
      avisar("Esse arquivo não é uma cópia do app.", "erro");
      return;
    }
    abrir({
      tipo: "confirmar",
      titulo: "Restaurar esta cópia?",
      texto:
        modo === "github"
          ? `O arquivo "${file.name}" tem ${resumo}. Ele substitui os dados de todas as pessoas que usam o app. A versão de hoje continua no histórico do repositório, para dar para voltar.`
          : `O arquivo "${file.name}" tem ${resumo}. Ele substitui os dados de todas as pessoas que usam o app neste computador. Antes, o app guarda uma cópia do que existe hoje na pasta dados/copias.`,
      rotulo: "Restaurar",
      acao: async () => {
        try {
          await backend.importar?.(texto);
          avisar("Cópia restaurada para todos os perfis. Escolha o seu.");
          await iniciar();
        } catch (e) {
          avisar(e instanceof Error ? e.message : "Arquivo inválido.", "erro");
        }
      },
    });
  };

  const apagar = () =>
    abrir({
      tipo: "confirmar",
      titulo: "Apagar todos os dados?",
      texto:
        modo === "github"
          ? "Os perfis, contas, cartões e metas de todas as pessoas que usam o app serão apagados. A versão de hoje continua no histórico do repositório, para dar para voltar."
          : "Os perfis, contas, cartões e metas de todas as pessoas que usam o app neste computador serão apagados. Antes, o app guarda uma cópia de tudo na pasta dados/copias, para dar para voltar.",
      rotulo: "Apagar tudo",
      acao: async () => {
        await backend.apagarTudo?.();
        await iniciar();
      },
    });

  const sair = async () => {
    await backend.sair();
    await iniciar();
  };

  const desconectar = () =>
    abrir({
      tipo: "confirmar",
      titulo: "Desconectar este aparelho?",
      texto:
        "A chave do GitHub é apagada deste aparelho. Os dados continuam no repositório; para voltar, conecte de novo com a chave.",
      rotulo: "Desconectar",
      acao: async () => {
        await backend.conexao?.desconectar();
        window.location.reload();
      },
    });
  const repositorio = backend.conexao?.atual()?.repositorio;

  return (
    <div className="space-y-4 sm:space-y-6">
      <CabecalhoPagina
        titulo="Minha renda"
        texto="Seu salário, o que você separa para o dia a dia e o seu perfil."
      />

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-2 xl:items-start ultra:grid-cols-3">
        <RendaDoMes key={mes} />

        <Painel className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <TituloPainel>Outras rendas</TituloPainel>
            <Botao tamanho="sm" onClick={() => abrir({ tipo: "conta", natureza: "receita" })}>
              <Plus size={16} />
              Adicionar
            </Botao>
          </div>
          {rendas.length === 0 ? (
            <p className="mt-4 text-[13px] leading-5 text-ink-3">
              Freelas, aluguel recebido, pensão, 13º. Podem ser fixas ou de um mês só.
            </p>
          ) : (
            <ul className="mt-2">
              {rendas.map((c) => (
                <li key={c.id} className="border-b border-line last:border-0">
                  <button
                    type="button"
                    onClick={() => abrir({ tipo: "conta", conta: c })}
                    className="flex w-full items-center gap-4 py-4 text-left"
                  >
                    <Ladrilho icone={Banknote} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{c.nome}</span>
                      <span className="block text-xs text-ink-3">
                        {c.recorrente
                          ? "todo mês"
                          : `só em ${mesCurto(c.mesInicio).toLowerCase()}/${anoDe(c.mesInicio)}`}
                      </span>
                    </span>
                    <span className="tabular text-sm font-semibold text-ink">
                      {formatar(c.valor)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Painel>

        <Painel className="p-4 sm:p-6">
          <TituloPainel>Perfil</TituloPainel>
          <div className="mt-6 space-y-4">
            <Campo rotulo="Nome">
              <Entrada value={nome} onChange={(e) => setNome(e.target.value)} maxLength={30} />
            </Campo>
            <div>
              <span className="mb-2 block text-[13px]/5 font-medium text-ink-2">Cor</span>
              <SeletorCor
                valor={cor}
                onMudar={setCor}
                usadas={dados.moradores.filter((m) => m.id !== eu?.id).map((m) => m.cor)}
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Botao variante="primario" disabled={!perfilMudou} onClick={salvarPerfil}>
              Salvar perfil
            </Botao>
          </div>
        </Painel>

        <Painel className="p-4 sm:p-6">
          <TituloPainel>
            {modo === "computador"
              ? "Dados neste computador"
              : modo === "github"
                ? "Dados no GitHub"
                : "Conta"}
          </TituloPainel>
          {modo !== "nuvem" ? (
            <>
              {modo === "github" ? (
                <p className="mt-4 text-[13px] leading-5 text-ink-3">
                  Tudo fica no arquivo{" "}
                  <code className="rounded bg-surface-2 px-1 py-1 text-[12px]/4 text-ink-2">
                    financas.json
                  </code>{" "}
                  do repositório privado{" "}
                  <span className="font-medium text-ink-2">{repositorio}</span>. Cada mudança vira
                  uma versão no histórico dele, que serve de cópia de segurança.
                </p>
              ) : (
                <p className="mt-4 text-[13px] leading-5 text-ink-3">
                  Tudo fica no arquivo{" "}
                  <code className="rounded bg-surface-2 px-1 py-1 text-[12px]/4 text-ink-2">
                    dados/financas.json
                  </code>
                  , na pasta do app, com uma cópia automática por dia (últimos 30 dias) em{" "}
                  <code className="rounded bg-surface-2 px-1 py-1 text-[12px]/4 text-ink-2">
                    dados/copias
                  </code>
                  . Para guardar fora do computador, baixe uma cópia de vez em quando.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Botao onClick={exportar}>
                  <Download size={16} />
                  Baixar cópia
                </Botao>
                <Botao onClick={() => arquivo.current?.click()}>
                  <Upload size={16} />
                  Restaurar cópia
                </Botao>
                {modo === "github" && (
                  <Botao onClick={desconectar}>
                    <LogOut size={16} />
                    Desconectar este aparelho
                  </Botao>
                )}
                <Botao variante="perigo" onClick={apagar}>
                  <Trash2 size={16} />
                  Apagar tudo
                </Botao>
                <input
                  ref={arquivo}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    void importar(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </div>
            </>
          ) : (
            <>
              <p className="mt-4 text-[13px]/5 text-ink-3">
                Você entrou como <span className="font-medium text-ink">{sessao?.email}</span>.
              </p>
              <Botao className="mt-4" onClick={sair}>
                <LogOut size={16} />
                Sair
              </Botao>
            </>
          )}
        </Painel>

        {modo === "computador" && <AbrirNoCelular />}
      </div>
    </div>
  );
}

/* ───────────────────────── Abrir pelo celular ───────────────────────── */

function AbrirNoCelular() {
  const [enderecos, setEnderecos] = useState<string[] | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/endereco", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { enderecos?: string[] }) => setEnderecos(d.enderecos ?? []))
      .catch(() => setEnderecos([]));
  }, []);

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(texto);
      setTimeout(() => setCopiado(null), 1800);
    } catch {
      setCopiado(null);
    }
  };

  return (
    <Painel className="p-4 sm:p-6">
      <TituloPainel>Abrir no celular</TituloPainel>
      <p className="mt-4 text-[13px] leading-5 text-ink-3">
        Com o app ligado neste computador, qualquer aparelho no mesmo Wi-Fi abre pelo endereço
        abaixo. Cada pessoa escolhe o próprio perfil e todos veem os mesmos dados.
      </p>
      {enderecos === null ? (
        <p className="mt-4 text-[13px]/5 text-ink-3">Procurando o endereço...</p>
      ) : enderecos.length === 0 ? (
        <p className="mt-4 text-[13px] leading-5 text-ink-3">
          Não achei este computador numa rede Wi-Fi ou cabo. Conecte-se à rede de casa e abra esta
          tela de novo.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {enderecos.map((e) => (
            <li
              key={e}
              className="flex items-center justify-between gap-4 rounded-2xl border border-dashed border-line-strong bg-surface-2 py-2 pr-2 pl-4"
            >
              <span className="tabular truncate text-[15px]/6 font-semibold text-ink">
                {e.replace("http://", "")}
              </span>
              <Botao tamanho="sm" onClick={() => copiar(e)}>
                {copiado === e ? <Check size={16} className="text-good" /> : <Copy size={16} />}
                {copiado === e ? "Copiado" : "Copiar"}
              </Botao>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs leading-5 text-ink-3">
        Se o celular não abrir, o Firewall do Windows pode estar bloqueando: na primeira vez que o
        app liga, o Windows pergunta se o Node.js pode usar a rede. Permita em redes privadas. Dica:
        no celular, use &quot;Adicionar à tela inicial&quot; para abrir como um app.
      </p>
    </Painel>
  );
}

/* ───────────────────────── Renda com histórico ───────────────────────── */

function RendaDoMes() {
  const { lar, eu, mes, atualizar, avisar } = useApp();
  const perfil = usePerfil();
  const vigente = rendaNoMes(perfil, mes);
  const [salario, setSalario] = useState(vigente.salario);
  const [diaADia, setDiaADia] = useState(vigente.diaADia);
  const [quando, setQuando] = useState<"daqui" | "sempre">("daqui");
  const [desde, setDesde] = useState<Mes>(mes);

  const mudou = salario !== vigente.salario || diaADia !== vigente.diaADia;
  const mostraSalario = !!eu && eu.salarioCompartilhado !== null;
  const historico = [...(perfil.historico ?? [])].sort((a, b) => b.desde.localeCompare(a.desde));

  const salvar = async () => {
    const novoHistorico =
      quando === "sempre" ? null : registrarRenda(perfil, desde, salario, diaADia);
    // O valor "atual" do perfil é sempre o mais recente.
    const atual = novoHistorico
      ? rendaNoMes({ ...perfil, historico: novoHistorico }, "9999-12")
      : { salario, diaADia };
    await atualizar("perfis", perfil.id, {
      salario: atual.salario,
      orcamentoDiaADia: atual.diaADia,
      historico: novoHistorico,
    });
    if (eu && mostraSalario) {
      await atualizar("moradores", eu.id, {
        salarioCompartilhado: atual.salario,
      });
    }
    avisar(
      quando === "sempre"
        ? "Renda corrigida em todos os meses."
        : `Renda atualizada a partir de ${nomeMes(desde).toLowerCase()}.`,
    );
  };

  return (
    <Painel className="p-4 sm:p-6">
      <TituloPainel detalhe={`${nomeMes(mes).toLowerCase()} de ${anoDe(mes)}`}>Renda</TituloPainel>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Salário líquido" dica="O que cai na conta, já com os descontos.">
          <EntradaValor valor={salario} onMudar={setSalario} />
        </Campo>
        <Campo rotulo="Gasto do dia a dia" dica="O que você separa para o que não é conta fixa.">
          <EntradaValor valor={diaADia} onMudar={setDiaADia} />
        </Campo>
      </div>

      {mudou && (
        <div className="mt-6 space-y-4 rounded-2xl bg-surface-2 p-4">
          <Segmentado
            cheio
            rotulo="Quando vale a mudança"
            valor={quando}
            onMudar={setQuando}
            opcoes={[
              { valor: "daqui", rotulo: "A partir de um mês" },
              { valor: "sempre", rotulo: "Corrigir em todos" },
            ]}
          />
          {quando === "daqui" ? (
            <Campo
              rotulo="Vale a partir de"
              dica="Os meses anteriores continuam com o valor antigo."
            >
              <SeletorMes valor={desde} onMudar={setDesde} base={mes} />
            </Campo>
          ) : (
            <p className="text-xs leading-5 text-ink-3">
              Apaga o histórico e usa estes valores em todos os meses, inclusive os passados. Use
              para corrigir um valor digitado errado.
            </p>
          )}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Botao variante="primario" disabled={!mudou} onClick={salvar}>
          Salvar renda
        </Botao>
      </div>

      {historico.length > 1 && (
        <div className="mt-6 border-t border-line pt-6">
          <p className="text-xs font-semibold text-ink">Histórico</p>
          <ul className="mt-1">
            {historico.map((h) => (
              <li
                key={h.desde}
                className="tabular flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line py-2 text-[13px]/5 last:border-0"
              >
                <span className="text-ink-2">
                  {h.desde === "0000-01"
                    ? "Antes disso"
                    : `Desde ${mesCurto(h.desde).toLowerCase()}/${anoDe(h.desde)}`}
                </span>
                <span className="text-ink-3">
                  <strong className="font-semibold text-ink">{formatar(h.salario)}</strong>
                  <span className="whitespace-nowrap"> · dia a dia {formatar(h.diaADia)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lar && eu && (
        <div className="mt-6 border-t border-line pt-6">
          <Alternar
            titulo="Mostrar meu salário para a casa"
            descricao={`Os moradores de "${lar.nome}" passam a ver o seu salário atual, e ele entra na conta de quanto a casa gasta para morar. Suas contas pessoais continuam privadas.`}
            ligado={mostraSalario}
            onMudar={(v) =>
              atualizar("moradores", eu.id, {
                salarioCompartilhado: v ? perfil.salario : null,
              })
            }
          />
        </div>
      )}
    </Painel>
  );
}
