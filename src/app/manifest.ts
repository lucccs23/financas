import type { MetadataRoute } from "next";

// Permite "Adicionar à tela inicial" no celular, abrindo como um app.
export const dynamic = "force-static";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Finanças · Contas da casa",
    short_name: "Finanças",
    description: "Saldo do mês, divisão das contas da casa, cartões e reserva.",
    start_url: `${base}/`,
    scope: `${base}/`,
    display: "standalone",
    background_color: "#f1f2f5",
    theme_color: "#2563eb",
    lang: "pt-BR",
    // Segurando o ícone do app no Android aparecem estes atalhos.
    shortcuts: [
      {
        name: "Nova transação",
        short_name: "Lançar",
        description: "Lançar um gasto ou uma entrada",
        url: `${base}/transacoes/?nova=1`,
        icons: [{ src: `${base}/icone-192.png`, sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Transações",
        short_name: "Extrato",
        url: `${base}/transacoes/`,
        icons: [{ src: `${base}/icone-192.png`, sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Cartões",
        short_name: "Cartões",
        url: `${base}/cartoes/`,
        icons: [{ src: `${base}/icone-192.png`, sizes: "192x192", type: "image/png" }],
      },
    ],
    icons: [
      { src: `${base}/icone-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${base}/icone-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${base}/icone-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
