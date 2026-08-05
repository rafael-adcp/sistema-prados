import { describe, expect, it } from "vitest";
import { formatarKm, normalizarKm } from "./km";

describe("normalizarKm", () => {
  it("entende ponto de milhar do jeito brasileiro", () => {
    expect(normalizarKm("126.705")).toBe(126705);
  });

  it("entende número puro e zeros à esquerda", () => {
    expect(normalizarKm("138139")).toBe(138139);
    expect(normalizarKm("086490")).toBe(86490);
  });

  it("descarta lixo sem dígitos (dado real do sistema antigo)", () => {
    expect(normalizarKm("''''''''''''")).toBeNull();
    expect(normalizarKm("")).toBeNull();
    expect(normalizarKm("   ")).toBeNull();
  });

  it("aproveita os dígitos quando há sujeira junto", () => {
    expect(normalizarKm("4*")).toBe(4);
    expect(normalizarKm("45.000 km")).toBe(45000);
  });

  it("rejeita quilometragens impossíveis", () => {
    expect(normalizarKm("99999999")).toBeNull();
  });
});

describe("formatarKm", () => {
  it("formata o número em pt-BR", () => {
    expect(formatarKm(126705, "126.705")).toBe("126.705 km");
  });

  it("cai para o texto original quando não há número", () => {
    expect(formatarKm(null, "4*")).toBe("4*");
  });
});
