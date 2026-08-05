export function normalizarPlaca(placaRaw: string): string {
  return placaRaw.trim().toUpperCase().replace(/\s+/g, " ");
}

/** Remove separadores que as pessoas digitam em placas ("ABC-1234"). */
function compactar(termo: string): string {
  return termo.replace(/[\s-]/g, "");
}

/**
 * Heurística conservadora: só tratamos como placa o que começa com 3 letras
 * seguidas de número (padrão antigo AAA9999 e Mercosul AAA9A99), com até 7
 * caracteres. Termos como "GOL" caem na busca por texto, que também olha placa.
 */
export function pareceBuscaPorPlaca(termo: string): boolean {
  const compacto = compactar(termo).toUpperCase();
  return /^[A-Z]{3}[0-9][A-Z0-9]{0,3}$/.test(compacto);
}

export function prefixoDePlaca(termo: string): string {
  return compactar(termo).toUpperCase();
}
