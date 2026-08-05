const DIAS_ENTRE_BACKUPS_AUTOMATICOS = 7;
const MILISSEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

export function deveFazerBackupAutomatico(
  ultimoBackupIso: string | null,
  hojeIso: string,
): boolean {
  if (ultimoBackupIso === null) return true;
  const decorrido = Date.parse(hojeIso) - Date.parse(ultimoBackupIso);
  return decorrido >= DIAS_ENTRE_BACKUPS_AUTOMATICOS * MILISSEGUNDOS_POR_DIA;
}
