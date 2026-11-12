"use client";

// Estado central do app: quem está logado, os dados carregados, o mês em
// foco e as operações que alteram os dados (já refletindo na tela na hora).

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
import { chaveLancamento, type ItemMes } from "./calc";
import { obterBackend } from "./dados";
import { novoId, type Backend, type Sessao } from "./dados/backend";
import { formatar } from "./dinheiro";
import { dataISO, mesDe } from "./meses";
import {
  aplicarAparencia,
  APARENCIA_PADRAO,
  guardarAparencia,
  lerAparencia,
  sistemaEscuro,
  type Aparencia,
} from "./aparencia";
import {
  dadosVazios,
  type Dados,
  type Id,
  type Lar,
  type Linha,
  type Mes,
  type Morador,
  type NomeTabela,
  type Perfil,
} from "./types";

export type Estado = "carregando" | "deslogado" | "semPerfil" | "pronto";
export type Tema = "claro" | "escuro";

export interface Aviso {
  id: number;
  texto: string;
  tipo: "ok" | "erro";
}

interface AppCtx {
  estado: Estado;
  modo: Backend["modo"];
  backend: Backend;
  sessao: Sessao | null;
  dados: Dados;
  perfil: Perfil | null;
  lar: Lar | null;
  /** O morador que representa a pessoa logada dentro da casa. */
  eu: Morador | null;

  hoje: string;
  mesHoje: Mes;
  mes: Mes;
  setMes: (mes: Mes) => void;

  /** Tema que está valendo agora (o "automático" já resolvido). */
  tema: Tema;
  setTema: (tema: Tema) => void;
  aparencia: Aparencia;
  setAparencia: (mudancas: Partial<Aparencia>) => void;
  /** Valores em dinheiro borrados na tela (vale só para este aparelho). */
  ocultarValores: boolean;
  setOcultarValores: (v: boolean) => void;

  iniciar: () => Promise<void>;
  recarregar: () => Promise<void>;

  inserir: <K extends NomeTabela>(tabela: K, linha: Linha<K>) => Promise<void>;
  atualizar: <K extends NomeTabela>(
    tabela: K,
    id: Id,
    mudancas: Partial<Linha<K>>,
  ) => Promise<void>;
  remover: (tabela: NomeTabela, id: Id) => Promise<void>;

  marcarPago: (item: ItemMes, mes: Mes, pago: boolean) => Promise<void>;
  ajustarMes: (
    item: ItemMes,
    mes: Mes,
    mudancas: { pago?: boolean; valor?: number | null; pulado?: boolean },
  ) => Promise<void>;
  removerConta: (id: Id) => Promise<void>;
  removerCartao: (id: Id) => Promise<void>;
  removerMeta: (id: Id) => Promise<void>;

  avisos: Aviso[];
  avisar: (texto: string, tipo?: Aviso["tipo"]) => void;
}

const Contexto = createContext<AppCtx | null>(null);

function mensagem(erro: unknown): string {
  return erro instanceof Error ? erro.message : "Algo deu errado.";
}

