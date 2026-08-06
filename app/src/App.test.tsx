// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { hojeIso } from "./domain/datas";
import {
  criarAmbienteDeTeste,
  renderizarComDados,
  servicoImportado,
  VERSAO_DE_TESTE,
  type AmbienteDeTeste,
} from "./testes/renderComDados";

vi.mock("@tauri-apps/plugin-dialog", () => ({ ask: vi.fn(async () => true), open: vi.fn() }));

// O billboard.js exige medidas de SVG que o jsdom não tem; a aba Análises testa o resto.
vi.mock("billboard.js", () => ({
  default: { generate: vi.fn(() => ({ destroy: vi.fn() })) },
  bar: vi.fn(() => "barra"),
  line: vi.fn(() => "linha"),
  grid: vi.fn(() => ({})),
  zoom: vi.fn(() => ({})),
}));

let ambiente: AmbienteDeTeste;

beforeEach(async () => {
  ambiente = criarAmbienteDeTeste();
  await ambiente.repositorio.substituirTodosPor([
    servicoImportado({ id: 1, placa: "ABC1234", carro: "35S14", data: "2024-04-08" }),
  ]);
});

afterEach(() => ambiente.banco.fechar());

// Sem isto na tela, uma atualização que falhou em silêncio é indistinguível de
// uma que deu certo — e dá para conferir por telefone.
describe("versão à vista", () => {
  it("mostra a versão em uso no cabeçalho", async () => {
    renderizarComDados(<App />, ambiente.dados);
    expect(await screen.findByText(`versão ${VERSAO_DE_TESTE}`)).toBeInTheDocument();
  });

  it("a abertura carimba desde quando esta versão está em uso", async () => {
    renderizarComDados(<App />, ambiente.dados);
    await screen.findByText(`versão ${VERSAO_DE_TESTE}`);

    const emUso = await ambiente.dados.versao.lerEmUso();
    expect(emUso.numero).toBe(VERSAO_DE_TESTE);
    expect(emUso.desde).toBe(hojeIso());
  });
});

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
    const contarBase = vi.spyOn(ambiente.dados.qualidade, "contarBase");
    renderizarComDados(<App />, ambiente.dados);
    expect(contarBase).not.toHaveBeenCalled();

    await usuario.click(screen.getByRole("button", { name: "Análises" }));
    expect(await screen.findByText("Números")).toBeInTheDocument();
    expect(screen.getByText("Qualidade dos dados")).toBeInTheDocument();
    expect(contarBase).toHaveBeenCalled();
  });

  it("histórico aberto do cartão de Novo Serviço volta para Novo Serviço", async () => {
    const usuario = userEvent.setup();
    renderizarComDados(<App />, ambiente.dados);

    await usuario.type(screen.getByPlaceholderText("Ex.: ABC1234"), "ABC1234");
    await usuario.click(await screen.findByRole("button", { name: /ver histórico completo/i }));
    expect(await screen.findByText(/histórico do veículo ABC1234/i)).toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: /voltar/i }));
    expect(await screen.findByRole("heading", { name: "Novo Serviço" })).toBeVisible();
    // a aba ficou montada: a placa digitada continua lá
    expect(screen.getByPlaceholderText("Ex.: ABC1234")).toHaveValue("ABC1234");
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

describe("fluxo completo do balcão", () => {
  it("serviço salvo em Novo Serviço aparece na aba Consultas", async () => {
    const usuario = userEvent.setup();
    renderizarComDados(<App />, ambiente.dados);

    await usuario.type(screen.getByPlaceholderText("Ex.: ABC1234"), "BBB2222");
    await usuario.type(screen.getByPlaceholderText("Ex.: GOL 1.0 16V"), "HB20");
    await usuario.type(screen.getByPlaceholderText("Ex.: 4 HAV 5W30 W6 MULTI"), "3 HX8");
    await usuario.click(screen.getByRole("button", { name: /salvar serviço/i }));
    expect(await screen.findByText(/salvo/i)).toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: "Consultas" }));
    expect(await screen.findByText("BBB2222")).toBeInTheDocument();
    expect(screen.getByText(/2 serviço\(s\)/)).toBeInTheDocument();
  });
});

describe("backup automático na abertura", () => {
  it("falha vira banner com aviso, e o ✕ fecha", async () => {
    const usuario = userEvent.setup();
    vi.spyOn(ambiente.dados.backup, "fazerBackupAutomaticoSePrecisar").mockRejectedValueOnce(
      new Error("pendrive removido"),
    );
    const erroDeConsole = vi.spyOn(console, "error").mockImplementation(() => {});
    renderizarComDados(<App />, ambiente.dados);

    expect(await screen.findByText(/backup automático falhou/i)).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "✕" }));
    expect(screen.queryByText(/backup automático falhou/i)).not.toBeInTheDocument();
    erroDeConsole.mockRestore();
  });
});
