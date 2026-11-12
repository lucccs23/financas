import { describe, expect, it } from "vitest";
import { moverItem, moverUmPasso, normalizarOrdem, type OrdemMenu } from "./menu-ordem";

const PADRAO: OrdemMenu = { menu: ["/", "/a", "/b", "/c"], ajustes: ["/x", "/y"] };

describe("ordem do menu", () => {
  it("sem nada guardado, usa a padrão", () => {
    expect(normalizarOrdem(null, PADRAO)).toEqual(PADRAO);
    expect(normalizarOrdem("lixo", PADRAO)).toEqual(PADRAO);
  });

  it("tira o que não existe mais, repetidos, e acrescenta telas novas no fim do grupo padrão", () => {
    const salva = { menu: ["/b", "/sumiu", "/", "/b"], ajustes: ["/a", "/x"] };
    expect(normalizarOrdem(salva, PADRAO)).toEqual({
      menu: ["/b", "/", "/c"],
      ajustes: ["/a", "/x", "/y"],
    });
  });

  it("arrasta para cima, para baixo e para o outro grupo", () => {
    expect(moverItem(PADRAO, "/c", "menu", 0).menu).toEqual(["/c", "/", "/a", "/b"]);
    // Soltar "antes do /c" (índice 3) leva o "/" para logo antes dele.
    expect(moverItem(PADRAO, "/", "menu", 3).menu).toEqual(["/a", "/b", "/", "/c"]);
    expect(moverItem(PADRAO, "/a", "ajustes", 1)).toEqual({
      menu: ["/", "/b", "/c"],
      ajustes: ["/x", "/a", "/y"],
    });
  });

  it("setas: uma posição por vez, atravessando entre os grupos", () => {
    expect(moverUmPasso(PADRAO, "/a", -1).menu).toEqual(["/a", "/", "/b", "/c"]);
    expect(moverUmPasso(PADRAO, "/a", 1).menu).toEqual(["/", "/b", "/a", "/c"]);
    expect(moverUmPasso(PADRAO, "/c", 1)).toEqual({
      menu: ["/", "/a", "/b"],
      ajustes: ["/c", "/x", "/y"],
    });
    expect(moverUmPasso(PADRAO, "/x", -1)).toEqual({
      menu: ["/", "/a", "/b", "/c", "/x"],
      ajustes: ["/y"],
    });
    // Nas pontas, nada muda.
    expect(moverUmPasso(PADRAO, "/", -1)).toEqual(PADRAO);
    expect(moverUmPasso(PADRAO, "/y", 1)).toEqual(PADRAO);
  });
});
