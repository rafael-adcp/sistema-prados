// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  criarAmbienteDeTeste,
  renderizarComDados,
  servicoImportado,
  type AmbienteDeTeste,
} from "../../testes/renderComDados";
import { HistoricoPage } from "./HistoricoPage";

vi.mock("@tauri-apps/plugin-dialog", () => ({ ask: vi.fn(async () => true) }));

let ambiente: AmbienteDeTeste;
const aoVoltar = vi.fn();

beforeEach(async () => {
  ambiente = criarAmbienteDeTeste();
  await ambiente.repositorio.substituirTodosPor([
    servicoImportado({ id: 1, placa: "ABC1234", carro: "", data: "2019-07-19", produto: "3 SL" }),
    servicoImportado({ id: 2, placa: "ABC1234", carro: "35S14", data: "2024-04-08", produto: "4 HAV" }),
    servicoImportado({ id: 3, placa: "ABC1234", carro: "35S14", data: "1982-10-10", dataSuspeita: true }),
  ]);
});

afterEach(() => ambiente.banco.fechar());

describe("HistoricoPage", () => {
  it("mostra resumo (visitas, cliente desde ignorando data suspeita) e todas as linhas", async () => {
    renderizarComDados(<HistoricoPage placa="ABC1234" aoVoltar={aoVoltar} />, ambiente.dados);
    expect(await screen.findByText(/histórico do veículo ABC1234/i)).toBeInTheDocument();
    expect(screen.getByText(/3 visitas/)).toBeInTheDocument();
    expect(screen.getByText(/cliente desde 19\/07\/2019/)).toBeInTheDocument();
    expect(screen.getByText("4 HAV")).toBeInTheDocument();
    expect(screen.getByTitle(/digitada errada/i)).toBeInTheDocument();
  });

  it("falha ao carregar mostra o erro e o Voltar continua funcionando", async () => {
    vi.spyOn(ambiente.repositorio, "historico").mockRejectedValueOnce(new Error("banco fechado"));
    const erroDeConsole = vi.spyOn(console, "error").mockImplementation(() => {});
    const usuario = userEvent.setup();
    renderizarComDados(<HistoricoPage placa="ABC1234" aoVoltar={aoVoltar} />, ambiente.dados);

    expect(await screen.findByText(/não foi possível carregar o histórico/i)).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: /voltar/i }));
    expect(aoVoltar).toHaveBeenCalled();
    erroDeConsole.mockRestore();
  });

  it("voltar chama o callback e a linha abre edição", async () => {
    const usuario = userEvent.setup();
    renderizarComDados(<HistoricoPage placa="ABC1234" aoVoltar={aoVoltar} />, ambiente.dados);
    await usuario.click(await screen.findByRole("button", { name: /voltar/i }));
    expect(aoVoltar).toHaveBeenCalled();
    await usuario.click(screen.getByText("4 HAV"));
    expect(await screen.findByRole("dialog")).toHaveTextContent(/editar serviço nº 2/i);
  });
});
