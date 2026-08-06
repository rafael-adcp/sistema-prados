import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PortaDoBanco, ResultadoDeExecucao } from "../data/portaDoBanco";

const pastaDesteArquivo = dirname(fileURLToPath(import.meta.url));
const pastaMigrations = join(pastaDesteArquivo, "../../src-tauri/migrations");

export interface BancoDeTeste extends PortaDoBanco {
  fechar(): void;
}

/** Nomeia os parâmetros posicionais ($1, $2…) do jeito que o node:sqlite espera. */
function nomearParametros(parametros: unknown[]): Record<string, SQLInputValue> {
  return Object.fromEntries(
    parametros.map((valor, i) => [`$${i + 1}`, valor as SQLInputValue]),
  );
}

/**
 * A MESMA interface que o app usa (PortaDoBanco), servida por um SQLite real em
 * memória com o MESMO schema das migrations do Tauri. Os testes de repositório
 * executam o SQL de produção de verdade — binding, índices, collation e tudo.
 */
export function criarBancoDeTeste(): BancoDeTeste {
  const db = new DatabaseSync(":memory:");
  // Todas as migrations, na mesma ordem do Tauri (o prefixo 001_, 002_… ordena).
  const arquivos = readdirSync(pastaMigrations).filter((nome) => nome.endsWith(".sql")).sort();
  for (const arquivo of arquivos) {
    db.exec(readFileSync(join(pastaMigrations, arquivo), "utf-8"));
  }
  return {
    select<T>(sql: string, parametros: unknown[] = []): Promise<T> {
      const linhas = db.prepare(sql).all(nomearParametros(parametros)) as T;
      return Promise.resolve(linhas);
    },
    execute(sql: string, parametros: unknown[] = []): Promise<ResultadoDeExecucao> {
      const resultado = db.prepare(sql).run(nomearParametros(parametros));
      return Promise.resolve({
        rowsAffected: Number(resultado.changes),
        lastInsertId: Number(resultado.lastInsertRowid),
      });
    },
    fechar() {
      db.close();
    },
  };
}
