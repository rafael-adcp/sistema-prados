// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ask } from "@tauri-apps/plugin-dialog";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  criarAmbienteDeTeste,
  renderizarComDados,
  servicoImportado,
  type AmbienteDeTeste,
} from "../../testes/renderComDados";
import { ConsultasPage } from "./ConsultasPage";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: vi.fn(async () => true),
  open: vi.fn(),
}));

let ambiente: AmbienteDeTeste;
const aoVerHistorico = vi.fn();

beforeEach(async () => {
  ambiente = criarAmbienteDeTeste();
  await ambiente.repositorio.substituirTodosPor([
    servicoImportado({ id: 1, placa: "ABC1234", carro: "35S14", produto: "4 HAV", data: "2024-04-08" }),
    servicoImportado({ id: 2, placa: "GOL1234", carro: "UNO MILLE", produto: "PSL560", data: "2025-12-24" }),
    servicoImportado({ id: 3, placa: "BBB2222", carro: "HB20", produto: "3 HX8", data: "2025-06-01" }),
  ]);
});

afterEach(() => ambiente.banco.fechar());

function renderizar() {
  return renderizarComDados(<ConsultasPage ativa aoVerHistorico={aoVerHistorico} />, ambiente.dados);
}

describe("busca", () => {
  it("abre mostrando os mais recentes com a contagem", async () => {
    renderizar();
    expect(await screen.findByText(/3 serviço\(s\)/)).toBeInTheDocument();
    expect(screen.getByText("UNO MILLE")).toBeInTheDocument();
  });

  it("busca por placa usa o índice e filtra", async () => {
    const usuario = userEvent.setup();
    renderizar();
    await usuario.type(screen.getByRole("searchbox"), "ABC1234");
    expect(await screen.findByText(/buscando por placa/i)).toBeInTheDocument();
    expect(await screen.findByText("35S14")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("HB20")).not.toBeInTheDocument());
  });

  it("código de produto com cara de placa cai no fallback de texto", async () => {
    const usuario = userEvent.setup();
    renderizar();
    await usuario.type(screen.getByRole("searchbox"), "PSL560");
    expect(await screen.findByText(/buscando em carro, produto e placa/i)).toBeInTheDocument();
    expect(screen.getByText("UNO MILLE")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("HB20")).not.toBeInTheDocument());
  });

  it("mês digitado na caixa vira busca por período", async () => {
    const usuario = userEvent.setup();
    renderizar();
    await usuario.type(screen.getByRole("searchbox"), "12/2025");
    expect(await screen.findByText(/buscando por período/i)).toBeInTheDocument();
    expect(await screen.findByText("UNO MILLE")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("35S14")).not.toBeInTheDocument());
  });

  it("falha na busca mostra a mensagem de erro", async () => {
    vi.spyOn(ambiente.repositorio, "buscar").mockRejectedValue(new Error("banco fechado"));
    const erroDeConsole = vi.spyOn(console, "error").mockImplementation(() => {});
    renderizar();
    expect(await screen.findByText(/não foi possível buscar/i)).toBeInTheDocument();
    erroDeConsole.mockRestore();
  });

  it("clicar na placa abre o histórico", async () => {
    const usuario = userEvent.setup();
    renderizar();
    await usuario.click(await screen.findByRole("button", { name: "ABC1234" }));
    expect(aoVerHistorico).toHaveBeenCalledWith("ABC1234");
  });

  it("pagina os resultados sem esperar debounce", async () => {
    const muitos = Array.from({ length: 60 }, (_, i) =>
      servicoImportado({ id: 100 + i, placa: `PAG${String(i).padStart(4, "0")}` }),
    );
    await ambiente.repositorio.substituirTodosPor(muitos);
    const usuario = userEvent.setup();
    renderizar();
    expect(await screen.findByText(/página 1 de 2/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /anterior/i })).toBeDisabled();

    await usuario.click(screen.getByRole("button", { name: /próxima/i }));
    expect(await screen.findByText(/página 2 de 2/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /próxima/i })).toBeDisabled();
    expect(await screen.findByText("PAG0009")).toBeInTheDocument();
  });
});

