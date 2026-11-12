// Prepara fotos enviadas pela pessoa: recorta, reduz e comprime no próprio
// navegador, para guardar junto com os dados sem pesar.

export type UsoImagem = "cartao" | "logo" | "ilustracao";

/** Proporção de um cartão de crédito de verdade (85,6 × 54 mm). */
export const PROPORCAO_CARTAO = 85.6 / 54;

const LIMITE_ARQUIVO = 25 * 1024 * 1024;

const REGRAS: Record<
  UsoImagem,
  { largura: number; altura: number; recortar: boolean; transparencia: boolean; minimo: number }
> = {
  // Foto do cartão: recortada no formato do cartão, sem transparência.
  // 1280 px deixa nítido mesmo em telas de alta densidade (o cartão aparece
  // com ~320 px na tela). Abaixo de 640 px de largura já fica borrado.
  cartao: { largura: 1280, altura: Math.round(1280 / PROPORCAO_CARTAO), recortar: true, transparencia: false, minimo: 640 },
  // Logo do banco: cabe numa caixa pequena e mantém o fundo transparente.
  logo: { largura: 480, altura: 160, recortar: false, transparencia: true, minimo: 120 },
  // Ilustração dos painéis: quadrada no máximo, com transparência.
  ilustracao: { largura: 320, altura: 320, recortar: false, transparencia: true, minimo: 120 },
};

export interface ImagemPreparada {
  dataUrl: string;
  /** Largura útil da imagem original (depois do recorte), em pixels. */
  larguraOriginal: number;
  /** A imagem original é menor que o recomendado: vai ficar borrada. */
  pequena: boolean;
}

function carregar(arquivo: Blob): Promise<HTMLImageElement> {
  return new Promise((resolver, rejeitar) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolver(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rejeitar(new Error("Não consegui abrir essa imagem. Tente uma foto em JPG ou PNG."));
    };
    img.src = url;
  });
}

/**
 * Reduz em etapas de no máximo metade. Reduzir de uma vez (ex.: 4000 → 1280)
 * deixa a imagem serrilhada e com perda de detalhe nos textos do cartão.
 */
function reduzirEmEtapas(
  fonte: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  largura: number,
  altura: number,
  fundo: string | null,
): HTMLCanvasElement {
  let atual: CanvasImageSource = fonte;
  let [x, y, w, h] = [sx, sy, sw, sh];
  while (w / 2 > largura && h / 2 > altura) {
    const etapa = document.createElement("canvas");
    etapa.width = Math.round(w / 2);
    etapa.height = Math.round(h / 2);
    const c = etapa.getContext("2d")!;
    c.imageSmoothingQuality = "high";
    c.drawImage(atual, x, y, w, h, 0, 0, etapa.width, etapa.height);
    atual = etapa;
    [x, y, w, h] = [0, 0, etapa.width, etapa.height];
  }
  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;
  const ctx = tela.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  if (fundo) {
    ctx.fillStyle = fundo;
    ctx.fillRect(0, 0, largura, altura);
  }
  ctx.drawImage(atual, x, y, w, h, 0, 0, largura, altura);
  return tela;
}

/** Converte a imagem escolhida (arquivo ou imagem colada) num texto (data URL) pronto para guardar. */
export async function prepararImagem(arquivo: Blob, uso: UsoImagem): Promise<ImagemPreparada> {
  if (!arquivo.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem.");
  if (arquivo.size > LIMITE_ARQUIVO) throw new Error("Imagem muito grande. Use uma de até 25 MB.");
  const img = await carregar(arquivo);
  const regra = REGRAS[uso];
  const vetorial = arquivo.type === "image/svg+xml";
  // SVG não tem resolução: desenha no tamanho máximo.
  const lw = vetorial ? Math.max(img.naturalWidth || regra.largura, regra.largura) : img.naturalWidth;
  const lh = vetorial
    ? Math.round(lw * ((img.naturalHeight || 1) / (img.naturalWidth || 1)))
    : img.naturalHeight;
  if (!lw || !lh) throw new Error("Não consegui ler o tamanho dessa imagem.");

  let sx = 0;
  let sy = 0;
  let sw = lw;
  let sh = lh;
  let largura: number;
  let altura: number;

  if (regra.recortar) {
    // Preenche o formato do cartão, cortando as sobras pelo centro.
    const alvo = regra.largura / regra.altura;
    if (lw / lh > alvo) {
      sw = lh * alvo;
      sx = (lw - sw) / 2;
    } else {
      sh = lw / alvo;
      sy = (lh - sh) / 2;
    }
    largura = Math.min(regra.largura, Math.round(sw));
    altura = Math.round(largura / alvo);
  } else {
    const escala = Math.min(1, regra.largura / lw, regra.altura / lh);
    largura = Math.max(1, Math.round(lw * escala));
    altura = Math.max(1, Math.round(lh * escala));
  }

  // Para SVG, a "fonte" precisa estar no tamanho de desenho.
  const escalaFonte = vetorial ? lw / (img.naturalWidth || lw) : 1;
  const tela = reduzirEmEtapas(
    img,
    sx / escalaFonte,
    sy / escalaFonte,
    sw / escalaFonte,
    sh / escalaFonte,
    largura,
    altura,
    regra.transparencia ? null : "#000",
  );

  // WebP é o menor; navegadores que não sabem gerar WebP devolvem PNG.
  const qualidade = uso === "cartao" ? 0.92 : 0.9;
  let dataUrl = tela.toDataURL("image/webp", qualidade);
  if (!dataUrl.startsWith("data:image/webp")) {
    dataUrl = regra.transparencia ? tela.toDataURL("image/png") : tela.toDataURL("image/jpeg", qualidade);
  }
  const larguraOriginal = Math.round(vetorial ? regra.largura : sw);
  return { dataUrl, larguraOriginal, pequena: larguraOriginal < regra.minimo };
}
