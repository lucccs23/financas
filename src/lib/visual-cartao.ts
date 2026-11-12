/** Acabamentos disponíveis para o desenho do cartão. */
export const CORES_CARTAO = [
  { nome: "Grafite", de: "#444a57", ate: "#101216" },
  { nome: "Azul", de: "#3f86f7", ate: "#1b3a8f" },
  { nome: "Violeta", de: "#8f66f5", ate: "#44208f" },
  { nome: "Laranja", de: "#fb8b3a", ate: "#b83d0c" },
  { nome: "Verde", de: "#2fc58f", ate: "#075c45" },
  { nome: "Vinho", de: "#ee4b72", ate: "#741a36" },
] as const;

export function corCartao(n: number) {
  const i = ((Math.trunc(n) % CORES_CARTAO.length) + CORES_CARTAO.length) % CORES_CARTAO.length;
  return CORES_CARTAO[i];
}
