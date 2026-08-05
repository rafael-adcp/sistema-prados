import { describe, expect, it } from "vitest";
import {
  novoServicoVazio,
  paraEdicao,
  temProblemas,
  validarEdicaoDeServico,
  validarNovoServico,
} from "./servico";

const HOJE = "2026-08-05";

function servicoValido() {
  return {
    ...novoServicoVazio(HOJE),
    placa: "ABC1234",
    produto: "4 HAV 5W30",
  };
}

describe("validarNovoServico", () => {
  it("aceita serviço completo com data de hoje", () => {
    const problemas = validarNovoServico(servicoValido(), HOJE);
    expect(temProblemas(problemas)).toBe(false);
  });

  it("aponta o problema no campo produto", () => {
    const problemas = validarNovoServico({ ...servicoValido(), produto: "  " }, HOJE);
    expect(problemas.produto).toMatch(/produto/i);
  });

  it("aponta placa quando não há placa nem carro; carro sozinho basta", () => {
    expect(validarNovoServico({ ...servicoValido(), placa: "", carro: "" }, HOJE).placa).toBeDefined();
    expect(temProblemas(validarNovoServico({ ...servicoValido(), placa: "", carro: "GOL" }, HOJE))).toBe(false);
  });

  it("aponta no campo data: futuro, passado impossível e ausência", () => {
    expect(validarNovoServico({ ...servicoValido(), data: "2207-06-15" }, HOJE).data).toMatch(/ano/i);
    expect(validarNovoServico({ ...servicoValido(), data: "0224-06-15" }, HOJE).data).toMatch(/ano/i);
    expect(validarNovoServico({ ...servicoValido(), data: "" }, HOJE).data).toMatch(/data/i);
  });
});

describe("validarEdicaoDeServico", () => {
  it("permite editar registro legado sem data, mas ainda barra data absurda", () => {
    expect(temProblemas(validarEdicaoDeServico({ ...servicoValido(), data: "" }, HOJE))).toBe(false);
    expect(validarEdicaoDeServico({ ...servicoValido(), data: "2207-01-01" }, HOJE).data).toBeDefined();
  });
});

describe("paraEdicao", () => {
  it("converte data null em campo vazio", () => {
    const servico = {
      id: 7,
      carro: "SANTANA",
      km: null,
      kmRaw: "''''",
      placa: "BFD6186",
      produto: "3SL BR",
      data: null,
      dataSuspeita: false,
    };
    expect(paraEdicao(servico).data).toBe("");
    expect(paraEdicao(servico).kmRaw).toBe("''''");
  });
});
