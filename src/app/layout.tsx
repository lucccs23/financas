import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AppProvider } from "@/lib/app";
import { SCRIPT_APARENCIA } from "@/lib/aparencia";
import { Casca } from "@/components/casca";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Finanças · Contas da casa",
  description:
    "Controle de finanças para quem divide a casa: saldo do mês, divisão das contas, cartões e reserva.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f2f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0c0f" },
  ],
};


export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* Aplica tema, cor e tamanho antes da primeira pintura, para a tela não piscar. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_APARENCIA }} />
      </head>
      <body className="min-h-full">
        <AppProvider>
          <Casca>{children}</Casca>
        </AppProvider>
      </body>
    </html>
  );
}
