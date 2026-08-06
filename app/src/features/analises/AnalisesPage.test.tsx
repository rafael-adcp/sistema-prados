// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProvedorDeDadosParaTeste } from "../../data/ProvedorDeDados";
import { mesIsoDe, mesmoMesDoAnoAnterior, rotuloDeMes } from "../../domain/analises";
import { hojeIso } from "../../domain/datas";
import {
  criarAmbienteDeTeste,
  renderizarComDados,
  servicoImportado,
  type AmbienteDeTeste,
} from "../../testes/renderComDados";
import { AnalisesPage } from "./AnalisesPage";

// O billboard.js precisa de medidas de SVG que o jsdom não tem; o Grafico real
// roda, mas a geração vira um stub. Os números continuam nos cartões e tabelas.
vi.mock("billboard.js", () => ({
  default: { generate: vi.fn(() => ({ destroy: vi.fn() })) },
  bar: vi.fn(() => "barra"),
  line: vi.fn(() => "linha"),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ ask: vi.fn(async () => true), open: vi.fn() }));

let ambiente: AmbienteDeTeste;

const hoje = hojeIso();
const mesAtual = mesIsoDe(hoje);
const mesAnoPassado = mesmoMesDoAnoAnterior(mesAtual);

beforeEach(async () => {
  ambiente = criarAmbienteDeTeste();
  await ambiente.repositorio.substituirTodosPor([
    servicoImportado({ id: 1, placa: "AAA0001", data: hoje }),
    servicoImportado({ id: 2, placa: "AAA0001", data: `${mesAnoPassado}-15` }),
    servicoImportado({ id: 3, placa: "BBB0002", carro: "FUSCA 1300", data: null }),
  ]);
});

afterEach(() => ambiente.banco.fechar());

describe("carregamento sob demanda", () => {
  it("não roda nenhuma consulta enquanto a aba não está ativa", async () => {
    const contarBase = vi.spyOn(ambiente.dados.analises, "contarBase");
    const { rerender } = renderizarComDados(
      <AnalisesPage ativa={false} aoVerHistorico={vi.fn()} />,
      ambiente.dados,
    );
    expect(contarBase).not.toHaveBeenCalled();

    rerender(
      <ProvedorDeDadosParaTeste dados={ambiente.dados}>
        <AnalisesPage ativa aoVerHistorico={vi.fn()} />
      </ProvedorDeDadosParaTeste>,
    );
    await waitFor(() => expect(contarBase).toHaveBeenCalled());
  });
});

describe("quando o cálculo falha", () => {
  it("mostra o erro e o botão Tentar novamente recarrega", async () => {
    const usuario = userEvent.setup();
    vi.spyOn(ambiente.dados.analises, "contarBase").mockRejectedValueOnce(new Error("falhou"));
    const erroDeConsole = vi.spyOn(console, "error").mockImplementation(() => {});
    renderizarComDados(<AnalisesPage ativa aoVerHistorico={vi.fn()} />, ambiente.dados);

    expect(await screen.findByText(/não foi possível calcular/i)).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: /tentar novamente/i }));
    expect(await screen.findByText(/calculados sobre 2 de 3/i)).toBeInTheDocument();
    erroDeConsole.mockRestore();
  });
});

