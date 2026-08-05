import { describe, expect, it } from "vitest";
import { interpretarBusca } from "./interpretarBusca";

describe("interpretarBusca", () => {
  it("vazio mostra os recentes", () => {
    expect(interpretarBusca("  ")).toEqual({ tipo: "vazia" });
  });

  it("data exata", () => {
    expect(interpretarBusca("24/12/2025")).toEqual({
      tipo: "data",
      de: "2025-12-24",
      ate: "2025-12-24",
    });
  });

  it("mês inteiro", () => {
    expect(interpretarBusca("12/2025")).toEqual({
      tipo: "data",
      de: "2025-12-01",
      ate: "2025-12-31",
    });
  });

  it("placa completa ou parcial vai pelo índice", () => {
    expect(interpretarBusca("abc1234")).toEqual({ tipo: "placa", prefixo: "ABC1234" });
    expect(interpretarBusca("ABC1")).toEqual({ tipo: "placa", prefixo: "ABC1" });
  });

  it("modelo de carro vira busca por texto", () => {
    expect(interpretarBusca("GOL 1.0")).toEqual({ tipo: "texto", termo: "GOL 1.0" });
  });

  it("código de produto vira busca por texto", () => {
    expect(interpretarBusca("PH5548")).toEqual({ tipo: "texto", termo: "PH5548" });
  });
});
