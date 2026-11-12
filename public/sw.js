// Guarda o app no aparelho (só na versão online): abre na hora, mesmo sem
// internet. Os dados não passam por aqui; o app guarda os seus à parte.
//
// - Páginas: mostra a versão guardada na hora e atualiza em segundo plano
//   (a próxima abertura já vem com a versão nova).
// - Arquivos do app (/_next/static, ícones): têm nome com versão, então a
//   cópia guardada vale para sempre.

const PAGINAS = "financas-paginas-v1";
const ARQUIVOS = "financas-arquivos-v1";
const ESCOPO = new URL(self.registration.scope).pathname; // ex.: "/financas/"
const ROTAS = ["", "transacoes/", "carteiras/", "cartoes/", "contas/", "casa/", "fluxo/", "reserva/", "renda/"];

/** Arquivos que uma página usa (scripts e estilos do Next). */
function arquivosDa(html) {
  const achados = html.match(/(?:src|href)="([^"]*\/_next\/static\/[^"]+)"/g) ?? [];
  return [...new Set(achados.map((a) => a.replace(/^(?:src|href)="|"$/g, "")))];
}

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    (async () => {
      const paginas = await caches.open(PAGINAS);
      const arquivos = await caches.open(ARQUIVOS);
      for (const rota of ROTAS) {
        try {
          const resposta = await fetch(ESCOPO + rota, { cache: "no-cache" });
          if (!resposta.ok) continue;
          const html = await resposta.clone().text();
          await paginas.put(ESCOPO + rota, resposta);
          await Promise.all(
            arquivosDa(html).map((url) => arquivos.add(url).catch(() => undefined)),
          );
        } catch {
          // Sem internet na instalação: as páginas entram quando forem abertas.
        }
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(
        nomes
          .filter((n) => n.startsWith("financas-") && n !== PAGINAS && n !== ARQUIVOS && !n.startsWith("financas-dados"))
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Mantém o guardado de arquivos do app num tamanho razoável (versões antigas saem). */
async function aparar() {
  const arquivos = await caches.open(ARQUIVOS);
  const chaves = await arquivos.keys();
  const excesso = chaves.length - 400;
  for (let i = 0; i < excesso; i++) await arquivos.delete(chaves[i]);
}

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET") return;
  const url = new URL(pedido.url);
  // Só o próprio site; GitHub e Pluggy passam direto.
  if (url.origin !== self.location.origin || !url.pathname.startsWith(ESCOPO)) return;

  if (pedido.mode === "navigate") {
    // Página: a guardada na hora; a nova chega em segundo plano.
    const chave = url.pathname.endsWith("/") ? url.pathname : url.pathname + "/";
    evento.respondWith(
      (async () => {
        const paginas = await caches.open(PAGINAS);
        const guardada = await paginas.match(chave);
        // "no-cache": confere com o site, sem a cópia de 10 minutos do navegador,
        // para uma versão nova chegar já na próxima abertura.
        const nova = fetch(url.href, { cache: "no-cache", credentials: "same-origin" })
          .then(async (resposta) => {
            if (resposta.ok) {
              const html = await resposta.clone().text();
              await paginas.put(chave, resposta.clone());
              const arquivos = await caches.open(ARQUIVOS);
              await Promise.all(
                arquivosDa(html).map(async (a) => {
                  if (!(await arquivos.match(a))) await arquivos.add(a).catch(() => undefined);
                }),
              );
              await aparar();
            }
            return resposta;
          })
          .catch(() => undefined);
        if (guardada) {
          evento.waitUntil(nova);
          return guardada;
        }
        return (await nova) ?? (await paginas.match(ESCOPO)) ?? Response.error();
      })(),
    );
    return;
  }

  if (/\.(png|svg|ico|webmanifest|mjs)$/.test(url.pathname) && !url.pathname.includes("/_next/")) {
    // Nome fixo (ícones, manifesto, leitor de PDF): o guardado na hora, e
    // atualiza em segundo plano para a próxima vez.
    evento.respondWith(
      (async () => {
        const arquivos = await caches.open(ARQUIVOS);
        const guardado = await arquivos.match(pedido);
        const novo = fetch(pedido)
          .then(async (resposta) => {
            if (resposta.ok) await arquivos.put(pedido, resposta.clone());
            return resposta;
          })
          .catch(() => undefined);
        if (guardado) {
          evento.waitUntil(novo);
          return guardado;
        }
        return (await novo) ?? Response.error();
      })(),
    );
    return;
  }

  if (url.pathname.includes("/_next/static/")) {
    // Arquivo com versão no nome: o guardado vale; se não tem, busca e guarda.
    evento.respondWith(
      (async () => {
        const arquivos = await caches.open(ARQUIVOS);
        const guardado = await arquivos.match(pedido);
        if (guardado) return guardado;
        const resposta = await fetch(pedido);
        if (resposta.ok) await arquivos.put(pedido, resposta.clone());
        return resposta;
      })(),
    );
  }
});
