// Extrai o texto de um PDF no próprio navegador (nada é enviado para fora),
// usando o pdf.js. O texto sai na ordem em que o banco escreveu o documento,
// com uma quebra de linha onde o PDF marca fim de linha.

export class SenhaDoPdf extends Error {
  incorreta: boolean;
  constructor(incorreta: boolean) {
    super(incorreta ? "Senha incorreta." : "Este PDF tem senha.");
    this.incorreta = incorreta;
  }
}

interface ItemTexto {
  str?: string;
  hasEOL?: boolean;
}

/** Junta os pedaços de texto de uma página em linhas. */
export function montarTexto(itens: ItemTexto[]): string {
  let saida = "";
  for (const item of itens) {
    const s = item.str ?? "";
    saida += s;
    if (item.hasEOL) saida += "\n";
    else if (s && !s.endsWith(" ")) saida += " ";
  }
  return saida;
}

export async function textoDoPdf(arquivo: Blob, senha?: string): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // O "worker" do pdf.js fica em public/, junto do site.
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  pdfjs.GlobalWorkerOptions.workerSrc = `${base}/pdf.worker.min.mjs`;
  const dados = new Uint8Array(await arquivo.arrayBuffer());
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: dados, password: senha }).promise;
  } catch (e) {
    if ((e as { name?: string }).name === "PasswordException") {
      throw new SenhaDoPdf((e as { code?: number }).code === 2);
    }
    throw new Error("Não consegui abrir esse PDF.");
  }
  let texto = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const pagina = await doc.getPage(p);
    const conteudo = await pagina.getTextContent();
    texto += montarTexto(conteudo.items as ItemTexto[]) + "\n";
  }
  await doc.cleanup();
  return texto;
}
