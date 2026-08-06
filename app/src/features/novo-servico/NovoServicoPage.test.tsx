// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  criarAmbienteDeTeste,
  renderizarComDados,
  servicoImportado,
  type AmbienteDeTeste,
} from "../../testes/renderComDados";
import { NovoServicoPage } from "./NovoServicoPage";

let ambiente: AmbienteDeTeste;
const aoVerHistorico = vi.fn();

beforeEach(() => {
  ambiente = criarAmbienteDeTeste();
});

afterEach(() => ambiente.banco.fechar());

function renderizar() {
  return renderizarComDados(<NovoServicoPage aoVerHistorico={aoVerHistorico} />, ambiente.dados);
}

describe("validação com destaque no campo", () => {
  it("aponta produto e placa nos próprios campos ao salvar vazio", async () => {
    const usuario = userEvent.setup();
    renderizar();
    await usuario.click(screen.getByRole("button", { name: /salvar serviço/i }));
    expect(screen.getByText(/informe o produto/i)).toBeInTheDocument();
    expect(screen.getByText(/informe a placa/i)).toBeInTheDocument();
    expect(await ambiente.repositorio.contarServicos()).toBe(0);
  });
});

describe("aviso de salvo", () => {
  it("fecha na hora pelo ✕", async () => {
    const usuario = userEvent.setup();
    renderizar();
    await usuario.type(screen.getByPlaceholderText(/ABC1234/i), "AAA0001");
    await usuario.type(screen.getByPlaceholderText(/HAV 5W30/i), "3 SL");
    await usuario.click(screen.getByRole("button", { name: /salvar serviço/i }));
    expect(await screen.findByText(/salvo/i)).toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: /fechar aviso/i }));
    expect(screen.queryByText(/salvo/i)).not.toBeInTheDocument();
  });

  // fireEvent (síncrono) em vez de userEvent: os delays internos do userEvent
  // travam sob timers falsos. O afterEach garante os timers reais de volta
  // mesmo se o teste estourar o tempo.
  it("some sozinho depois de um tempo", async () => {
    vi.useFakeTimers();
    renderizar();
    fireEvent.change(screen.getByPlaceholderText(/ABC1234/i), { target: { value: "AAA0002" } });
    fireEvent.change(screen.getByPlaceholderText(/HAV 5W30/i), { target: { value: "3 SL" } });
    fireEvent.click(screen.getByRole("button", { name: /salvar serviço/i }));
    await act(async () => {});
    expect(screen.getByText(/salvo/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    await act(async () => {});
    expect(screen.queryByText(/salvo/i)).not.toBeInTheDocument();
  });

  afterEach(() => vi.useRealTimers());
});

describe("fluxo do balcão", () => {
  it("Limpar campos zera o formulário e devolve o foco à placa", async () => {
    await ambiente.repositorio.substituirTodosPor([
      servicoImportado({ id: 1, placa: "ABC1234", carro: "35S14", data: "2024-04-08" }),
    ]);
    const usuario = userEvent.setup();
    renderizar();

    const limpar = screen.getByRole("button", { name: /limpar campos/i });
    expect(limpar).toBeDisabled();

    await usuario.type(screen.getByPlaceholderText(/ABC1234/i), "ABC1234");
    expect(await screen.findByText(/última troca desta placa/i)).toBeInTheDocument();
    await usuario.type(screen.getByPlaceholderText(/123456/), "125000");
    expect(limpar).toBeEnabled();

    await usuario.click(limpar);
    expect(screen.getByPlaceholderText(/ABC1234/i)).toHaveValue("");
    expect(screen.getByPlaceholderText(/GOL 1.0 16V/i)).toHaveValue("");
    expect(screen.getByPlaceholderText(/123456/)).toHaveValue("");
    await waitFor(() =>
      expect(screen.queryByText(/última troca desta placa/i)).not.toBeInTheDocument(),
    );
    expect(screen.getByPlaceholderText(/ABC1234/i)).toHaveFocus();
    expect(limpar).toBeDisabled();
  });

  it("autocomplete de placa preenche o carro, mostra a última troca e salva", async () => {
    await ambiente.repositorio.substituirTodosPor([
      servicoImportado({ id: 1, placa: "ABC1234", carro: "35S14", produto: "4 HAV", data: "2024-04-08" }),
    ]);
    const usuario = userEvent.setup();
    renderizar();

    await usuario.type(screen.getByPlaceholderText(/ABC1234/i), "ABC12");
    await usuario.click(await screen.findByRole("button", { name: /ABC1234/ }));

    expect(screen.getByPlaceholderText(/GOL 1.0 16V/i)).toHaveValue("35S14");
    expect(await screen.findByText(/última troca desta placa/i)).toBeInTheDocument();
    expect(screen.getByText("4 HAV")).toBeInTheDocument();

    await usuario.type(screen.getByPlaceholderText(/123456/), "125000");
    await usuario.type(screen.getByPlaceholderText(/HAV 5W30/i), "4 HAV 0W20");
    await usuario.click(screen.getByRole("button", { name: /salvar serviço/i }));

    expect(await screen.findByText(/serviço nº 2 salvo/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ABC1234/i)).toHaveValue("");
    const [ultimo] = await ambiente.repositorio.historico("ABC1234");
    expect(ultimo.produto).toBe("4 HAV 0W20");
    expect(ultimo.km).toBe(125000);
  });

  it("botão de histórico do cartão navega com a placa", async () => {
    await ambiente.repositorio.substituirTodosPor([
      servicoImportado({ id: 1, placa: "ABC1234", carro: "35S14" }),
    ]);
    const usuario = userEvent.setup();
    renderizar();
    await usuario.type(screen.getByPlaceholderText(/ABC1234/i), "ABC1234");
    await usuario.click(await screen.findByRole("button", { name: /ver histórico completo/i }));
    expect(aoVerHistorico).toHaveBeenCalledWith("ABC1234");
  });

  it("duplo clique no salvar grava só um serviço", async () => {
    const usuario = userEvent.setup();
    renderizar();
    await usuario.type(screen.getByPlaceholderText(/ABC1234/i), "BBB2222");
    await usuario.type(screen.getByPlaceholderText(/HAV 5W30/i), "3 SL");
    await usuario.dblClick(screen.getByRole("button", { name: /salvar serviço/i }));
    await screen.findByText(/salvo/i);
    await waitFor(async () => {
      expect(await ambiente.repositorio.contarServicos()).toBe(1);
    });
  });
});
