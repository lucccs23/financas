import { entrar, expect, lerDados, painel, test, textoCorrido } from "./apoio";

const TELAS = [
  ["/", "Saldo previsto"],
  ["/transacoes", "Transações"],
  ["/fluxo", "Fluxo de caixa"],
  ["/analises", "Análises"],
  ["/cartoes", "Cartões"],
  ["/carteiras", "Carteiras"],
  ["/casa", "Você ainda não tem uma casa"],
  ["/reserva", "Reserva"],
  ["/contas", "Contas"],
  ["/renda", "Minha renda"],
] as const;

test("todas as telas abrem, sem erro", async ({ page }) => {
  await entrar(page);
  for (const [caminho, titulo] of TELAS) {
    await page.goto(caminho);
    await expect(
      page.getByRole("main").getByText(titulo).first(),
    ).toBeVisible();
  }
});

test("visão geral: contas de dezembro, gastos de novembro", async ({
  page,
}) => {
  await entrar(page);
  const saldo = painel(page, /Saldo previsto/);
  await expect(saldo.getByRole("heading").first()).toContainText("dezembro");
  // Salário 3.000 − fatura de dezembro 500 − Internet 100.
  await expect.poll(() => textoCorrido(saldo)).toContain("R$2.400,00");

  const contas = painel(page, "Contas a pagar");
  await expect(contas).toContainText("Fatura Banco Azul");
  await expect(contas).toContainText("vence 05/12");
  await expect(
    painel(page, /Distribuição dos gastos/)
      .getByRole("heading")
      .first(),
  ).toContainText("novembro");
});

test("lançar um gasto: aparece, grava e continua depois de recarregar", async ({
  page,
}) => {
  await entrar(page, "/transacoes");
  await page
    .getByRole("main")
    .getByRole("button", { name: "Nova transação" })
    .click();
  const janela = page.getByRole("dialog");
  await janela.getByLabel("Valor").fill("42,50");
  await janela.getByLabel("Descrição").fill("Farmácia Central");
  await janela.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("main")).toContainText("Farmácia Central");
  await expect
    .poll(
      () =>
        lerDados().transacoes.find((t) => t.descricao === "Farmácia Central")
          ?.valor,
    )
    .toBe(4_250);
  await page.reload();
  await expect(page.getByRole("main")).toContainText("Farmácia Central");
});

test("compra no cartão entra na fatura em aberto", async ({ page }) => {
  await entrar(page, "/cartoes");
  const tela = page.getByRole("main");
  await expect(tela).toContainText("Fatura de dezembro");
  await expect.poll(() => textoCorrido(tela)).toContain("R$500,00");
  await tela.getByRole("button", { name: "Nova compra" }).click();
  const janela = page.getByRole("dialog");
  await janela.getByLabel("Descrição").fill("Livraria do Centro");
  await janela.getByLabel("Valor total").fill("50,00");
  await janela.getByRole("button", { name: "Salvar" }).click();
  await expect(tela).toContainText("Livraria do Centro");
  await expect.poll(() => textoCorrido(tela)).toContain("R$550,00");
  await expect
    .poll(
      () =>
        lerDados().compras.find((c) => c.descricao === "Livraria do Centro")
          ?.mesPrimeira,
    )
    .toBe("2026-12");
});

test("marcar a fatura de dezembro como paga", async ({ page }) => {
  await entrar(page);
  const marcador = () =>
    painel(page, "Contas a pagar").getByRole("checkbox", {
      name: /Fatura Banco Azul/,
    });
  await marcador().click();
  await expect(marcador()).toBeChecked();
  await expect
    .poll(() =>
      lerDados().lancamentos.some(
        (l) => l.refId === "azul" && l.mes === "2026-12" && l.pago,
      ),
    )
    .toBe(true);
  await page.reload();
  await expect(marcador()).toBeChecked();
});

test("contas: mês atual e faturas em aberto", async ({ page }) => {
  await entrar(page, "/contas");
  const tela = page.getByRole("main");
  await expect(tela).toContainText("Contas de novembro e faturas de dezembro");
  await expect(tela).toContainText("Internet");
  await expect(tela).toContainText("vence 05/12 · em aberto");
});

test("análises: o gasto conta no mês em que aconteceu", async ({ page }) => {
  await entrar(page, "/analises");
  // Novembro: mercado 400 + curso 100 + padaria 25.
  await expect
    .poll(() => textoCorrido(page.getByRole("main")))
    .toContain("R$525,00");
  await expect(painel(page, /Onde você mais gasta/)).toContainText(
    "Mercado Do Bairro",
  );
});

test("arrastar o menu muda a ordem e não abre a página", async ({ page }) => {
  await entrar(page);
  const itens = page.locator("[data-menu-grupo=menu] [data-menu-item]");
  await expect(itens.nth(1)).toContainText("Transações");
  const origem = (await itens.filter({ hasText: "Casa" }).boundingBox())!;
  const destino = (await itens.nth(1).boundingBox())!;
  await page.mouse.move(origem.x + 40, origem.y + origem.height / 2);
  await page.mouse.down();
  await page.mouse.move(origem.x + 40, destino.y + 4, { steps: 12 });
  await page.mouse.up();
  await expect(itens.nth(1)).toContainText("Casa");
  await expect(page).toHaveURL(/\/$/);
  await page.reload();
  await expect(itens.nth(1)).toContainText("Casa");
});

test.describe("no celular", () => {
  test.use({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  });

  test("navega pela barra de baixo e nenhuma tela sobra para o lado", async ({
    page,
  }) => {
    await entrar(page);
    await page.getByRole("link", { name: "Cartões" }).last().tap();
    await expect(page).toHaveURL(/\/cartoes/);
    for (const [caminho] of TELAS) {
      await page.goto(caminho);
      await expect(page.getByRole("main")).toBeVisible();
      const sobra = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(sobra, `largura em ${caminho}`).toBeLessThanOrEqual(0);
    }
  });
});
