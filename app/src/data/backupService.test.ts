import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarBancoDeTeste, type BancoDeTeste } from "../testes/bancoDeTeste";
import type { PortaDoBanco } from "./portaDoBanco";
import { BackupService, CONFIG_PASTA_BACKUP, CONFIG_ULTIMO_BACKUP } from "./backupService";
import { ConfigRepository } from "./configRepository";

const nucleo = vi.hoisted(() => ({
  invoke: vi.fn(),
  loadDoPlugin: vi.fn(async () => ({})),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: nucleo.invoke }));
vi.mock("@tauri-apps/api/path", () => ({
  join: vi.fn(async (...partes: string[]) => partes.join("\\")),
}));
vi.mock("@tauri-apps/plugin-sql", () => ({ default: { load: nucleo.loadDoPlugin } }));

const invocacoes: { comando: string; args: unknown }[] = [];

let banco: BancoDeTeste;
let config: ConfigRepository;
let comandosSql: string[];
let portaEspiona: PortaDoBanco;

beforeEach(() => {
  invocacoes.length = 0;
  nucleo.invoke.mockReset();
  nucleo.invoke.mockImplementation(async (comando: string, args: unknown) => {
    invocacoes.push({ comando, args });
    return null;
  });
  nucleo.loadDoPlugin.mockClear();
  banco = criarBancoDeTeste();
  config = new ConfigRepository(banco);
  comandosSql = [];
  // espião para o VACUUM INTO (não dá para rodar VACUUM de verdade em memória)
  portaEspiona = {
    select: banco.select.bind(banco),
    execute: async (sql, parametros) => {
      comandosSql.push(sql);
      if (sql.startsWith("VACUUM")) return { rowsAffected: 0 };
      return banco.execute(sql, parametros);
    },
  };
});

afterEach(() => banco.fechar());

describe("executarBackup", () => {
  it("escreve .part, promove, poda e registra a data — nessa ordem", async () => {
    const backup = new BackupService(portaEspiona, config);
    const destino = await backup.executarBackup("D:\\backups");

    const vacuum = comandosSql.find((sql) => sql.startsWith("VACUUM INTO"));
    expect(vacuum).toMatch(/prados-backup-.*\.db\.part'/);
    expect(destino).toMatch(/^D:\\backups\\prados-backup-.*\.db$/);
    expect(invocacoes.map((i) => i.comando)).toEqual(["concluir_backup", "podar_backups"]);
    expect(await config.ler(CONFIG_ULTIMO_BACKUP)).not.toBeNull();
  });

  it("escapa aspas simples no caminho da pasta", async () => {
    const backup = new BackupService(portaEspiona, config);
    await backup.executarBackup("D:\\pasta d'agua");
    const vacuum = comandosSql.find((sql) => sql.startsWith("VACUUM INTO"));
    expect(vacuum).toContain("d''agua");
  });
});

describe("fazerBackupAutomaticoSePrecisar", () => {
  it("não faz nada sem pasta configurada", async () => {
    const backup = new BackupService(portaEspiona, config);
    await backup.fazerBackupAutomaticoSePrecisar();
    expect(comandosSql.some((sql) => sql.startsWith("VACUUM"))).toBe(false);
  });

  it("faz o backup do dia e não repete na segunda abertura do mesmo dia", async () => {
    await config.gravar(CONFIG_PASTA_BACKUP, "D:\\backups");
    await config.gravar(CONFIG_ULTIMO_BACKUP, "2020-01-01");
    const backup = new BackupService(portaEspiona, config);
    await backup.fazerBackupAutomaticoSePrecisar();
    expect(comandosSql.some((sql) => sql.startsWith("VACUUM"))).toBe(true);

    comandosSql.length = 0;
    await backup.fazerBackupAutomaticoSePrecisar(); // acabou de rodar → não repete
    expect(comandosSql.some((sql) => sql.startsWith("VACUUM"))).toBe(false);
  });
});

describe("importarBanco", () => {
  it("valida ANTES de fechar a conexão e então substitui com timestamp", async () => {
    const backup = new BackupService(portaEspiona, config);
    await backup.importarBanco("D:\\novo.db");
    expect(invocacoes.map((i) => i.comando)).toEqual(["validar_banco", "substituir_banco"]);
    const substituicao = invocacoes[1].args as { caminhoOrigem: string; timestamp: string };
    expect(substituicao.caminhoOrigem).toBe("D:\\novo.db");
    expect(substituicao.timestamp).toMatch(/^\d{8}-\d{6}$/);
  });

  it("se a substituição falhar, reabre o banco para o app continuar vivo", async () => {
    nucleo.invoke.mockImplementation(async (comando: string, args: unknown) => {
      invocacoes.push({ comando, args });
      if (comando === "substituir_banco") throw new Error("disco cheio");
      return null;
    });
    const backup = new BackupService(portaEspiona, config);
    await expect(backup.importarBanco("D:\\novo.db")).rejects.toThrow("disco cheio");
    expect(nucleo.loadDoPlugin).toHaveBeenCalled();
  });
});
