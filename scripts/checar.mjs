// Todas as checagens, das mais baratas para as mais caras. Para na primeira falha.
// Uso: npm run checar
//
// Os dois builds usam pastas próprias (.next-online e .next-e2e): a versão do
// app usada neste computador (.next) não é tocada.

import { spawnSync } from "node:child_process";

const ETAPAS = [
  ["Lint", "npx eslint", {}],
  ["Tipos", "npx tsc --noEmit", {}],
  ["Testes", "npx vitest run", {}],
  [
    "Build do site",
    "npx next build",
    { GITHUB_PAGES: "1", NEXT_PUBLIC_BASE_PATH: "/financas" },
  ],
  ["Ponta a ponta (com build do app local)", "npx playwright test", {}],
];

for (const [nome, comando, env] of ETAPAS) {
  console.log(`\n=== ${nome}: ${comando}`);
  const r = spawnSync(comando, {
    shell: true,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) {
    console.error(`\nFalhou em: ${nome}.`);
    process.exit(r.status ?? 1);
  }
}
console.log("\nTudo passou.");
