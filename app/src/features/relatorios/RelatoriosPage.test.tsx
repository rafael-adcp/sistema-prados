// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  criarAmbienteDeTeste,
  renderizarComDados,
  servicoImportado,
  type AmbienteDeTeste,
} from "../../testes/renderComDados";
import { RelatoriosPage } from "./RelatoriosPage";

let ambiente: AmbienteDeTeste;

beforeEach(async () => {
  ambiente = criarAmbienteDeTeste();
  await ambiente.repositorio.substituirTodosPor([
    servicoImportado({ id: 1, placa: "ABC1234", carro: "35S14", data: "2025-12-20" }),
    servicoImportado({ id: 2, placa: "GOL1234", carro: "UNO MILLE", data: "2025-12-24" }),
    servicoImportado({ id: 3, placa: "BBB2222", carro: "HB20", data: "2026-01-05" }),
  ]);
});

afterEach(() => ambiente.banco.fechar());

const aoVerHistorico = vi.fn();

function renderizar(limite?: number) {
  return renderizarComDados(
    <RelatoriosPage aoVerHistorico={aoVerHistorico} limite={limite} />,
    ambiente.dados,
  );
}

describe("RelatoriosPage", () => {
  it("gera por período mesmo com De/Até invertidos", async () => {
    const usuario = userEvent.setup();
    renderizar();
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2025-12-31" } });
    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2025-12-01" } });
    await usuario.click(screen.getByRole("button", { name: /gerar relatório/i }));
    expect(await screen.findByText(/2 serviço\(s\)/)).toBeInTheDocument();
    expect(screen.getByText(/período de 01\/12\/2025 a 31\/12\/2025/i)).toBeInTheDocument();
    expect(screen.getByText("UNO MILLE")).toBeInTheDocument();
    expect(screen.queryByText("HB20")).not.toBeInTheDocument();
  });

  it("gera por carro filtrando só a coluna carro", async () => {
    const usuario = userEvent.setup();
    renderizar();
    await usuario.selectOptions(screen.getByRole("combobox"), "carro");
    await usuario.type(screen.getByLabelText(/descrição do carro/i), "HB20");
    await usuario.click(screen.getByRole("button", { name: /gerar relatório/i }));
    expect(await screen.findByText(/1 serviço\(s\)/)).toBeInTheDocument();
    expect(screen.getByText("HB20")).toBeInTheDocument();
  });

  it("gera por placa", async () => {
    const usuario = userEvent.setup();
    renderizar();
    await usuario.selectOptions(screen.getByRole("combobox"), "placa");
    await usuario.type(screen.getByLabelText("Placa"), "abc-1234");
    await usuario.click(screen.getByRole("button", { name: /gerar relatório/i }));
    expect(await screen.findByText(/placa: ABC-1234/i)).toBeInTheDocument();
    expect(screen.getByText("35S14")).toBeInTheDocument();
  });

  it("clicar na placa de uma linha do relatório abre o histórico", async () => {
    const usuario = userEvent.setup();
    renderizar();
    await usuario.selectOptions(screen.getByRole("combobox"), "placa");
    await usuario.type(screen.getByLabelText("Placa"), "ABC1234");
    await usuario.click(screen.getByRole("button", { name: /gerar relatório/i }));
    await usuario.click(await screen.findByRole("button", { name: "ABC1234" }));
    expect(aoVerHistorico).toHaveBeenCalledWith("ABC1234");
  });

  // Limite injetado: o comportamento de truncagem é o mesmo com 1 ou com 5.000, e
  // renderizar 5.000 linhas no jsdom deixava o teste na beira do timeout (flaky).
  it("acima do limite avisa que o relatório está truncado", async () => {
    const usuario = userEvent.setup();
    renderizar(1);
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2025-12-01" } });
    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2025-12-31" } });
    await usuario.click(screen.getByRole("button", { name: /gerar relatório/i }));
    expect(await screen.findByText(/2 serviço\(s\)/)).toBeInTheDocument();
    expect(screen.getByText(/mostrando os primeiros 1/i)).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(2); // cabeçalho + 1 linha
  });

  it("sem filtro preenchido o botão fica travado em vez de não fazer nada", async () => {
    const usuario = userEvent.setup();
    renderizar();
    await usuario.selectOptions(screen.getByRole("combobox"), "placa");

    const gerar = screen.getByRole("button", { name: /gerar relatório/i });
    expect(gerar).toBeDisabled();

    await usuario.type(screen.getByLabelText("Placa"), "ABC1234");
    expect(gerar).toBeEnabled();
  });

  it("falha ao gerar mostra a mensagem de erro na tela", async () => {
    vi.spyOn(ambiente.repositorio, "buscar").mockRejectedValue(new Error("banco travado"));
    const usuario = userEvent.setup();
    renderizar();
    await usuario.click(screen.getByRole("button", { name: /gerar relatório/i }));
    expect(await screen.findByText(/não foi possível gerar o relatório/i)).toBeInTheDocument();
  });

  it("mexer no filtro depois de gerar limpa o relatório da tela", async () => {
    const usuario = userEvent.setup();
    renderizar();
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2025-12-01" } });
    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2025-12-31" } });
    await usuario.click(screen.getByRole("button", { name: /gerar relatório/i }));
    expect(await screen.findByText("UNO MILLE")).toBeInTheDocument();

    // senão dá para imprimir cabeçalho de um filtro com as linhas de outro
    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2026-01-31" } });
    expect(screen.queryByText("UNO MILLE")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /imprimir/i })).not.toBeInTheDocument();
  });

  it("dentro do limite não mostra aviso de truncagem", async () => {
    const usuario = userEvent.setup();
    renderizar();
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2025-12-01" } });
    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2025-12-31" } });
    await usuario.click(screen.getByRole("button", { name: /gerar relatório/i }));
    expect(await screen.findByText(/2 serviço\(s\)/)).toBeInTheDocument();
    expect(screen.queryByText(/mostrando os primeiros/i)).not.toBeInTheDocument();
  });
});
