import type { NextConfig } from "next";

// Duas formas de gerar o app:
// - no computador (padrão): com servidor, que guarda os dados em dados/financas.json;
// - online, para o GitHub Pages (GITHUB_PAGES=1): só páginas estáticas. Os dados
//   ficam num repositório privado do GitHub ou, com as chaves dele, no Supabase.
//   As rotas do servidor (arquivos *.servidor.ts) ficam de fora.
const online = process.env.GITHUB_PAGES === "1";
const comSupabase = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const nextConfig: NextConfig = {
  pageExtensions: online ? ["tsx", "ts"] : ["tsx", "ts", "servidor.ts"],
  ...(online
    ? {
        output: "export",
        // Pasta própria, para não atrapalhar a versão do computador.
        distDir: ".next-online",
        // Endereço do GitHub Pages: https://usuario.github.io/<repositório>/
        basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
        trailingSlash: true,
        images: { unoptimized: true },
        env: { NEXT_PUBLIC_MODO: comSupabase ? "nuvem" : "github" },
      }
    : {}),
  turbopack: {
    // O arquivo de dados é escolhido na hora (pasta do projeto ou FINANCAS_ARQUIVO);
    // o aviso de "rastrear o projeto inteiro" não se aplica, porque o app não é
    // empacotado para outro lugar.
    ignoreIssue: [{ path: "**/src/lib/servidor/arquivo.ts" }],
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
