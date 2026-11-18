// O que o agente não pode fazer sozinho, lido do comando que ele vai executar.
// Usado pela trava em .claude/settings.json.

const INICIO = String.raw`^\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*`;
const GIT = new RegExp(
  `${INICIO}git(?:\\s+-C\\s+\\S+)?\\s+(push|commit)\\b(.*)$`,
  "s",
);
const GH = new RegExp(`${INICIO}(?:\\S*[/\\\\])?gh(?:\\.exe)?\\s+(.*)$`, "s");
const PROTEGIDO = /^(?:refs\/heads\/)?(?:main|master)$/;

/** Separa os comandos e tira o texto de heredocs, que não é executado. */
function comandos(texto) {
  return texto
    .replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2(?=\s|$)/g, "")
    .split(/&&|\|\||[;|\n]/)
    .map((c) => c.trim())
    .filter(Boolean);
}

const argumentos = (texto) =>
  (texto.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map((a) =>
    a.replace(/^["']|["']$/g, ""),
  );

function regraDoPush(resto, ramoAtual) {
  const args = argumentos(resto);
  if (
    args.some((a) =>
      /^(--force.*|--mirror|--delete|--no-verify|-[a-z]*[fd][a-z]*)$/.test(a),
    )
  ) {
    return "push forçado, apagando branch ou sem verificação";
  }
  const posicionais = args.filter((a) => !a.startsWith("-"));
  const refs = posicionais.slice(1);
  if (!refs.length || refs.includes("HEAD")) {
    return PROTEGIDO.test(ramoAtual) ? "push para o main" : null;
  }
  const paraMain = refs.some((r) =>
    PROTEGIDO.test(r.includes(":") ? r.split(":").pop() : r),
  );
  return paraMain ? "push para o main" : null;
}

function regraDoGh(resto) {
  const a = argumentos(resto);
  const [grupo, acao] = a;
  if (grupo === "pr" && acao === "merge")
    return "merge é do dono do repositório";
  if (grupo === "repo" && acao === "edit") return "configuração do repositório";
  if (grupo === "api") {
    const sensivel = a
      .slice(1)
      .some((x) =>
        /(rulesets|\/protection|actions\/permissions|\/environments|\/secrets|\/variables)/.test(
          x,
        ),
      );
    const escreve = a.some(
      (x, i) =>
        /^(--input|-f|-F|--field|--raw-field)$/.test(x) ||
        (/^(-X|--method)$/.test(x) && !/^GET$/i.test(a[i + 1] ?? "")) ||
        /^(-X|--method=)(?!GET$)/i.test(x),
    );
    if (sensivel && escreve) return "configuração de segurança do repositório";
  }
  return null;
}

/** @returns {{ bloquear?: string, checar?: boolean }} */
export function avaliarComando(texto, ramoAtual = "") {
  let checar = false;
  for (const comando of comandos(texto)) {
    const git = comando.match(GIT);
    if (git) {
      const [, acao, resto] = git;
      if (acao === "commit" && /(^|\s)--no-verify(\s|$)/.test(resto)) {
        return { bloquear: "commit sem verificação" };
      }
      if (acao === "commit" && PROTEGIDO.test(ramoAtual)) {
        return { bloquear: "commit direto no main" };
      }
      const motivo = acao === "push" ? regraDoPush(resto, ramoAtual) : null;
      if (motivo) return { bloquear: motivo };
    }
    const gh = comando.match(GH);
    if (gh) {
      const motivo = regraDoGh(gh[1]);
      if (motivo) return { bloquear: motivo };
      if (/^pr\s+create\b/.test(gh[1])) checar = true;
    }
  }
  return { checar };
}
