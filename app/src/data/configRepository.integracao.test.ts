import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarBancoDeTeste, type BancoDeTeste } from "../testes/bancoDeTeste";
import { ConfigRepository } from "./configRepository";

let banco: BancoDeTeste;
let config: ConfigRepository;

beforeEach(() => {
  banco = criarBancoDeTeste();
  config = new ConfigRepository(banco);
});

afterEach(() => banco.fechar());

describe("ConfigRepository", () => {
  it("chave inexistente é null", async () => {
    expect(await config.ler("pasta_backup")).toBeNull();
  });

  it("grava, lê e sobrescreve (upsert)", async () => {
    await config.gravar("pasta_backup", "D:\\backups");
    expect(await config.ler("pasta_backup")).toBe("D:\\backups");
    await config.gravar("pasta_backup", "E:\\pendrive");
    expect(await config.ler("pasta_backup")).toBe("E:\\pendrive");
  });
});
