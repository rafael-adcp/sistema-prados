// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import {
  criarAmbienteDeTeste,
  renderizarComDados,
  servicoImportado,
  type AmbienteDeTeste,
} from "./testes/renderComDados";

vi.mock("@tauri-apps/plugin-dialog", () => ({ ask: vi.fn(async () => true), open: vi.fn() }));

// O billboard.js exige medidas de SVG que o jsdom não tem; a aba Análises testa o resto.
vi.mock("billboard.js", () => ({
  default: { generate: vi.fn(() => ({ destroy: vi.fn() })) },
  bar: vi.fn(() => "barra"),
  line: vi.fn(() => "linha"),
}));

let ambiente: AmbienteDeTeste;

beforeEach(async () => {
  ambiente = criarAmbienteDeTeste();
  await ambiente.repositorio.substituirTodosPor([
    servicoImportado({ id: 1, placa: "ABC1234", carro: "35S14", data: "2024-04-08" }),
  ]);
});

afterEach(() => ambiente.banco.fechar());

describe("navegação sem perder estado", () => {
  it("a busca digitada em Consultas sobrevive à troca de abas", async () => {
    const usuario = userEvent.setup();
    renderizarComDados(<App />, ambiente.dados);

    await usuario.click(screen.getByRole("button", { name: "Consultas" }));
    await usuario.type(screen.getByRole("searchbox"), "ABC1234");
    expect(await screen.findByText(/buscando por placa/i)).toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: "Novo Serviço" }));
    await usuario.click(screen.getByRole("button", { name: "Consultas" }));
    expect(screen.getByRole("searchbox")).toHaveValue("ABC1234");
  });

  it("a aba Análises só calcula quando aberta e mostra as seções", async () => {
    const usuario = userEvent.setup();
    const contarBase = vi.spyOn(ambiente.dados.analises, "contarBase");
    renderizarComDados(<App />, ambiente.dados);
    expect(contarBase).not.toHaveBeenCalled();

    await usuario.click(screen.getByRole("button", { name: "Análises" }));
    expect(await screen.findByText("Números")).toBeInTheDocument();
    expect(screen.getByText("Qualidade dos dados")).toBeInTheDocument();
    expect(contarBase).toHaveBeenCalled();
  });

  it("histórico aberto de Consultas volta para Consultas", async () => {
    const usuario = userEvent.setup();
    renderizarComDados(<App />, ambiente.dados);

    await usuario.click(screen.getByRole("button", { name: "Consultas" }));
    await usuario.click(await screen.findByRole("button", { name: "ABC1234" }));
    expect(await screen.findByText(/histórico do veículo ABC1234/i)).toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: /voltar/i }));
    await waitFor(() =>
      expect(screen.queryByText(/histórico do veículo/i)).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("searchbox")).toBeVisible();
  });
});
