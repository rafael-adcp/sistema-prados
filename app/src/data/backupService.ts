import { invoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { deveFazerBackupAutomatico } from "../domain/backup";
import { hojeIso, timestampParaArquivo } from "../domain/datas";
import type { ConfigRepository } from "./configRepository";
import { fecharBanco, obterBanco } from "./database";
import type { PortaDoBanco } from "./portaDoBanco";

export const CONFIG_PASTA_BACKUP = "pasta_backup";
export const CONFIG_ULTIMO_BACKUP = "ultimo_backup_em";

function escaparParaSql(caminho: string): string {
  return caminho.replace(/'/g, "''");
}

/**
 * Backup = `VACUUM INTO` (cópia íntegra e compacta do SQLite, segura mesmo com
 * o banco aberto) escrita como .part e promovida ao nome final só quando
 * completa — um backup interrompido nunca passa por backup válido.
 */
export class BackupService {
  constructor(
    private readonly db: PortaDoBanco,
    private readonly config: ConfigRepository,
  ) {}

  async pastaConfigurada(): Promise<string | null> {
    return this.config.ler(CONFIG_PASTA_BACKUP);
  }

  async definirPasta(pasta: string): Promise<void> {
    await this.config.gravar(CONFIG_PASTA_BACKUP, pasta);
  }

  async ultimoBackupEm(): Promise<string | null> {
    return this.config.ler(CONFIG_ULTIMO_BACKUP);
  }

  /** Executa o backup agora. Retorna o caminho completo do arquivo gerado. */
  async executarBackup(pasta: string): Promise<string> {
    const nome = `prados-backup-${timestampParaArquivo(new Date())}.db`;
    const destino = await join(pasta, nome);
    await this.db.execute(`VACUUM INTO '${escaparParaSql(`${destino}.part`)}'`);
    await invoke("concluir_backup", { pasta, nome });
    await invoke("podar_backups", { pasta });
    await this.config.gravar(CONFIG_ULTIMO_BACKUP, hojeIso());
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

  /**
   * Importação inicial: valida o arquivo ANTES de fechar a conexão (o erro
   * comum — arquivo errado — não derruba o app); se a substituição falhar
   * depois do fechamento, reabre o banco original para o app continuar vivo.
   * O chamador recarrega a janela em caso de sucesso.
   */
  async importarBanco(caminho: string): Promise<void> {
    await invoke("validar_banco", { caminho });
    await fecharBanco();
    try {
      await invoke("substituir_banco", {
        caminhoOrigem: caminho,
        timestamp: timestampParaArquivo(new Date()),
      });
    } catch (causa) {
      await obterBanco();
      throw causa;
    }
  }
}
