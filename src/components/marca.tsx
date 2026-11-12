export const NOME_APP = "Finanças";
export const LEMA_APP = "Contas da casa";

/** Marca: um círculo com a fatia de cada um destacada. */
export function Logo({ tamanho = 36 }: { tamanho?: number }) {
  return (
    <span
      aria-hidden
      className="inline-grid shrink-0 place-items-center text-white"
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: Math.round(tamanho * 0.3),
        background: "linear-gradient(145deg, var(--marca-de), var(--marca-ate))",
        boxShadow:
          "0 6px 14px -6px var(--marca-ate), inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.12)",
      }}
    >
      <svg width={tamanho * 0.58} height={tamanho * 0.58} viewBox="0 0 20 20" fill="none">
        <path
          d="M8.4 3.2a7.3 7.3 0 1 0 8.4 8.4"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path d="M11.4 1.6a7 7 0 0 1 7 7h-7z" fill="currentColor" />
      </svg>
    </span>
  );
}
