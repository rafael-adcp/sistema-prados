import Database from "@tauri-apps/plugin-sql";

const URL_BANCO = "sqlite:prados.db"; // fica em %APPDATA%/com.prados.sistema/

let instancia: Database | null = null;

export async function obterBanco(): Promise<Database> {
  if (instancia === null) {
    instancia = await Database.load(URL_BANCO);
  }
  return instancia;
}

/** Necessário antes de substituir o arquivo do banco (importação inicial). */
export async function fecharBanco(): Promise<void> {
  if (instancia !== null) {
    await instancia.close();
    instancia = null;
  }
}
