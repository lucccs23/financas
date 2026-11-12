import type { Backend } from "./backend";
import { criarBackendComputador } from "./computador";
import { criarBackendGitHub } from "./github";
import { criarBackendNuvem } from "./nuvem";

let instancia: Backend | null = null;

/**
 * Com as chaves do Supabase o app usa a nuvem; na versão online sem elas, um
 * repositório privado do GitHub; no computador, um arquivo na pasta do app.
 */
export function obterBackend(): Backend {
  if (instancia) return instancia;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  instancia =
    url && chave
      ? criarBackendNuvem(url, chave)
      : process.env.NEXT_PUBLIC_MODO === "github"
        ? criarBackendGitHub()
        : criarBackendComputador();
  return instancia;
}
