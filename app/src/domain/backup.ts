/**
 * Diário: o backup é um `VACUUM INTO` de ~16 MB, barato o bastante para rodar
 * toda abertura, e a perda máxima cai de uma semana de serviços para um dia.
 */
const DIAS_ENTRE_BACKUPS_AUTOMATICOS = 1;
const MILISSEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

export function deveFazerBackupAutomatico(
  ultimoBackupIso: string | null,
  hojeIso: string,
): boolean {
  if (ultimoBackupIso === null) return true;
  const decorrido = Date.parse(hojeIso) - Date.parse(ultimoBackupIso);
  return decorrido >= DIAS_ENTRE_BACKUPS_AUTOMATICOS * MILISSEGUNDOS_POR_DIA;
}