export function AppProvider({ children }: { children: ReactNode }) {
  const backend = useMemo(() => obterBackend(), []);
  const [estado, setEstado] = useState<Estado>("carregando");
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [dados, setDados] = useState<Dados>(dadosVazios);
  const [hoje, setHoje] = useState("");
  const [mes, setMes] = useState<Mes>("");
  const [aparencia, definirAparencia] = useState<Aparencia>(APARENCIA_PADRAO);
  const [escuroNoSistema, setEscuroNoSistema] = useState(false);
  const [ocultarValores, definirOcultar] = useState(false);
  const setOcultarValores = useCallback((v: boolean) => {
    definirOcultar(v);
    try {
      localStorage.setItem("quinhao:ocultar", v ? "1" : "0");
    } catch {
      // sem armazenamento: vale até fechar
    }
    if (v) document.documentElement.dataset.ocultar = "";
    else delete document.documentElement.dataset.ocultar;
  }, []);
  const tema: Tema =
    aparencia.tema === "sistema" ? (escuroNoSistema ? "escuro" : "claro") : aparencia.tema;
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  // Cópia sempre atual dos dados, para as operações consultarem sem serem recriadas.
  const dadosRef = useRef(dados);
  useEffect(() => {
    dadosRef.current = dados;
  }, [dados]);
  const contador = useRef(0);

  const avisar = useCallback((texto: string, tipo: Aviso["tipo"] = "ok") => {
    const id = ++contador.current;
    setAvisos((a) => [...a, { id, texto, tipo }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 4200);
  }, []);

  const preparado = useRef(false);
  const iniciar = useCallback(async () => {
    try {
      if (!preparado.current) {
        preparado.current = true;
        await backend.preparar?.();
      }
      const s = await backend.sessao();
      setSessao(s);
      if (!s) {
        setDados(dadosVazios());
        setEstado("deslogado");
        return;
      }
      const d = await backend.carregar();
      setDados(d);
      setEstado(d.perfis.some((p) => p.id === s.userId) ? "pronto" : "semPerfil");
    } catch (e) {
      avisar(mensagem(e), "erro");
      setEstado("deslogado");
    }
  }, [backend, avisar]);

  const recarregar = useCallback(async () => {
    try {
      setDados(await backend.carregar());
    } catch (e) {
      avisar(mensagem(e), "erro");
    }
  }, [backend, avisar]);

  // Outra pessoa pode ter mexido de outro aparelho: busca de novo ao voltar
  // para a janela do app.
  const estadoRef = useRef(estado);
  useEffect(() => {
    estadoRef.current = estado;
  }, [estado]);
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === "visible" && estadoRef.current === "pronto") {
        void backend
          .carregar()
          .then(setDados)
          .catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [backend]);

  // Ao abrir: lê o relógio e as preferências do navegador (não existem no
  // servidor, por isso não podem ser o valor inicial) e carrega a sessão.
  useEffect(() => {
    const agora = new Date();
    /* eslint-disable react-hooks/set-state-in-effect -- leitura única do ambiente do navegador */
    setHoje(dataISO(agora));
    setMes(mesDe(agora));
    definirAparencia(lerAparencia());
    definirOcultar(document.documentElement.dataset.ocultar !== undefined);
    setEscuroNoSistema(sistemaEscuro());
    /* eslint-enable react-hooks/set-state-in-effect */
    void iniciar();
  }, [iniciar]);

  // A página já abre com a aparência certa (script no <head>). Daqui em diante
  // ela só muda quando a pessoa escolhe outra ou quando o sistema troca de
  // claro para escuro no modo automático.
  const aparenciaRef = useRef(aparencia);
  useEffect(() => {
    aparenciaRef.current = aparencia;
  }, [aparencia]);
  useEffect(() => {
    const consulta = window.matchMedia("(prefers-color-scheme: dark)");
    const mudou = () => {
      setEscuroNoSistema(consulta.matches);
      if (aparenciaRef.current.tema === "sistema") aplicarAparencia(aparenciaRef.current);
    };
    consulta.addEventListener("change", mudou);
    return () => consulta.removeEventListener("change", mudou);
  }, []);

  const setAparencia = useCallback(
    (mudancas: Partial<Aparencia>) => {
      const nova = { ...aparenciaRef.current, ...mudancas };
      aparenciaRef.current = nova;
      definirAparencia(nova);
      if (!guardarAparencia(nova)) {
        avisar(
          "Não coube no armazenamento deste aparelho. A mudança vale só até fechar o app.",
          "erro",
        );
      }
      aplicarAparencia(nova);
    },
    [avisar],
  );

  // A janela do app pode ficar aberta por dias: confere a data a cada minuto e
  // ao voltar para a janela. Na virada do mês, quem olhava o mês atual passa
  // a ver o novo.
  const hojeRef = useRef("");
  useEffect(() => {
    hojeRef.current = hoje;
  }, [hoje]);
  useEffect(() => {
    const conferir = () => {
      const novo = dataISO(new Date());
      const antigo = hojeRef.current;
      if (!antigo || novo === antigo) return;
      hojeRef.current = novo;
      setHoje(novo);
      const mesAntigo = antigo.slice(0, 7);
      const mesNovo = novo.slice(0, 7);
      if (mesAntigo !== mesNovo) setMes((m) => (m === mesAntigo ? mesNovo : m));
    };
    const relogio = setInterval(conferir, 60_000);
    window.addEventListener("focus", conferir);
    document.addEventListener("visibilitychange", conferir);
    return () => {
      clearInterval(relogio);
      window.removeEventListener("focus", conferir);
      document.removeEventListener("visibilitychange", conferir);
    };
  }, []);

  const setTema = useCallback((novo: Tema) => setAparencia({ tema: novo }), [setAparencia]);

  /** Aplica na tela primeiro e grava depois. Se a gravação falhar, recarrega do banco. */
  const gravar = useCallback(
    async (acao: () => Promise<void>) => {
      try {
        await acao();
      } catch (e) {
        avisar(mensagem(e), "erro");
        await recarregar();
      }
    },
    [avisar, recarregar],
  );

  const inserir = useCallback(
    async <K extends NomeTabela>(tabela: K, linha: Linha<K>) => {
      setDados((d) => ({ ...d, [tabela]: [...d[tabela], linha] }));
      await gravar(() => backend.inserir(tabela, linha));
    },
    [backend, gravar],
  );

  const atualizar = useCallback(
    async <K extends NomeTabela>(tabela: K, id: Id, mudancas: Partial<Linha<K>>) => {
      setDados((d) => ({
        ...d,
        [tabela]: (d[tabela] as Linha<K>[]).map((x) => (x.id === id ? { ...x, ...mudancas } : x)),
      }));
      await gravar(() => backend.atualizar(tabela, id, mudancas));
    },
    [backend, gravar],
  );

  const remover = useCallback(
    async (tabela: NomeTabela, id: Id) => {
      setDados((d) => ({
        ...d,
        [tabela]: (d[tabela] as { id: Id }[]).filter((x) => x.id !== id),
      }));
      await gravar(() => backend.remover(tabela, id));
    },
    [backend, gravar],
  );

  /** Cria ou altera o registro de um item em um mês (pago, valor real, pulado). */
  const lancar = useCallback(
    async (
      item: ItemMes,
      mesAlvo: Mes,
      mudancas: { pago?: boolean; valor?: number | null; pulado?: boolean },
    ) => {
      const chave = chaveLancamento(item.refTipo, item.refId, mesAlvo);
      const atual = dadosRef.current.lancamentos.find(
        (l) => chaveLancamento(l.refTipo, l.refId, l.mes) === chave,
      );
      if (atual) {
        await atualizar("lancamentos", atual.id, mudancas);
      } else {
        await inserir("lancamentos", {
          id: novoId(),
          perfilId: item.escopo === "pessoal" ? item.perfilId : null,
          larId: item.escopo === "casa" ? item.larId : null,
          refTipo: item.refTipo,
          refId: item.refId,
          mes: mesAlvo,
          valor: null,
          pago: false,
          pulado: false,
          ...mudancas,
        });
      }

      // Conta ligada a uma meta: pagar guarda o valor na reserva; desmarcar,
      // pular o mês ou mudar o valor do mês acompanham.
      if (item.refTipo !== "conta") return;
      const d = dadosRef.current;
      const conta = d.contas.find((c) => c.id === item.refId);
      const meta = conta?.metaId ? d.metas.find((m) => m.id === conta.metaId) : undefined;
      const jaGuardado = d.aportes.find((a) => a.origem === chave);
      if (!meta && !jaGuardado) return;
      const pago = mudancas.pago ?? atual?.pago ?? false;
      const pulado = mudancas.pulado ?? atual?.pulado ?? false;
      const valorDoMes =
        mudancas.valor !== undefined
          ? (mudancas.valor ?? item.valorCadastrado)
          : (atual?.valor ?? item.valor);
      const deveGuardar = !!meta && pago && !pulado;
      if (deveGuardar && !jaGuardado) {
        await inserir("aportes", {
          id: novoId(),
          metaId: meta.id,
          perfilId: meta.larId ? null : meta.perfilId,
          larId: meta.larId,
          valor: valorDoMes,
          data: hojeRef.current || dataISO(new Date()),
          descricao: item.nome,
          origem: chave,
        });
        avisar(`${formatar(valorDoMes)} guardado em "${meta.nome}".`);
      } else if (deveGuardar && jaGuardado && jaGuardado.valor !== valorDoMes) {
        await atualizar("aportes", jaGuardado.id, { valor: valorDoMes });
      } else if (!deveGuardar && jaGuardado) {
        await remover("aportes", jaGuardado.id);
      }
    },
    [atualizar, inserir, remover, avisar],
  );

  const marcarPago = useCallback(
    (item: ItemMes, mesAlvo: Mes, pago: boolean) => lancar(item, mesAlvo, { pago }),
    [lancar],
  );

  // Em paralelo: no modo GitHub vira uma gravação só (um cartão do banco pode
  // ter centenas de lançamentos; uma gravação por item estoura o limite do GitHub).
  const removerFilhos = useCallback(
    async (tabela: NomeTabela, ids: Id[]) => {
      await Promise.all(ids.map((id) => remover(tabela, id)));
    },
    [remover],
  );

  const removerConta = useCallback(
    async (id: Id) => {
      const d = dadosRef.current;
      await removerFilhos(
        "lancamentos",
        d.lancamentos.filter((l) => l.refTipo === "conta" && l.refId === id).map((l) => l.id),
      );
      await remover("contas", id);
    },
    [remover, removerFilhos],
  );

  const removerCartao = useCallback(
    async (id: Id) => {
      const d = dadosRef.current;
      await removerFilhos(
        "compras",
        d.compras.filter((c) => c.cartaoId === id).map((c) => c.id),
      );
      await removerFilhos(
        "lancamentos",
        d.lancamentos.filter((l) => l.refTipo === "fatura" && l.refId === id).map((l) => l.id),
      );
      await remover("cartoes", id);
    },
    [remover, removerFilhos],
  );

  const removerMeta = useCallback(
    async (id: Id) => {
      const d = dadosRef.current;
      await removerFilhos(
        "aportes",
        d.aportes.filter((a) => a.metaId === id).map((a) => a.id),
      );
      await remover("metas", id);
    },
    [remover, removerFilhos],
  );

  const perfil = useMemo(
    () => dados.perfis.find((p) => p.id === sessao?.userId) ?? null,
    [dados.perfis, sessao],
  );
  const eu = useMemo(
    () => dados.moradores.find((m) => m.perfilId === sessao?.userId) ?? null,
    [dados.moradores, sessao],
  );
  const lar = dados.lares[0] ?? null;

  const valor: AppCtx = {
    estado,
    modo: backend.modo,
    backend,
    sessao,
    dados,
    perfil,
    lar,
    eu,
    hoje,
    mesHoje: hoje.slice(0, 7),
    mes,
    setMes,
    tema,
    setTema,
    aparencia,
    setAparencia,
    ocultarValores,
    setOcultarValores,
    iniciar,
    recarregar,
    inserir,
    atualizar,
    remover,
    marcarPago,
    ajustarMes: lancar,
    removerConta,
    removerCartao,
    removerMeta,
    avisos,
    avisar,
  };

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useApp(): AppCtx {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useApp precisa estar dentro de AppProvider.");
  return ctx;
}

/** Atalho para as telas internas, onde o perfil sempre existe. */
export function usePerfil(): Perfil {
  const { perfil } = useApp();
  if (!perfil) throw new Error("Tela aberta sem perfil carregado.");
  return perfil;
}
