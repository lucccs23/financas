// Trava do Claude Code (PreToolUse): roda antes de cada comando de terminal.
// Código de saída 2 bloqueia o comando e mostra o motivo ao agente.

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { avaliarComando } from "./regras-do-agente.mjs";

const entrada = JSON.parse(readFileSync(0, "utf8") || "{}");
const comando = String(entrada.tool_input?.command ?? "");
const pasta = entrada.cwd || process.cwd();

let ramo = "";
try {
  ramo = execFileSync("git", ["branch", "--show-current"], {
    cwd: pasta,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
} catch {
  // Fora de um repositório Git: as regras de branch não se aplicam.
}

const decisao = avaliarComando(comando, ramo);
if (decisao.bloquear) {
  console.error(
    `Bloqueado: ${decisao.bloquear}. Isso é decisão do dono do repositório.`,
  );
  process.exit(2);
}

if (decisao.checar) {
  const r = spawnSync("npm run -s checar", {
    cwd: process.env.CLAUDE_PROJECT_DIR || pasta,
    shell: true,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
  if (r.status !== 0) {
    const saida = `${r.stdout ?? ""}${r.stderr ?? ""}`.slice(-4000);
    console.error(`PR bloqueado: "npm run checar" falhou.\n${saida}`);
    console.error(
      "Depois de 3 rodadas de conserto sem sucesso, pare e chame o dono do repositório.",
    );
    process.exit(2);
  }
}
