// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AvisoDeAtualizacao } from "./AvisoDeAtualizacao";

const procurarAtualizacao = vi.hoisted(() => vi.fn());
vi.mock("../../data/atualizacao", () => ({ procurarAtualizacao }));

beforeEach(() => vi.clearAllMocks());

describe("AvisoDeAtualizacao", () => {
  it("não mostra nada quando já está na versão mais nova", async () => {
    procurarAtualizacao.mockResolvedValue(null);
    render(<AvisoDeAtualizacao />);
    await waitFor(() => expect(procurarAtualizacao).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /atualizar agora/i })).not.toBeInTheDocument();
  });

  // A loja pode passar o dia sem internet. Falhar aqui não pode virar susto na tela.
  it("sem internet, falha em silêncio e não incomoda o usuário", async () => {
    const erroDeConsole = vi.spyOn(console, "error").mockImplementation(() => {});
    procurarAtualizacao.mockRejectedValue(new Error("network error"));

    const { container } = render(<AvisoDeAtualizacao />);

    await waitFor(() => expect(erroDeConsole).toHaveBeenCalled());
    expect(container.querySelector(".banner-aviso")).toBeNull();
    erroDeConsole.mockRestore();
  });

  it("com versão nova, só avisa — não instala sozinho", async () => {
    const baixarEInstalar = vi.fn(async () => {});
    const reiniciar = vi.fn(async () => {});
    procurarAtualizacao.mockResolvedValue({ versao: "2.1.0", baixarEInstalar, reiniciar });

    render(<AvisoDeAtualizacao />);

    expect(await screen.findByText(/versão 2\.1\.0 disponível/i)).toBeInTheDocument();
    expect(baixarEInstalar).not.toHaveBeenCalled(); // nada acontece sem o clique
    expect(reiniciar).not.toHaveBeenCalled();
  });

  it("clicar em Atualizar agora baixa, instala e reinicia", async () => {
    const baixarEInstalar = vi.fn(async () => {});
    const reiniciar = vi.fn(async () => {});
    procurarAtualizacao.mockResolvedValue({ versao: "2.1.0", baixarEInstalar, reiniciar });
    const usuario = userEvent.setup();
    render(<AvisoDeAtualizacao />);

    await usuario.click(await screen.findByRole("button", { name: /atualizar agora/i }));

    await waitFor(() => expect(baixarEInstalar).toHaveBeenCalled());
    await waitFor(() => expect(reiniciar).toHaveBeenCalled());
  });

  it("falha ao baixar mostra o erro e diz que o sistema continua funcionando", async () => {
    const erroDeConsole = vi.spyOn(console, "error").mockImplementation(() => {});
    procurarAtualizacao.mockResolvedValue({
      versao: "2.1.0",
      baixarEInstalar: vi.fn().mockRejectedValue(new Error("conexão caiu")),
      reiniciar: vi.fn(),
    });
    const usuario = userEvent.setup();
    render(<AvisoDeAtualizacao />);

    await usuario.click(await screen.findByRole("button", { name: /atualizar agora/i }));

    expect(await screen.findByText(/não foi possível atualizar.*conexão caiu/i)).toBeInTheDocument();
    expect(screen.getByText(/continua funcionando normalmente/i)).toBeInTheDocument();
    erroDeConsole.mockRestore();
  });

  it("dá para fechar o aviso no ✕", async () => {
    procurarAtualizacao.mockResolvedValue({
      versao: "2.1.0",
      baixarEInstalar: vi.fn(),
      reiniciar: vi.fn(),
    });
    const usuario = userEvent.setup();
    render(<AvisoDeAtualizacao />);

    await usuario.click(await screen.findByRole("button", { name: /fechar aviso/i }));
    expect(screen.queryByText(/versão 2\.1\.0 disponível/i)).not.toBeInTheDocument();
  });
});
