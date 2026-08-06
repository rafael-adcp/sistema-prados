import { appConfigDir, join } from "@tauri-apps/api/path";
import { timestampParaArquivo } from "../domain/datas";
import type { PortaDoBanco } from "./portaDoBanco";

/** Caminho do SQLite entra em `VACUUM INTO` como literal — pastas como `D:\Backup's` existem. */
export function escaparParaSql(caminho: string): string {
  return caminho.replace(/'/g, "''");
}

/** Tira uma cópia do banco e devolve o caminho dela. */
export type CopiarBanco = () => Promise<string>;

/**
 * Rede de segurança para operações que apagam o banco inteiro (hoje, a migração
 * do Access). `VACUUM INTO` produz uma cópia íntegra mesmo com o banco aberto, e
 * ela fica na pasta de dados do app — não depende de pasta de backup configurada.
 */
export function copiarBancoPara(db: PortaDoBanco, prefixo: string): CopiarBanco {
  return async () => {
    const nome = `${prefixo}-${timestampParaArquivo(new Date())}.db`;
    const destino = await join(await appConfigDir(), nome);
    await db.execute(`VACUUM INTO '${escaparParaSql(destino)}'`);
    return destino;
  };
}
