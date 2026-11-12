"use client";

// Telas de antes do app: escolher ou criar acesso e montar o perfil.

import { useEffect, useState, type ReactNode } from "react";
import {
  ChevronRight,
  CreditCard,
  HardDrive,
  KeyRound,
  PiggyBank,
  Plus,
  Scale,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useApp } from "@/lib/app";
import type { PerfilLocal } from "@/lib/dados/backend";
import { REPOSITORIO_PADRAO } from "@/lib/dados/github";
import { semearExemplo } from "@/lib/exemplo";
import type { Perfil } from "@/lib/types";
import { LEMA_APP, Logo, NOME_APP } from "./marca";
import { Avatar, Botao, Campo, Entrada, EntradaValor, Segmentado, SeletorCor } from "./ui";

const DESTAQUES = [
  {
    icone: Wallet,
    texto: "Quanto sobra do seu mês, já descontada a sua parte da casa.",
  },
  {
    icone: Scale,
    texto: "Quem pagou o quê e o Pix exato para acertar entre todos.",
  },
  { icone: CreditCard, texto: "Faturas e parcelas dos cartões, mês a mês." },
  { icone: PiggyBank, texto: "Metas de reserva, suas e da casa." },
];

function Moldura({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside
        className="relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between"
        style={{
          background:
            "linear-gradient(155deg, var(--marca-de) 0%, var(--marca-ate) 55%, var(--marca-fundo) 100%)",
        }}
      >
        <div
          aria-hidden
          className="absolute -top-32 -right-32 h-[424px] w-[424px] rounded-full opacity-30"
          style={{
            background: "radial-gradient(circle, #8fb8ff 0%, transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full opacity-25"
          style={{
            background: "radial-gradient(circle, #5adba5 0%, transparent 70%)",
          }}
        />
        <div className="relative flex items-center gap-4">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
              <path
                d="M8.4 3.2a7.3 7.3 0 1 0 8.4 8.4"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <path d="M11.4 1.6a7 7 0 0 1 7 7h-7z" fill="currentColor" />
            </svg>
          </span>
          <span className="text-lg font-semibold tracking-[-0.02em]">{NOME_APP}</span>
        </div>
        <div className="relative max-w-[440px]">
          <h1 className="text-[40px] leading-[1.08] font-semibold tracking-[-0.035em]">
            As contas da casa, divididas sem discussão.
          </h1>
          <ul className="mt-10 space-y-4">
            {DESTAQUES.map(({ icone: Icone, texto }) => (
              <li key={texto} className="flex items-start gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/12 ring-1 ring-white/20">
                  <Icone size={16} />
                </span>
                <span className="pt-2 text-[15px] leading-6 text-white/85">{texto}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-[13px]/5 text-white/55">{LEMA_APP}</p>
      </aside>
      <main className="flex items-center justify-center bg-surface px-6 py-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-4 lg:hidden">
            <Logo tamanho={40} />
            <div>
              <p className="text-base font-semibold tracking-[-0.02em] text-ink">{NOME_APP}</p>
              <p className="text-xs text-ink-3">{LEMA_APP}</p>
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

/* ───────────────────────── Entrar ───────────────────────── */

export function TelaEntrada() {
  const { modo, backend } = useApp();
  const [conectado, setConectado] = useState(
    () => modo !== "github" || Boolean(backend.conexao?.atual()),
  );
  return (
    <Moldura>
      {modo === "nuvem" ? (
        <EntradaNuvem />
      ) : conectado ? (
        <EntradaLocal onDesconectar={() => setConectado(false)} />
      ) : (
        <ConectarGitHub onConectado={() => setConectado(true)} />
      )}
    </Moldura>
  );
}

function EntradaLocal({ onDesconectar }: { onDesconectar: () => void }) {
  const { backend, iniciar, modo } = useApp();
  const [perfis, setPerfis] = useState<PerfilLocal[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    backend
      .perfisLocais()
      .then(setPerfis)
      .catch((e: unknown) =>
        setErro(e instanceof Error ? e.message : "Não foi possível carregar os perfis."),
      );
  }, [backend]);

  const entrar = async (id: string) => {
    await backend.entrarLocal(id);
    await iniciar();
  };
  const novo = async () => {
    await backend.novoLocal();
    await iniciar();
  };
  const reconectar = async () => {
    await backend.conexao?.desconectar();
    onDesconectar();
  };

  if (erro) {
    return (
      <>
        <h2 className="text-[26px]/8 font-semibold tracking-[-0.03em] text-ink">
          Não deu para abrir
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-2">{erro}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Botao variante="primario" onClick={() => window.location.reload()}>
            Tentar de novo
          </Botao>
          {modo === "github" && <Botao onClick={reconectar}>Conectar de novo</Botao>}
        </div>
      </>
    );
  }

  return (
    <>
      <h2 className="text-[26px]/8 font-semibold tracking-[-0.03em] text-ink">
        {perfis === null ? "Carregando..." : perfis.length ? "Quem está usando?" : "Vamos começar"}
      </h2>
      <p className="mt-2 text-sm text-ink-3">
        {perfis === null
          ? "Buscando os perfis."
          : perfis.length
            ? "Escolha o seu perfil ou crie um novo."
            : "Crie o seu perfil para montar o controle do mês."}
      </p>

      <div className="mt-8 space-y-2">
        {perfis?.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => entrar(p.id)}
            className="group flex w-full items-center gap-4 rounded-2xl border border-line bg-surface p-4 text-left transition-all hover:border-line-strong hover:bg-surface-2"
          >
            <Avatar nome={p.nome} cor={p.cor} tamanho={40} />
            <span className="min-w-0 flex-1 truncate text-[15px]/6 font-medium text-ink">
              {p.nome}
            </span>
            <ChevronRight
              size={20}
              className="text-ink-3 transition-transform group-hover:translate-x-0.5"
            />
          </button>
        ))}
        <Botao
          variante={perfis?.length ? "secundario" : "primario"}
          className="!h-12 w-full !rounded-2xl"
          disabled={perfis === null}
          onClick={novo}
        >
          <Plus size={16} />
          Criar novo perfil
        </Botao>
      </div>

      {modo === "github" ? (
        <Nota icone={KeyRound}>
          <span className="font-medium text-ink-2">Guardado no seu GitHub.</span> Os dados ficam num
          repositório privado; cada mudança vira uma versão no histórico dele.{" "}
          <button
            type="button"
            onClick={reconectar}
            className="font-medium text-ink-2 underline underline-offset-4 hover:text-ink"
          >
            Desconectar este aparelho
          </button>
        </Nota>
      ) : (
        <Nota icone={HardDrive}>
          <span className="font-medium text-ink-2">Guardado neste computador.</span> Os dados ficam
          num arquivo na pasta do app. Quem estiver no mesmo Wi-Fi pode abrir pelo celular e
          escolher o próprio perfil.
        </Nota>
      )}
    </>
  );
}

function Nota({ icone: Icone, children }: { icone: typeof KeyRound; children: ReactNode }) {
  return (
    <div className="mt-8 flex items-start gap-4 rounded-2xl bg-surface-2 p-4">
      <Icone size={16} className="mt-0.5 shrink-0 text-ink-3" />
      <p className="text-xs leading-5 text-ink-3">{children}</p>
    </div>
  );
}

function ConectarGitHub({ onConectado }: { onConectado: () => void }) {
  const { backend, avisar } = useApp();
  const [repositorio, setRepositorio] = useState(REPOSITORIO_PADRAO);
  const [chave, setChave] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const conectar = async (e: React.FormEvent) => {
    e.preventDefault();
    setOcupado(true);
    try {
      await backend.conexao?.conectar(repositorio, chave);
      onConectado();
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Não foi possível conectar.", "erro");
      setOcupado(false);
    }
  };

  return (
    <>
      <h2 className="text-[26px]/8 font-semibold tracking-[-0.03em] text-ink">
        Conectar este aparelho
      </h2>
      <p className="mt-2 text-sm leading-6 text-ink-3">
        Os dados de vocês ficam num repositório privado do GitHub. Isso só é feito uma vez em cada
        aparelho.
      </p>
      <form onSubmit={conectar} className="mt-6 space-y-4">
        <Campo rotulo="Repositório dos dados" dica={'Formato "usuario/nome". Precisa ser privado.'}>
          <Entrada
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={repositorio}
            onChange={(e) => setRepositorio(e.target.value)}
            placeholder="usuario/financas-dados"
          />
        </Campo>
        <Campo
          rotulo="Chave de acesso"
          dica={
            <>
              Crie em{" "}
              <a
                href="https://github.com/settings/personal-access-tokens/new"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary-text underline underline-offset-4"
              >
                GitHub › Fine-grained tokens
              </a>
              , só com o repositório dos dados e a permissão Contents: Read and write.
            </>
          }
        >
          <Entrada
            type="password"
            required
            autoComplete="off"
            spellCheck={false}
            value={chave}
            onChange={(e) => setChave(e.target.value)}
            placeholder="github_pat_..."
          />
        </Campo>
        <Botao
          variante="primario"
          type="submit"
          disabled={ocupado}
          className="!h-12 w-full !rounded-2xl"
        >
          {ocupado ? "Conferindo..." : "Conectar"}
        </Botao>
      </form>
      <Nota icone={KeyRound}>
        A chave fica guardada só neste aparelho e só abre o repositório dos dados. Se perder o
        aparelho, apague a chave no GitHub.
      </Nota>
    </>
  );
}

function EntradaNuvem() {
  const { backend, iniciar, avisar } = useApp();
  const [aba, setAba] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setOcupado(true);
    try {
      if (aba === "entrar") {
        await backend.entrar(email.trim(), senha);
        await iniciar();
      } else {
        if (senha.length < 6) throw new Error("A senha precisa ter ao menos 6 caracteres.");
        const r = await backend.cadastrar(email.trim(), senha, codigo);
        if (r.confirmarEmail) setConfirmar(true);
        else await iniciar();
      }
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Não foi possível entrar.", "erro");
    } finally {
      setOcupado(false);
    }
  };

  if (confirmar) {
    return (
      <>
        <h2 className="text-[26px]/8 font-semibold tracking-[-0.03em] text-ink">
          Confira seu e-mail
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-2">
          Enviamos um link de confirmação para <strong>{email}</strong>. Depois de confirmar, volte
          aqui e entre com a sua senha.
        </p>
        <Botao
          className="mt-6"
          onClick={() => {
            setConfirmar(false);
            setAba("entrar");
          }}
        >
          Voltar para entrar
        </Botao>
      </>
    );
  }

  return (
    <>
      <h2 className="text-[26px]/8 font-semibold tracking-[-0.03em] text-ink">
        {aba === "entrar" ? "Bem-vindo de volta" : "Crie sua conta"}
      </h2>
      <p className="mt-2 text-sm text-ink-3">
        {aba === "entrar"
          ? "Entre para ver o seu mês."
          : "Cada pessoa da casa tem a própria conta."}
      </p>
      <div className="mt-6">
        <Segmentado
          cheio
          rotulo="Acesso"
          valor={aba}
          onMudar={setAba}
          opcoes={[
            { valor: "entrar", rotulo: "Entrar" },
            { valor: "criar", rotulo: "Criar conta" },
          ]}
        />
      </div>
      <form onSubmit={enviar} className="mt-6 space-y-4">
        <Campo rotulo="E-mail">
          <Entrada
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
          />
        </Campo>
        <Campo rotulo="Senha">
          <Entrada
            type="password"
            required
            autoComplete={aba === "entrar" ? "current-password" : "new-password"}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Ao menos 6 caracteres"
          />
        </Campo>
        {aba === "criar" && (
          <Campo rotulo="Código de acesso" dica="Peça para quem administra o app.">
            <Entrada value={codigo} onChange={(e) => setCodigo(e.target.value)} />
          </Campo>
        )}
        <Botao
          variante="primario"
          type="submit"
          disabled={ocupado}
          className="!h-12 w-full !rounded-2xl"
        >
          {ocupado ? "Aguarde..." : aba === "entrar" ? "Entrar" : "Criar conta"}
        </Botao>
      </form>
    </>
  );
}

/* ───────────────────────── Criar o perfil ───────────────────────── */

export function TelaPerfil() {
  const { backend, sessao, hoje, modo, iniciar, avisar } = useApp();
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(0);
  const [salario, setSalario] = useState(0);
  const [diaADia, setDiaADia] = useState(0);
  const [ocupado, setOcupado] = useState(false);

  const criar = async (comExemplo: boolean) => {
    if (!sessao) return;
    if (!nome.trim()) return avisar("Como podemos te chamar?", "erro");
    setOcupado(true);
    try {
      const perfil: Perfil = {
        id: sessao.userId,
        nome: nome.trim(),
        cor,
        salario: comExemplo && salario === 0 ? 650_000 : salario,
        orcamentoDiaADia: comExemplo && diaADia === 0 ? 80_000 : diaADia,
      };
      await backend.inserir("perfis", perfil);
      if (comExemplo) await semearExemplo(backend, perfil, hoje);
      await iniciar();
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Não foi possível criar o perfil.", "erro");
      setOcupado(false);
    }
  };

  const voltar = async () => {
    await backend.sair();
    await iniciar();
  };

  return (
    <Moldura>
      <h2 className="text-[26px]/8 font-semibold tracking-[-0.03em] text-ink">Seu perfil</h2>
      <p className="mt-2 text-sm text-ink-3">
        Só o nome é obrigatório. O resto você ajusta depois em Minha renda.
      </p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void criar(false);
        }}
      >
        <Campo rotulo="Como quer ser chamado">
          <Entrada
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Seu nome"
            maxLength={30}
          />
        </Campo>
        <div>
          <span className="mb-2 block text-[13px]/5 font-medium text-ink-2">Sua cor</span>
          <SeletorCor valor={cor} onMudar={setCor} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Campo rotulo="Salário líquido">
            <EntradaValor valor={salario} onMudar={setSalario} />
          </Campo>
          <Campo rotulo="Gasto do dia a dia">
            <EntradaValor valor={diaADia} onMudar={setDiaADia} />
          </Campo>
        </div>
        <p className="!mt-2 text-xs leading-5 text-ink-3">
          Dia a dia é o que você separa por mês para o que não é conta fixa: lanche, transporte,
          farmácia.
        </p>
        <div className="space-y-2 pt-2">
          <Botao
            variante="primario"
            type="submit"
            disabled={ocupado}
            className="!h-12 w-full !rounded-2xl"
          >
            {ocupado ? "Preparando..." : "Começar do zero"}
          </Botao>
          <Botao
            disabled={ocupado}
            onClick={() => criar(true)}
            className="!h-12 w-full !rounded-2xl"
          >
            <Sparkles size={16} className="text-primary-text" />
            Explorar com dados de exemplo
          </Botao>
        </div>
      </form>
      <button
        type="button"
        onClick={voltar}
        className="mt-6 text-[13px]/5 font-medium text-ink-3 underline-offset-4 hover:text-ink hover:underline"
      >
        {modo === "nuvem" ? "Sair desta conta" : "Voltar para a lista de perfis"}
      </button>
    </Moldura>
  );
}
