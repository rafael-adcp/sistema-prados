import { describe, expect, it } from "vitest";
import { resumirHistorico } from "./historico";
import type { Servico } from "./servico";

function visita(parcial: Partial<Servico>): Servico {
  return {
    id: 1,
    carro: "",
    km: null,
    kmRaw: "",
    placa: "ABC1234",
    produto: "3 SL",
    data: null,
    dataSuspeita: false,
    ...parcial,
  };
}

describe("resumirHistorico", () => {
  it("acha a primeira visita independente da ordem de chegada", () => {
    const resumo = resumirHistorico([
      visita({ id: 3, data: "2025-12-24" }),
      visita({ id: 1, data: "2007-10-02" }),
      visita({ id: 2, data: "2015-05-10" }),
    ]);
    expect(resumo.clienteDesde).toBe("2007-10-02");
    expect(resumo.totalDeVisitas).toBe(3);
  });

  it("ignora datas suspeitas no 'cliente desde'", () => {
    const resumo = resumirHistorico([
      visita({ id: 1, data: "1982-10-10", dataSuspeita: true }),
      visita({ id: 2, data: "2015-05-10" }),
    ]);
    expect(resumo.clienteDesde).toBe("2015-05-10");
  });

  it("usa o primeiro carro não-vazio e lida com histórico vazio", () => {
    expect(resumirHistorico([visita({ carro: "" }), visita({ carro: "GOL 1.0" })]).carro).toBe("GOL 1.0");
    expect(resumirHistorico([]).carro).toBe("—");
    expect(resumirHistorico([]).clienteDesde).toBeNull();
  });
});
