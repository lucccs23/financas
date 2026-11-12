// Banco de dados em arquivo, no computador onde o app roda.
// Só é importado pelas rotas de API (lado do servidor).

import { promises as fs } from "node:fs";
import path from "node:path";
import { normalizar } from "../dados/operacoes";
import type { Dados } from "../types";

const ARQUIVO =
  process.env.FINANCAS_ARQUIVO ?? path.join(process.cwd(), "dados", "financas.json");
const PASTA_COPIAS = path.join(path.dirname(ARQUIVO), "copias");
const DIAS_DE_COPIA = 30;

export function caminhoDoArquivo() {
  return ARQUIVO;
}

async function existe(caminho: string) {
  try {
    await fs.access(caminho);
    return true;
  } catch {
    return false;
  }
}

async function ler(): Promise<Dados> {
  try {
    return normalizar(JSON.parse(await fs.readFile(ARQUIVO, "utf8")));
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code === "ENOENT") return normalizar(null);
    throw new Error(
      `Não foi possível ler ${ARQUIVO}. Se o arquivo foi editado à mão, restaure uma cópia da pasta "copias".`,
    );
  }
}

/** Uma cópia por dia, antes da primeira alteração do dia. Guarda os últimos 30 dias. */
async function copiaDoDia() {
  if (!(await existe(ARQUIVO))) return;
  const d = new Date();
  const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const destino = path.join(PASTA_COPIAS, `financas-${hoje}.json`);
  if (await existe(destino)) return;
  await fs.mkdir(PASTA_COPIAS, { recursive: true });
  await fs.copyFile(ARQUIVO, destino);
  const copias = (await fs.readdir(PASTA_COPIAS))
    .filter((n) => /^financas-\d{4}-\d{2}-\d{2}\.json$/.test(n))
    .sort();
  for (const antiga of copias.slice(0, Math.max(0, copias.length - DIAS_DE_COPIA))) {
    await fs.rm(path.join(PASTA_COPIAS, antiga), { force: true });
  }
}

/** Cópia do momento exato, antes de ações que trocam tudo (apagar, restaurar). */
async function copiaAntesDe(motivo: string) {
  if (!(await existe(ARQUIVO))) return;
  await fs.mkdir(PASTA_COPIAS, { recursive: true });
  const agora = new Date();
  const dois = (n: number) => String(n).padStart(2, "0");
  // Horário do computador, para o nome bater com o relógio de quem procura.
  const quando = `${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}-${dois(agora.getHours())}h${dois(agora.getMinutes())}`;
  await fs.copyFile(ARQUIVO, path.join(PASTA_COPIAS, `financas-antes-de-${motivo}-${quando}.json`));
}

/** Grava num arquivo temporário e troca de uma vez, para nunca deixar o arquivo pela metade. */
async function gravar(banco: Dados, motivo?: string) {
  await fs.mkdir(path.dirname(ARQUIVO), { recursive: true });
  await copiaDoDia();
  if (motivo) await copiaAntesDe(motivo);
  const temporario = `${ARQUIVO}.${process.pid}.tmp`;
  await fs.writeFile(temporario, JSON.stringify(banco, null, 2), "utf8");
  try {
    await fs.rename(temporario, ARQUIVO);
  } catch {
    // No Windows a troca pode falhar se outro programa estiver lendo o arquivo.
    await fs.copyFile(temporario, ARQUIVO);
    await fs.rm(temporario, { force: true });
  }
}

// Uma alteração por vez: pedidos de dois aparelhos ao mesmo tempo entram na fila.
let fila: Promise<unknown> = Promise.resolve();

export function lerBanco(): Promise<Dados> {
  const leitura = fila.then(ler);
  fila = leitura.catch(() => undefined);
  return leitura;
}

/**
 * Aplica uma alteração e grava. Com `copiaAntes`, guarda também uma cópia do
 * momento (ex.: "apagar"), para ações que trocam tudo de uma vez.
 */
export function alterarBanco<T>(
  alteracao: (banco: Dados) => T,
  copiaAntes?: string,
): Promise<T> {
  const tarefa = fila.then(async () => {
    const banco = await ler();
    const resultado = alteracao(banco);
    await gravar(banco, copiaAntes);
    return resultado;
  });
  fila = tarefa.catch(() => undefined);
  return tarefa;
}
