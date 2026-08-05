/** Acima disso não é uma quilometragem real (nem caminhão chega lá). */
const KM_MAXIMO_PLAUSIVEL = 2_000_000;

/**
 * Extrai o número de um km digitado livremente ("126.705", "086490", "4*").
 * O texto original é sempre preservado em kmRaw; aqui só derivamos o número.
 */
export function normalizarKm(kmRaw: string): number | null {
  const digitos = kmRaw.replace(/\D/g, "");
  if (digitos === "") return null;
  const km = Number(digitos);
  return km > KM_MAXIMO_PLAUSIVEL ? null : km;
}

/** Exibe o km normalizado (ex.: "126.705 km") ou o texto original como veio. */
export function formatarKm(km: number | null, kmRaw: string): string {
  if (km !== null) return `${km.toLocaleString("pt-BR")} km`;
  return kmRaw.trim();
}
