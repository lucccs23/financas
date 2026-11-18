import { describe, expect, it } from "vitest";
import { avaliarComando } from "./regras-do-agente.mjs";

const bloqueia = (c, ramo = "minha-mudanca") =>
  !!avaliarComando(c, ramo).bloquear;

describe("regras do agente", () => {
  it("não envia nem commita direto no main", () => {
    expect(bloqueia("git push origin main")).toBe(true);
    expect(bloqueia("git push origin HEAD:main")).toBe(true);
    expect(bloqueia("git push", "main")).toBe(true);
    expect(bloqueia("git push origin HEAD", "main")).toBe(true);
    expect(bloqueia('git commit -m "x"', "main")).toBe(true);
  });

  it("permite o trabalho em um branch", () => {
    expect(bloqueia("git push -u origin minha-mudanca")).toBe(false);
    expect(bloqueia('git commit -m "x"')).toBe(false);
    expect(bloqueia("git push")).toBe(false);
  });

  it("não força envio nem pula verificação", () => {
    expect(bloqueia("git push --force origin minha-mudanca")).toBe(true);
    expect(bloqueia("git push -f origin minha-mudanca")).toBe(true);
    expect(bloqueia('git commit --no-verify -m "x"')).toBe(true);
  });

  it("não faz merge nem muda a proteção", () => {
    expect(bloqueia("gh pr merge 3 --admin")).toBe(true);
    expect(bloqueia("gh repo edit --visibility private")).toBe(true);
    expect(
      bloqueia("gh api --method POST repos/a/b/rulesets --input r.json"),
    ).toBe(true);
    expect(bloqueia("gh api -X DELETE repos/a/b/rulesets/1")).toBe(true);
    expect(bloqueia("gh api repos/a/b/rulesets")).toBe(false);
  });

  it("pede as checagens antes de abrir PR, mesmo em comando composto", () => {
    expect(avaliarComando("gh pr create --fill", "b").checar).toBe(true);
    expect(
      avaliarComando("git push -u origin b && gh pr create --fill", "b").checar,
    ).toBe(true);
    expect(avaliarComando("gh pr view 1", "b").checar).toBe(false);
  });

  it("ignora texto de heredoc", () => {
    const c = "git commit -F - <<'FIM'\ngh pr merge\ngit push origin main\nFIM";
    expect(bloqueia(c)).toBe(false);
  });
});
