import { describe, expect, it } from "vitest";
import {
  DIAS_DA_SEMANA,
  FAIXAS_DE_RETORNO,
  FAIXAS_DE_VISITAS,
  mediaDe,
  mesIsoDe,
  mesmoMesDoAnoAnterior,
  montarSeriesDeItens,
  montarSeriesPorAno,
  percentual,
  periodoDeUltimosAnos,
  resumoDosRetornos,
  rotuloDeMes,
  rotuloDeMesCalendario,
  totaisPorDiaDaSemana,
  totaisPorFaixa,
} from "./analises";

describe("montarSeriesPorAno", () => {
  it("preenche com 0 os meses sem registro de anos passados", () => {
    const series = montarSeriesPorAno(
      [
        { ano: "2024", mes: "01", total: 10 },
        { ano: "2024", mes: "12", total: 5 },
      ],
      ["2024"],
      "2026-08",
    );
    expect(series).toEqual([{ nome: "2024", pontos: [10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5] }]);
  });

  it("no ano corrente, meses futuros viram null para a linha parar no presente", () => {
    const [serie] = montarSeriesPorAno([{ ano: "2026", mes: "07", total: 3 }], ["2026"], "2026-08");
    expect(serie.pontos).toEqual([0, 0, 0, 0, 0, 0, 3, 0, null, null, null, null]);
  });

  it("gera uma série por ano pedido, na ordem pedida", () => {
    const series = montarSeriesPorAno([], ["2023", "2024"], "2026-08");
    expect(series.map((serie) => serie.nome)).toEqual(["2023", "2024"]);
  });
});

describe("faixas de retorno e de visitas", () => {
  it("a última faixa recolhe o resto (sem limite superior)", () => {
    for (const faixas of [FAIXAS_DE_RETORNO, FAIXAS_DE_VISITAS]) {
      expect(faixas[faixas.length - 1].ate).toBeNull();
      expect(faixas.slice(0, -1).every((faixa) => faixa.ate !== null)).toBe(true);
    }
  });

  it("totaisPorFaixa preenche com 0 as faixas sem registro e ignora índices inválidos", () => {
    const totais = totaisPorFaixa(
      [
        { faixa: 0, total: 7 },
        { faixa: 6, total: 2 },
        { faixa: 99, total: 5 },
      ],
      FAIXAS_DE_RETORNO,
    );
    expect(totais).toEqual([7, 0, 0, 0, 0, 0, 2]);
  });

  it("totaisPorFaixa acompanha o tamanho da lista de faixas", () => {
    expect(totaisPorFaixa([{ faixa: 3, total: 4 }], FAIXAS_DE_VISITAS)).toEqual([0, 0, 0, 4]);
  });
});

describe("dias da semana", () => {
  it("traduz a numeração do SQLite (0 = domingo) para a semana começando na segunda", () => {
    expect(DIAS_DA_SEMANA).toEqual(["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]);
    const totais = totaisPorDiaDaSemana([
      { dia: "0", total: 4 }, // domingo → última posição
      { dia: "1", total: 7 }, // segunda → primeira
      { dia: "6", total: 9 }, // sábado → penúltima
    ]);
    expect(totais).toEqual([7, 0, 0, 0, 0, 9, 4]);
  });

  it("ignora numerações fora de 0 a 6", () => {
    expect(totaisPorDiaDaSemana([{ dia: "7", total: 5 }])).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe("montarSeriesDeItens", () => {
  it("uma série por item, do mais usado ao menos usado, com 0 nos anos sem uso", () => {
    const series = montarSeriesDeItens(
      [
        { nome: "OLEO B", ano: "2020", total: 2 },
        { nome: "OLEO A", ano: "2020", total: 3 },
        { nome: "OLEO A", ano: "2022", total: 4 },
      ],
      ["2020", "2021", "2022"],
    );
    expect(series).toEqual([
      { nome: "OLEO A", pontos: [3, 0, 4] },
      { nome: "OLEO B", pontos: [2, 0, 0] },
    ]);
  });

  it("desempata itens de mesmo total pelo nome", () => {
    const series = montarSeriesDeItens(
      [
        { nome: "OLEO C", ano: "2020", total: 1 },
        { nome: "OLEO B", ano: "2020", total: 1 },
      ],
      ["2020"],
    );
    expect(series.map((serie) => serie.nome)).toEqual(["OLEO B", "OLEO C"]);
  });
});

describe("números", () => {
  it("mediaDe calcula a média e devolve null para lista vazia", () => {
    expect(mediaDe([2, 4, 6])).toBe(4);
    expect(mediaDe([])).toBeNull();
  });

  it("resumoDosRetornos pondera a média pelo nº de retornos de cada ano", () => {
    expect(
      resumoDosRetornos([
        { ano: "2020", minimo: 10, media: 100, maximo: 200, total: 3 },
        { ano: "2021", minimo: 50, media: 300, maximo: 400, total: 1 },
      ]),
    ).toEqual({ minimo: 10, media: 150, maximo: 400 });
    expect(resumoDosRetornos([])).toBeNull();
  });

  it("percentual arredonda e não divide por zero", () => {
    expect(percentual(11330, 21414)).toBe("53%");
    expect(percentual(1, 0)).toBe("0%");
  });
});

describe("períodos e meses", () => {
  it("periodoDeUltimosAnos inclui o ano corrente na ponta de cima", () => {
    expect(periodoDeUltimosAnos("2026-08-05", 10)).toEqual({ deAno: "2017", ateAno: "2026" });
    expect(periodoDeUltimosAnos("2026-08-05", 1)).toEqual({ deAno: "2026", ateAno: "2026" });
  });

  it("mesIsoDe e mesmoMesDoAnoAnterior", () => {
    expect(mesIsoDe("2026-08-05")).toBe("2026-08");
    expect(mesmoMesDoAnoAnterior("2026-08")).toBe("2025-08");
  });

  it("rotuloDeMes e rotuloDeMesCalendario em português", () => {
    expect(rotuloDeMes("2026-08")).toBe("Agosto de 2026");
    expect(rotuloDeMesCalendario("03")).toBe("Março");
  });
});
