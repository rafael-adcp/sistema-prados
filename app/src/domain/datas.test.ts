import { describe, expect, it } from "vitest";
import {
  dataEhSuspeita,
  formatarDataBr,
  interpretarTermoDeData,
  paraIsoLocal,
  timestampParaArquivo,
} from "./datas";

describe("paraIsoLocal", () => {
  it("usa a data local, não UTC (às 23h o dia não pode virar)", () => {
    expect(paraIsoLocal(new Date(2026, 7, 5, 23, 30))).toBe("2026-08-05");
  });
});

describe("formatarDataBr", () => {
  it("converte ISO para dd/mm/aaaa", () => {
    expect(formatarDataBr("2025-12-24")).toBe("24/12/2025");
  });

  it("mostra travessão quando não há data", () => {
    expect(formatarDataBr(null)).toBe("—");
  });
});

describe("interpretarTermoDeData", () => {
  it("dia exato", () => {
    expect(interpretarTermoDeData("25/12/2024")).toEqual({ de: "2024-12-25", ate: "2024-12-25" });
  });

  it("dia e mês com um dígito", () => {
    expect(interpretarTermoDeData("5/8/2026")).toEqual({ de: "2026-08-05", ate: "2026-08-05" });
  });

  it("mês inteiro", () => {
    expect(interpretarTermoDeData("2/2024")).toEqual({ de: "2024-02-01", ate: "2024-02-29" });
  });

  it("mês inválido não é data", () => {
    expect(interpretarTermoDeData("13/2024")).toBeNull();
  });

  it("texto comum não é data", () => {
    expect(interpretarTermoDeData("GOL 1.0")).toBeNull();
  });
});

describe("dataEhSuspeita", () => {
  const hoje = "2026-08-05";

  it("marca datas antes de 2000 (typo real: 1982)", () => {
    expect(dataEhSuspeita("1982-10-10", hoje)).toBe(true);
  });

  it("marca datas no futuro (typo real: 2042)", () => {
    expect(dataEhSuspeita("2042-02-10", hoje)).toBe(true);
  });

  it("aceita datas normais e ausentes", () => {
    expect(dataEhSuspeita("2025-12-24", hoje)).toBe(false);
    expect(dataEhSuspeita(null, hoje)).toBe(false);
  });
});

describe("timestampParaArquivo", () => {
  it("gera nome ordenável cronologicamente", () => {
    expect(timestampParaArquivo(new Date(2026, 7, 5, 9, 3, 7))).toBe("20260805-090307");
  });
});
