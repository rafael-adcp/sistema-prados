// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import bb, { bar, grid, line } from "billboard.js";
import { Grafico } from "./Grafico";

vi.mock("billboard.js", () => ({
  default: { generate: vi.fn(() => ({ destroy: vi.fn() })) },
  bar: vi.fn(() => "tipo-barra"),
  line: vi.fn(() => "tipo-linha"),
  grid: vi.fn(() => ({})),
}));

const generate = bb.generate as Mock;

function opcoesDaUltimaGeracao() {
  return generate.mock.calls[generate.mock.calls.length - 1][0];
}

beforeEach(() => {
  generate.mockClear();
  (bar as Mock).mockClear();
  (line as Mock).mockClear();
});

describe("Grafico", () => {
  it("registra o módulo grid do billboard ao carregar (sem ele, tooltip e linhas de referência morrem)", () => {
    expect(grid).toHaveBeenCalled();
  });

  it("mostra o título e entrega séries e rótulos ao billboard", () => {
    render(
      <Grafico
        titulo="Trocas por ano"
        tipo="linha"
        rotulosX={["2024", "2025"]}
        series={[{ nome: "Trocas", pontos: [10, null] }]}
      />,
    );
    const opcoes = opcoesDaUltimaGeracao();
    expect(opcoes.data.columns).toEqual([["Trocas", 10, null]]);
    expect(opcoes.axis.x.categories).toEqual(["2024", "2025"]);
    expect(opcoes.data.type).toBe("tipo-linha");
    expect(opcoes.line.connectNull).toBe(false);
    expect(opcoes.tooltip.order).toBe("desc");
    expect(document.querySelector("figcaption")?.textContent).toBe("Trocas por ano");
  });

  it("usa barras quando o tipo é barra", () => {
    render(
      <Grafico titulo="Faixas" tipo="barra" rotulosX={["A"]} series={[{ nome: "N", pontos: [1] }]} />,
    );
    expect(opcoesDaUltimaGeracao().data.type).toBe("tipo-barra");
  });

  it("legenda só aparece com mais de uma série", () => {
    render(
      <Grafico titulo="Um" tipo="linha" rotulosX={["A"]} series={[{ nome: "N", pontos: [1] }]} />,
    );
    expect(opcoesDaUltimaGeracao().legend.show).toBe(false);
    render(
      <Grafico
        titulo="Dois"
        tipo="linha"
        rotulosX={["A"]}
        series={[
          { nome: "N", pontos: [1] },
          { nome: "M", pontos: [2] },
        ]}
      />,
    );
    expect(opcoesDaUltimaGeracao().legend.show).toBe(true);
  });

  it("linhas de referência viram grid lines com o valor formatado", () => {
    render(
      <Grafico
        titulo="Com média"
        tipo="linha"
        rotulosX={["A"]}
        series={[{ nome: "N", pontos: [1] }]}
        referencias={[{ rotulo: "Média", valor: 4980.4 }]}
      />,
    );
    expect(opcoesDaUltimaGeracao().grid.y.lines).toEqual([
      { value: 4980.4, text: "Média: 4.980" },
    ]);
  });

  it("destrói o gráfico ao desmontar e regenera quando os dados mudam", () => {
    const { rerender, unmount } = render(
      <Grafico titulo="T" tipo="linha" rotulosX={["A"]} series={[{ nome: "N", pontos: [1] }]} />,
    );
    expect(generate).toHaveBeenCalledTimes(1);
    const primeiro = generate.mock.results[0].value;

    rerender(
      <Grafico titulo="T" tipo="linha" rotulosX={["A"]} series={[{ nome: "N", pontos: [2] }]} />,
    );
    expect(primeiro.destroy).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledTimes(2);

    unmount();
    expect(generate.mock.results[1].value.destroy).toHaveBeenCalledTimes(1);
  });
});
