/**
 * Forma canônica de placa no banco: maiúsculas, sem espaços nem hífens.
 * Escrita e leitura usam a MESMA regra — qualquer assimetria aqui faz um
 * veículo "sumir" da busca e dividir o histórico em dois.
 */
export function normalizarPlaca(placaRaw: string): string {
  return placaRaw.toUpperCase().replace(/[\s-]/g, "");
}

/**
 * Heurística conservadora: só tratamos como placa o que começa com 3 letras
 * seguidas de número (padrão antigo AAA9999 e Mercosul AAA9A99), com até 7
 * caracteres. Termos como "GOL" caem na busca por texto, que também olha placa.
 */
export function pareceBuscaPorPlaca(termo: string): boolean {
  return /^[A-Z]{3}[0-9][A-Z0-9]{0,3}$/.test(normalizarPlaca(termo));
}

export function prefixoDePlaca(termo: string): string {
  return normalizarPlaca(termo);
}
