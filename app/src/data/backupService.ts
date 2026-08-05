import { invoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import type Database from "@tauri-apps/plugin-sql";
import { deveFazerBackupAutomatico } from "../domain/backup";
import { hojeIso, timestampParaArquivo } from "../domain/datas";
import type { ServicoRepository } from "./servicoRepository";

export const CONFIG_PASTA_BACKUP = "pasta_backup";
export const CONFIG_ULTIMO_BACKUP = "ultimo_backup_em";

function escaparParaSql(caminho: string): string {
  return caminho.replace(/'/g, "''");
}

/**
 * Backup = `VACUUM INTO` (cópia íntegra e compacta do SQLite, segura mesmo
 * com o banco aberto) direto na pasta escolhida, com nome datado.
 */
export class BackupService {
  constructor(
    private readonly db: Database,
    private readonly repositorio: ServicoRepository,
  ) {}

  async pastaConfigurada(): Promise<string | null> {
    return this.repositorio.lerConfig(CONFIG_PASTA_BACKUP);
  }

  async definirPasta(pasta: string): Promise<void> {
    await this.repositorio.gravarConfig(CONFIG_PASTA_BACKUP, pasta);
  }

  async ultimoBackupEm(): Promise<string | null> {
    return this.repositorio.lerConfig(CONFIG_ULTIMO_BACKUP);
  }

  /** Executa o backup agora. Retorna o caminho completo do arquivo gerado. */
  async executarBackup(pasta: string): Promise<string> {
    const nome = `prados-backup-${timestampParaArquivo(new Date())}.db`;
    const destino = await join(pasta, nome);
    await this.db.execute(`VACUUM INTO '${escaparParaSql(destino)}'`);
    await invoke("podar_backups", { pasta });
    await this.repositorio.gravarConfig(CONFIG_ULTIMO_BACKUP, hojeIso());
    return destino;
  }

  /** Chamado na abertura do app: faz backup semanal sem incomodar ninguém. */
  async fazerBackupAutomaticoSePrecisar(): Promise<void> {
    const pasta = await this.pastaConfigurada();
    if (pasta === null) return;
    const ultimo = await this.ultimoBackupEm();
    if (deveFazerBackupAutomatico(ultimo, hojeIso())) {
      await this.executarBackup(pasta);
    }
  }
}
