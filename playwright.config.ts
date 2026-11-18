import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Testes de ponta a ponta: usam o app como uma pessoa, com dados inventados.
// Sem repetição automática: teste instável é defeito a investigar.
const PORTA = 3210;

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  outputDir: ".e2e/resultados",
  // Todos os testes usam o mesmo arquivo de dados do servidor.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  forbidOnly: true,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://127.0.0.1:${PORTA}`,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npx next build && npx next start -H 127.0.0.1 -p ${PORTA}`,
    url: `http://127.0.0.1:${PORTA}`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      FINANCAS_E2E: "1",
      FINANCAS_ARQUIVO: path.resolve(".e2e/financas.json"),
    },
  },
});
