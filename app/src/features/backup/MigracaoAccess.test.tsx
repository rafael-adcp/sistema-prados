// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ImportacaoService, ProgressoDaImportacao } from "../../data/importacaoService";
import {
  criarAmbienteDeTeste,
  renderizarComDados,
  type AmbienteDeTeste,
} from "../../testes/renderComDados";
import { MigracaoAccess } from "./MigracaoAccess";

const dialogo = vi.hoisted(() => ({
  ask: vi.fn(async () => true),
  open: vi.fn(async () => "C:\\dados\\Sistema Prado.mdb"),
}));
vi.mock("@tauri-apps/plugin-dialog", () => dialogo);

let ambiente: AmbienteDeTeste;
const aoConcluir = vi.fn();
const aoFalhar = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  ambiente = criarAmbienteDeTeste();
});

afterEach(() => ambiente.banco.fechar());

function renderizarComImportacao(importarDoAccess: ImportacaoService["importarDoAccess"]) {
  ambiente.dados.importacao = { importarDoAccess } as unknown as ImportacaoService;
  return renderizarComDados(
    <MigracaoAccess aoConcluir={aoConcluir} aoFalhar={aoFalhar} />,
    ambiente.dados,
  );
}

describe("MigracaoAccess", () => {
  it("migra mostrando progresso e entrega o resumo", async () => {
    let liberar = () => {};
    const importar = vi.fn(
      async (_caminho: string, aoProgredir: (p: ProgressoDaImportacao) => void) => {
        aoProgredir({ etapa: "importando", feitos: 500, total: 1000 });
        await new Promise<void>((resolve) => {
          liberar = resolve;
        });
        return { servicos: new Array(1000), semData: 3, semPlaca: 2, datasSuspeitas: 1 };
      },
    );
    const usuario = userEvent.setup();
    renderizarComImportacao(importar);

    await usuario.click(screen.getByRole("button", { name: /migrar do sistema antigo/i }));
    expect(await screen.findByText(/importando 500 de 1\.000/i)).toBeInTheDocument();

    liberar();
    await waitFor(() =>
      expect(aoConcluir).toHaveBeenCalledWith(expect.stringMatching(/1\.000 serviços importados/)),
    );
    expect(importar).toHaveBeenCalledWith("C:\\dados\\Sistema Prado.mdb", expect.any(Function));
    expect(screen.getByRole("button", { name: /migrar do sistema antigo/i })).toBeEnabled();
  });

  it("cancelar no aviso não migra nada", async () => {
    dialogo.ask.mockResolvedValueOnce(false);
    const importar = vi.fn();
    const usuario = userEvent.setup();
    renderizarComImportacao(importar as unknown as ImportacaoService["importarDoAccess"]);
    await usuario.click(screen.getByRole("button", { name: /migrar do sistema antigo/i }));
    await waitFor(() => expect(dialogo.ask).toHaveBeenCalled());
    expect(importar).not.toHaveBeenCalled();
  });

  it("falha (ex.: máquina sem leitor do Access) vai para aoFalhar", async () => {
    const importar = vi.fn(async () => {
      throw new Error("Nenhum provider OLEDB disponivel");
    });
    const usuario = userEvent.setup();
    renderizarComImportacao(importar);
    await usuario.click(screen.getByRole("button", { name: /migrar do sistema antigo/i }));
    await waitFor(() =>
      expect(aoFalhar).toHaveBeenCalledWith(expect.stringMatching(/OLEDB/)),
    );
  });
});
