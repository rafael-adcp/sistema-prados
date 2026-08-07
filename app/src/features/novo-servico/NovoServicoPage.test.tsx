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
    expect(await screen.findByText(/última troca de/i)).toBeInTheDocument();
    await usuario.type(screen.getByPlaceholderText(/123456/), "125000");
    expect(limpar).toBeEnabled();

    await usuario.click(limpar);
    expect(screen.getByPlaceholderText(/ABC1234/i)).toHaveValue("");
    expect(screen.getByPlaceholderText(/GOL 1.0 16V/i)).toHaveValue("");
    expect(screen.getByPlaceholderText(/123456/)).toHaveValue("");
    await waitFor(() =>
      expect(screen.queryByText(/última troca de/i)).not.toBeInTheDocument(),
    );
    expect(screen.getByPlaceholderText(/ABC1234/i)).toHaveFocus();
    expect(limpar).toBeDisabled();
  });

  // A loja deixa o app aberto direto; antes, o primeiro serviço de cada manhã ia
  // para o banco com a data de ontem — plausível o bastante para ninguém notar.
  it("app aberto durante a virada do dia grava o serviço com a data de hoje", async () => {
    vi.setSystemTime(new Date(2026, 7, 10, 18, 0));
    const usuario = userEvent.setup();
    renderizar();
    expect(screen.getByLabelText("Data")).toHaveValue("2026-08-10");

    vi.setSystemTime(new Date(2026, 7, 11, 8, 0)); // vira o dia com o app aberto
    await usuario.type(screen.getByPlaceholderText(/ABC1234/i), "AAA0001");
    await usuario.type(screen.getByPlaceholderText(/HAV 5W30/i), "3 SL");
    await usuario.click(screen.getByRole("button", { name: /salvar serviço/i }));

    await waitFor(async () => expect(await ambiente.repositorio.contarServicos()).toBe(1));
    const [gravado] = await ambiente.repositorio.historico("AAA0001");
    expect(gravado.data).toBe("2026-08-11");
  });

  it("data escolhida à mão é respeitada e não vira hoje", async () => {
    vi.setSystemTime(new Date(2026, 7, 11, 8, 0));
    const usuario = userEvent.setup();
    renderizar();

    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-08-03" } });
    await usuario.type(screen.getByPlaceholderText(/ABC1234/i), "AAA0002");
    await usuario.type(screen.getByPlaceholderText(/HAV 5W30/i), "3 SL");
    await usuario.click(screen.getByRole("button", { name: /salvar serviço/i }));

    await waitFor(async () => expect(await ambiente.repositorio.contarServicos()).toBe(1));
    const [gravado] = await ambiente.repositorio.historico("AAA0002");
    expect(gravado.data).toBe("2026-08-03");
  });

  // Se os campos fossem limpos aqui, o serviço seria perdido em silêncio: a pessoa
  // vê o formulário vazio, entende que gravou, e o registro não existe.
  it("falha ao salvar mostra o erro e preserva tudo o que foi digitado", async () => {
    vi.spyOn(ambiente.repositorio, "inserir").mockRejectedValue(new Error("disco cheio"));
    const usuario = userEvent.setup();
    renderizar();

    await usuario.type(screen.getByPlaceholderText(/ABC1234/i), "AAA0001");
    await usuario.type(screen.getByPlaceholderText(/GOL 1.0 16V/i), "GOL 1.0");
    await usuario.type(screen.getByPlaceholderText(/HAV 5W30/i), "3 SL");
    await usuario.click(screen.getByRole("button", { name: /salvar serviço/i }));

    expect(await screen.findByText(/não foi possível salvar.*disco cheio/i)).toBeInTheDocument();
    expect(screen.queryByText(/✓ Serviço nº/)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ABC1234/i)).toHaveValue("AAA0001");
    expect(screen.getByPlaceholderText(/GOL 1.0 16V/i)).toHaveValue("GOL 1.0");
    expect(screen.getByPlaceholderText(/HAV 5W30/i)).toHaveValue("3 SL");
    // e dá para tentar de novo
    expect(screen.getByRole("button", { name: /salvar serviço/i })).toBeEnabled();
  });

  it("escolhe a placa pelo teclado: seta para baixo destaca, Enter seleciona", async () => {
    await ambiente.repositorio.substituirTodosPor([
      servicoImportado({ id: 1, placa: "ABC1234", carro: "35S14", data: "2024-04-08" }),
      servicoImportado({ id: 2, placa: "ABC1235", carro: "UNO MILLE", data: "2024-05-09" }),
    ]);
    const usuario = userEvent.setup();
    renderizar();
    const campoPlaca = screen.getByPlaceholderText(/ABC1234/i);

    await usuario.type(campoPlaca, "ABC12");
    expect(await screen.findByRole("option", { name: /ABC1234/ })).toBeInTheDocument();

    // a lista vem da visita mais recente para a mais antiga: ABC1235, depois ABC1234
    await usuario.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: /ABC1235/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await usuario.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: /ABC1234/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await usuario.keyboard("{Enter}");
    expect(campoPlaca).toHaveValue("ABC1234");
    expect(screen.getByPlaceholderText(/GOL 1.0 16V/i)).toHaveValue("35S14");
    // Enter que seleciona a placa não pode salvar o serviço junto
    expect(await ambiente.repositorio.contarServicos()).toBe(2);
    expect(screen.queryByText(/salvo/i)).not.toBeInTheDocument();
  });

  it("Escape fecha a lista de sugestões sem apagar o que foi digitado", async () => {
    await ambiente.repositorio.substituirTodosPor([
      servicoImportado({ id: 1, placa: "ABC1234", carro: "35S14", data: "2024-04-08" }),
    ]);
    const usuario = userEvent.setup();
    renderizar();
    const campoPlaca = screen.getByPlaceholderText(/ABC1234/i);

    await usuario.type(campoPlaca, "ABC12");
    expect(await screen.findByRole("option", { name: /ABC1234/ })).toBeInTheDocument();

    await usuario.keyboard("{Escape}");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(campoPlaca).toHaveValue("ABC12");
  });

  it("corrigir a placa digitada troca o carro autopreenchido pelo do veículo certo", async () => {
    await ambiente.repositorio.substituirTodosPor([
      servicoImportado({ id: 1, placa: "ABC1234", carro: "GOL 1.0", data: "2024-04-08" }),
      servicoImportado({ id: 2, placa: "ABC1235", carro: "UNO MILLE", data: "2024-05-09" }),
    ]);
    const usuario = userEvent.setup();
    renderizar();
    const campoPlaca = screen.getByPlaceholderText(/ABC1234/i);
    const campoCarro = screen.getByPlaceholderText(/GOL 1.0 16V/i);

    await usuario.type(campoPlaca, "ABC1234");
    await waitFor(() => expect(campoCarro).toHaveValue("GOL 1.0"));

    // erro de digitação percebido: corrige o último dígito
    await usuario.type(campoPlaca, "{backspace}5");
    await waitFor(() => expect(campoCarro).toHaveValue("UNO MILLE"));
    expect(await screen.findByText("ABC1235")).toBeInTheDocument();
  });

  it("carro digitado à mão não é sobrescrito pelo autopreenchimento", async () => {
    await ambiente.repositorio.substituirTodosPor([
      servicoImportado({ id: 1, placa: "ABC1234", carro: "GOL 1.0", data: "2024-04-08" }),
    ]);
    const usuario = userEvent.setup();
    renderizar();

    await usuario.type(screen.getByPlaceholderText(/GOL 1.0 16V/i), "PALIO WEEKEND");
    await usuario.type(screen.getByPlaceholderText(/ABC1234/i), "ABC1234");
    expect(await screen.findByText(/última troca de/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/GOL 1.0 16V/i)).toHaveValue("PALIO WEEKEND");
  });

  // A consulta da 2ª placa fica pendurada de propósito: é exatamente a janela em que
  // o cartão exibia "Última troca desta placa" com os dados da placa ANTERIOR.
  it("o cartão não mostra a última troca da placa anterior enquanto a nova carrega", async () => {
    await ambiente.repositorio.substituirTodosPor([
      servicoImportado({ id: 1, placa: "ABC1234", carro: "GOL 1.0", data: "2024-04-08" }),
      servicoImportado({ id: 2, placa: "ABC1235", carro: "UNO MILLE", data: "2024-05-09" }),
    ]);
    const usuario = userEvent.setup();
    renderizar();
    const campoPlaca = screen.getByPlaceholderText(/ABC1234/i);

    await usuario.type(campoPlaca, "ABC1234");
    expect(await screen.findByText("GOL 1.0")).toBeInTheDocument();

    vi.spyOn(ambiente.repositorio, "ultimaTroca").mockReturnValue(new Promise(() => {}));
    await usuario.type(campoPlaca, "{backspace}5");

    await waitFor(() => expect(campoPlaca).toHaveValue("ABC1235"));
    expect(screen.queryByText(/última troca de/i)).not.toBeInTheDocument();
  });

  it("autocomplete de placa preenche o carro, mostra a última troca e salva", async () => {
    await ambiente.repositorio.substituirTodosPor([
      servicoImportado({ id: 1, placa: "ABC1234", carro: "35S14", produto: "4 HAV", data: "2024-04-08" }),
    ]);
    const usuario = userEvent.setup();
    renderizar();

    await usuario.type(screen.getByPlaceholderText(/ABC1234/i), "ABC12");
    const opcao = await screen.findByRole("option", { name: /ABC1234/ });
    expect(opcao).toHaveTextContent("4 HAV");
    expect(opcao).toHaveTextContent("100.000 km");
    await usuario.click(opcao);

    expect(screen.getByPlaceholderText(/GOL 1.0 16V/i)).toHaveValue("35S14");
    expect(await screen.findByText(/última troca de/i)).toBeInTheDocument();
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

  it("Enter em qualquer campo salva o serviço", async () => {
    const usuario = userEvent.setup();
    renderizar();
    await usuario.type(screen.getByPlaceholderText(/ABC1234/i), "CCC3333");
    await usuario.type(screen.getByPlaceholderText(/HAV 5W30/i), "3 SL{enter}");
    expect(await screen.findByText(/salvo/i)).toBeInTheDocument();
    expect(await ambiente.repositorio.contarServicos()).toBe(1);
  });

  // A primeira barreira é o min/max do próprio campo: o navegador (e o jsdom)
  // nem deixa o submit disparar. A validação do domínio fica de reserva.
  it("data absurda trava o campo e nada é salvo", async () => {
    const usuario = userEvent.setup();
    renderizar();
    await usuario.type(screen.getByPlaceholderText(/ABC1234/i), "DDD4444");
    await usuario.type(screen.getByPlaceholderText(/HAV 5W30/i), "3 SL");
    const campoData = screen.getByLabelText("Data") as HTMLInputElement;
    fireEvent.change(campoData, { target: { value: "2107-06-15" } });
    await usuario.click(screen.getByRole("button", { name: /salvar serviço/i }));
    expect(campoData.validity.rangeOverflow).toBe(true);
    expect(screen.queryByText(/salvo/i)).not.toBeInTheDocument();
    expect(await ambiente.repositorio.contarServicos()).toBe(0);
  });

  it("sem data aponta o erro no próprio campo", async () => {
    const usuario = userEvent.setup();
    renderizar();
    await usuario.type(screen.getByPlaceholderText(/ABC1234/i), "DDD4444");
    await usuario.type(screen.getByPlaceholderText(/HAV 5W30/i), "3 SL");
    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "" } });
    await usuario.click(screen.getByRole("button", { name: /salvar serviço/i }));
    expect(await screen.findByText(/informe a data/i)).toBeInTheDocument();
    expect(await ambiente.repositorio.contarServicos()).toBe(0);
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
