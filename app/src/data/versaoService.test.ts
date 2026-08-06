import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarBancoDeTeste, type BancoDeTeste } from "../testes/bancoDeTeste";
import { ConfigRepository } from "./configRepository";
import { CONFIG_VERSAO_DESDE, VersaoService } from "./versaoService";

let banco: BancoDeTeste;
let config: ConfigRepository;

beforeEach(() => {
  banco = criarBancoDeTeste();
  config = new ConfigRepository(banco);
});

afterEach(() => banco.fechar());

const servicoNaVersao = (numero: string) =>
  new VersaoService(config, async () => numero);

describe("VersaoService", () => {
  it("na primeira abertura carimba a data de hoje", async () => {
    const emUso = await servicoNaVersao("2.0.0").registrarAbertura("2026-08-06");
    expect(emUso).toEqual({ numero: "2.0.0", desde: "2026-08-06" });
  });

  // O ponto do recurso: sem isto, atualizacao que falhou em silencio e
  // indistinguivel de uma que deu certo.
  it("mudar de versão move a data; abrir de novo na mesma versão não move", async () => {
    await servicoNaVersao("2.0.0").registrarAbertura("2026-08-06");

    const mesmaVersaoDepois = await servicoNaVersao("2.0.0").registrarAbertura("2026-08-20");
    expect(mesmaVersaoDepois.desde).toBe("2026-08-06"); // continua a data original

    const atualizado = await servicoNaVersao("2.0.1").registrarAbertura("2026-08-21");
    expect(atualizado).toEqual({ numero: "2.0.1", desde: "2026-08-21" });
  });

  it("lerEmUso não carimba nada — só conta o que já está gravado", async () => {
    const servico = servicoNaVersao("2.0.0");

    const antes = await servico.lerEmUso();
    expect(antes).toEqual({ numero: "2.0.0", desde: null });
    expect(await config.ler(CONFIG_VERSAO_DESDE)).toBeNull();

    await servico.registrarAbertura("2026-08-06");
    expect(await servico.lerEmUso()).toEqual({ numero: "2.0.0", desde: "2026-08-06" });
  });
});
