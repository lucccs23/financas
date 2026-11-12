// API usada pelo app para ler e gravar no arquivo do computador.
// Quem está na mesma rede Wi-Fi consegue chamar estas rotas: o app foi
// pensado para uso dentro de casa, entre pessoas que confiam umas nas outras.

import type { NextRequest } from "next/server";
import * as op from "@/lib/dados/operacoes";
import { alterarBanco, lerBanco } from "@/lib/servidor/arquivo";
import { TABELAS, type Dados, type NomeTabela } from "@/lib/types";

export const dynamic = "force-dynamic";

function erro(mensagem: string, status = 400) {
  return Response.json({ erro: mensagem }, { status });
}

function tabelaValida(t: unknown): t is NomeTabela {
  return typeof t === "string" && (TABELAS as string[]).includes(t);
}

export async function GET(request: NextRequest) {
  const busca = request.nextUrl.searchParams;
  const banco = await lerBanco();

  if (busca.has("perfis")) {
    return Response.json(banco.perfis.map((p) => ({ id: p.id, nome: p.nome, cor: p.cor })));
  }
  if (busca.has("copia")) {
    return new Response(JSON.stringify(banco, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": 'attachment; filename="financas-copia.json"',
      },
    });
  }
  const perfil = busca.get("perfil");
  if (!perfil) return erro("Informe o perfil.");
  return Response.json(op.recortar(banco, perfil));
}

export async function POST(request: NextRequest) {
  let corpo: Record<string, unknown>;
  try {
    corpo = await request.json();
  } catch {
    return erro("Pedido inválido.");
  }
  const userId = typeof corpo.userId === "string" ? corpo.userId : "";

  try {
    switch (corpo.acao) {
      case "inserir":
        if (!tabelaValida(corpo.tabela)) return erro("Tabela inválida.");
        await alterarBanco((b) => op.inserir(b, corpo.tabela as NomeTabela, corpo.linha as never));
        break;
      case "atualizar":
        if (!tabelaValida(corpo.tabela)) return erro("Tabela inválida.");
        await alterarBanco((b) =>
          op.atualizar(b, corpo.tabela as NomeTabela, String(corpo.id), corpo.mudancas as never),
        );
        break;
      case "remover":
        if (!tabelaValida(corpo.tabela)) return erro("Tabela inválida.");
        await alterarBanco((b) => op.remover(b, corpo.tabela as NomeTabela, String(corpo.id)));
        break;
      case "criarLar":
        await alterarBanco((b) => op.criarLar(b, userId, corpo.dados as never));
        break;
      case "consultarLar":
        return Response.json(op.consultarLar(await lerBanco(), String(corpo.codigo ?? "")));
      case "entrarNoLar":
        await alterarBanco((b) => op.entrarNoLar(b, userId, corpo.dados as never));
        break;
      case "sairDoLar":
        await alterarBanco((b) => op.sairDoLar(b, userId));
        break;
      case "importar": {
        const novo = op.normalizar(corpo.dados as Partial<Dados>);
        if (!novo.perfis.length) return erro("O arquivo não tem nenhum perfil.");
        const soSeVazio = corpo.soSeVazio === true;
        const aplicou = await alterarBanco(
          (b) => {
            if (soSeVazio && b.perfis.length) return false;
            for (const t of TABELAS) (b[t] as unknown[]) = novo[t];
            return true;
          },
          soSeVazio ? undefined : "restaurar",
        );
        return Response.json({ aplicou });
      }
      case "apagar":
        await alterarBanco((b) => {
          for (const t of TABELAS) (b[t] as unknown[]) = [];
        }, "apagar");
        break;
      default:
        return erro("Ação desconhecida.");
    }
  } catch (e) {
    return erro(e instanceof Error ? e.message : "Não foi possível gravar.", 409);
  }
  return Response.json({ ok: true });
}
