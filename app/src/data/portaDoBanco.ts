/**
 * O que os repositórios precisam de um banco — nada além disso.
 * O Database do tauri-plugin-sql satisfaz esta interface estruturalmente;
 * nos testes, um adaptador sobre node:sqlite satisfaz igual, e as queries
 * reais rodam contra SQLite real.
 */
export interface ResultadoDeExecucao {
  rowsAffected: number;
  lastInsertId?: number;
}

export interface PortaDoBanco {
  select<T>(sql: string, parametros?: unknown[]): Promise<T>;
  execute(sql: string, parametros?: unknown[]): Promise<ResultadoDeExecucao>;
}
