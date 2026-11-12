// Endereços deste computador na rede de casa, para abrir o app pelo celular.

import os from "node:os";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Faixas de endereço usadas em redes domésticas. */
function ehRedeDeCasa(ip: string) {
  return (
    /^192\.168\./.test(ip) ||
    /^10\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

/** Adaptadores virtuais (WSL, Hyper-V, VirtualBox, VPN) não servem para o celular. */
function ehVirtual(nome: string) {
  return /vethernet|wsl|hyper-v|virtualbox|vmware|docker|loopback|tailscale|zerotier|vpn/i.test(nome);
}

export async function GET(request: NextRequest) {
  const porta = request.nextUrl.port || "3000";
  const enderecos = Object.entries(os.networkInterfaces())
    .filter(([nome]) => !ehVirtual(nome))
    .flatMap(([, lista]) => lista ?? [])
    .filter((e) => e.family === "IPv4" && !e.internal && ehRedeDeCasa(e.address))
    .map((e) => `http://${e.address}:${porta}`);
  return Response.json({ enderecos });
}