describe("números", () => {
  it("mostra cartões, gráficos e o aviso da base confiável", async () => {
    renderizarComDados(<AnalisesPage ativa aoVerHistorico={vi.fn()} />, ambiente.dados);

    expect(await screen.findByText(/calculados sobre 2 de 3 registros/i)).toBeInTheDocument();

    const cartaoDoMes = screen.getByText(`Trocas em ${rotuloDeMes(mesAtual)}`).closest("div");
    expect(cartaoDoMes).toHaveTextContent("1");
    const cartaoAnoPassado = screen
      .getByText(`Trocas em ${rotuloDeMes(mesAnoPassado)}`)
      .closest("div");
    expect(cartaoAnoPassado).toHaveTextContent("1");

    expect(screen.getByText("Total de trocas por ano")).toBeInTheDocument();
    expect(screen.getByText(/em quanto tempo os carros voltam/i)).toBeInTheDocument();
    // No recorte padrão (ano atual) o AAA0001 tem 1 visita só: ainda não "voltou".
    expect(screen.getByText(/carros que voltam/i).closest("div")).toHaveTextContent("0%");
  });

  it("mostra o aviso Recalculando… sobre o painel esmaecido e some no fim", async () => {
    const usuario = userEvent.setup();
    renderizarComDados(<AnalisesPage ativa aoVerHistorico={vi.fn()} />, ambiente.dados);
    await screen.findByText(/calculados sobre/i);
    expect(screen.queryByText(/recalculando/i)).not.toBeInTheDocument();

    let liberar!: (produtos: never[]) => void;
    vi.spyOn(ambiente.dados.analises, "topProdutos").mockReturnValueOnce(
      new Promise((resolver) => {
        liberar = resolver;
      }),
    );
    await usuario.selectOptions(screen.getByLabelText("Ano"), "Todos os anos");
    expect(await screen.findByText(/recalculando/i)).toBeInTheDocument();
    expect(document.querySelector(".painel-analises")).toHaveClass("atualizando");

    liberar([]);
    await waitFor(() => expect(screen.queryByText(/recalculando/i)).not.toBeInTheDocument());
    expect(document.querySelector(".painel-analises")).not.toHaveClass("atualizando");
  });

  it("o seletor de ano vem no ano atual e filtra os indicadores", async () => {
    const usuario = userEvent.setup();
    const topProdutos = vi.spyOn(ambiente.dados.analises, "topProdutos");
    renderizarComDados(<AnalisesPage ativa aoVerHistorico={vi.fn()} />, ambiente.dados);
    await screen.findByText(/calculados sobre/i);

    const anoAtual = hoje.slice(0, 4);
    expect(screen.getByLabelText("Ano")).toHaveValue(anoAtual);
    expect(topProdutos).toHaveBeenCalledWith(10, { deAno: anoAtual, ateAno: anoAtual });

    await usuario.selectOptions(screen.getByLabelText("Ano"), "Todos os anos");
    await waitFor(() => expect(topProdutos).toHaveBeenCalledWith(10, undefined));
  });
});

describe("qualidade dos dados", () => {
  it("abre o relatório, corrige o registro e a contagem cai", async () => {
    const usuario = userEvent.setup();
    renderizarComDados(<AnalisesPage ativa aoVerHistorico={vi.fn()} />, ambiente.dados);

    await usuario.click(await screen.findByText("Sem data (1)"));
    const linha = (await screen.findByText("FUSCA 1300")).closest("tr");
    expect(linha).not.toBeNull();
    await usuario.click(linha as HTMLElement);

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveTextContent("Editar serviço nº 3");
    fireEvent.change(screen.getByLabelText("Data"), { target: { value: `${mesAtual}-01` } });
    await usuario.click(screen.getByRole("button", { name: /salvar alterações/i }));

    expect(await screen.findByText("Sem data (0)")).toBeInTheDocument();
    expect(await screen.findByText(/nenhum serviço encontrado/i)).toBeInTheDocument();
  });

  it("lista placas com carros diferentes e leva ao histórico", async () => {
    await ambiente.repositorio.substituirTodosPor([
      servicoImportado({ id: 1, placa: "CCC0003", carro: "GOL 1.0", data: "2024-01-10" }),
      servicoImportado({ id: 2, placa: "CCC0003", carro: "UNO MILLE", data: "2024-02-10" }),
    ]);
    const usuario = userEvent.setup();
    const aoVerHistorico = vi.fn();
    renderizarComDados(<AnalisesPage ativa aoVerHistorico={aoVerHistorico} />, ambiente.dados);

    await usuario.click(await screen.findByText("Mesma placa com carros diferentes (1)"));
    expect(await screen.findByText(/GOL 1\.0 · UNO MILLE|UNO MILLE · GOL 1\.0/)).toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: "CCC0003" }));
    expect(aoVerHistorico).toHaveBeenCalledWith("CCC0003");
  });
});
