import { describe, expect, it } from "vitest";
import { normalizarPlaca, pareceBuscaPorPlaca, prefixoDePlaca } from "./placa";

describe("normalizarPlaca", () => {
  it("tira espaços das pontas e põe em maiúsculas", () => {
    expect(normalizarPlaca("  abc1234 ")).toBe("ABC1234");
  });

  it("compacta separadores — escrita e busca usam a MESMA forma canônica", () => {
    expect(normalizarPlaca("ABC  6914")).toBe("ABC1234");
    expect(normalizarPlaca("abc-1234")).toBe("ABC1234");
    expect(normalizarPlaca("DOM 620")).toBe("DOM620");
  });
});

describe("pareceBuscaPorPlaca", () => {
  it("reconhece placa antiga completa", () => {
    expect(pareceBuscaPorPlaca("ABC1234")).toBe(true);
  });

  it("reconhece placa Mercosul completa", () => {
    expect(pareceBuscaPorPlaca("FTJ1H42")).toBe(true);
  });

  it("reconhece prefixo parcial de placa (3 letras + número)", () => {
    expect(pareceBuscaPorPlaca("ABC1")).toBe(true);
  });

  it("aceita placa digitada com hífen", () => {
    expect(pareceBuscaPorPlaca("ABC-1234")).toBe(true);
  });

  it("não confunde modelo de carro com placa", () => {
    expect(pareceBuscaPorPlaca("GOL")).toBe(false);
    expect(pareceBuscaPorPlaca("GOL 1.0")).toBe(false);
    expect(pareceBuscaPorPlaca("HB20")).toBe(false);
  });

  it("não trata número puro como placa", () => {
    expect(pareceBuscaPorPlaca("6914")).toBe(false);
  });
});

describe("prefixoDePlaca", () => {
  it("compacta separadores para casar com o formato do banco", () => {
    expect(prefixoDePlaca("abc-1234")).toBe("ABC1234");
  });
});