describe("edição pela linha", () => {
  it("clicar na linha abre o diálogo, salvar atualiza banco e lista", async () => {
    const usuario = userEvent.setup();
    renderizar();
    await usuario.click(await screen.findByText("HB20"));

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveTextContent(/editar serviço nº 3/i);

    const campoProduto = screen.getAllByDisplayValue("3 HX8")[0];
    await usuario.clear(campoProduto);
    await usuario.type(campoProduto, "5 HX8 NOVO");
    await usuario.click(screen.getByRole("button", { name: /salvar alterações/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("5 HX8 NOVO")).toBeInTheDocument();
    const [editado] = await ambiente.repositorio.historico("BBB2222");
    expect(editado.produto).toBe("5 HX8 NOVO");
  });

  it("validação aponta o campo dentro do diálogo", async () => {
    const usuario = userEvent.setup();
    renderizar();
    await usuario.click(await screen.findByText("HB20"));
    const campoProduto = screen.getAllByDisplayValue("3 HX8")[0];
    await usuario.clear(campoProduto);
    await usuario.click(screen.getByRole("button", { name: /salvar alterações/i }));
    expect(await screen.findByText(/informe o produto/i)).toBeInTheDocument();
  });

  it("Cancelar e clique no fundo fecham sem alterar nada", async () => {
    const usuario = userEvent.setup();
    const { container } = renderizar();

    await usuario.click(await screen.findByText("HB20"));
    const campoProduto = screen.getAllByDisplayValue("3 HX8")[0];
    await usuario.clear(campoProduto);
    await usuario.type(campoProduto, "OUTRO PRODUTO");
    await usuario.click(screen.getByRole("button", { name: /cancelar/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await usuario.click(await screen.findByText("HB20"));
    fireEvent.mouseDown(container.querySelector(".fundo-modal") as HTMLElement);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const [intocado] = await ambiente.repositorio.historico("BBB2222");
    expect(intocado.produto).toBe("3 HX8");
  });

  // Selecionar texto no campo arrastando e soltar fora do diálogo emitia um click
  // no fundo — o diálogo fechava e a edição inteira era perdida.
  it("arrastar a seleção para fora do diálogo não fecha nem perde a edição", async () => {
    const usuario = userEvent.setup();
    const { container } = renderizar();
    await usuario.click(await screen.findByText("HB20"));

    const campoProduto = screen.getAllByDisplayValue("3 HX8")[0];
    await usuario.clear(campoProduto);
    await usuario.type(campoProduto, "EDICAO EM ANDAMENTO");

    // o mouseDown nasce dentro do campo; só o click chega ao fundo
    fireEvent.mouseDown(campoProduto);
    fireEvent.click(container.querySelector(".fundo-modal") as HTMLElement);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByDisplayValue("EDICAO EM ANDAMENTO")).toBeInTheDocument();
  });

  it("Escape fecha o diálogo sem alterar o registro", async () => {
    const usuario = userEvent.setup();
    renderizar();
    await usuario.click(await screen.findByText("HB20"));

    const campoProduto = screen.getAllByDisplayValue("3 HX8")[0];
    await usuario.clear(campoProduto);
    await usuario.type(campoProduto, "NAO DEVE SALVAR");
    await usuario.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const [intocado] = await ambiente.repositorio.historico("BBB2222");
    expect(intocado.produto).toBe("3 HX8");
  });

  it("dá para chegar à edição pelo teclado, sem mouse", async () => {
    const usuario = userEvent.setup();
    renderizar();
    await screen.findByText("HB20");

    await usuario.click(screen.getByLabelText("Editar serviço nº 3"));

    expect(await screen.findByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("excluir desistindo na confirmação não remove nada", async () => {
    vi.mocked(ask).mockResolvedValueOnce(false);
    const usuario = userEvent.setup();
    renderizar();
    await usuario.click(await screen.findByText("HB20"));
    await usuario.click(await screen.findByRole("button", { name: /excluir/i }));

    await waitFor(() => expect(ask).toHaveBeenCalled());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(await ambiente.repositorio.contarServicos()).toBe(3);
  });

  // Se o diálogo fechasse ao falhar, a correção seria dada como feita e perdida.
  it("falha ao salvar mantém o diálogo aberto, mostra o erro e não altera o banco", async () => {
    vi.spyOn(ambiente.repositorio, "atualizar").mockRejectedValue(new Error("banco travado"));
    const usuario = userEvent.setup();
    renderizar();
    await usuario.click(await screen.findByText("HB20"));

    const campoProduto = screen.getAllByDisplayValue("3 HX8")[0];
    await usuario.clear(campoProduto);
    await usuario.type(campoProduto, "5 HX8 NOVO");
    await usuario.click(screen.getByRole("button", { name: /salvar alterações/i }));

    expect(await screen.findByText(/não foi possível salvar.*banco travado/i)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByDisplayValue("5 HX8 NOVO")).toBeInTheDocument(); // digitação preservada
    const [intocado] = await ambiente.repositorio.historico("BBB2222");
    expect(intocado.produto).toBe("3 HX8");
  });

  it("falha ao excluir mantém o diálogo aberto, mostra o erro e não remove nada", async () => {
    vi.spyOn(ambiente.repositorio, "excluir").mockRejectedValue(new Error("banco travado"));
    const usuario = userEvent.setup();
    renderizar();
    await usuario.click(await screen.findByText("HB20"));
    await usuario.click(await screen.findByRole("button", { name: /excluir/i }));

    expect(await screen.findByText(/não foi possível excluir.*banco travado/i)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(await ambiente.repositorio.contarServicos()).toBe(3);
  });

  it("corrigir só o km de um registro legado sem data salva sem exigir data", async () => {
    await ambiente.repositorio.substituirTodosPor([
      servicoImportado({ id: 9, placa: "LEG0001", carro: "OPALA", data: null, kmRaw: "" }),
    ]);
    const usuario = userEvent.setup();
    renderizar();
    await usuario.click(await screen.findByText("OPALA"));

    const dialogo = await screen.findByRole("dialog");
    await usuario.type(within(dialogo).getByLabelText("Km"), "88000");
    await usuario.click(screen.getByRole("button", { name: /salvar alterações/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const [legado] = await ambiente.repositorio.historico("LEG0001");
    expect(legado.km).toBe(88000);
    expect(legado.data).toBeNull(); // continua sem data, como o Access entregou
  });

  it("excluir com confirmação remove o registro da lista e do banco", async () => {
    const usuario = userEvent.setup();
    renderizar();
    await usuario.click(await screen.findByText("HB20"));
    await usuario.click(await screen.findByRole("button", { name: /excluir/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText("HB20")).not.toBeInTheDocument());
    expect(await ambiente.repositorio.contarServicos()).toBe(2);
  });
});
