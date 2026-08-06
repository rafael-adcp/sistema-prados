// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BackupService } from "../../data/backupService";
import {
  criarAmbienteDeTeste,
  renderizarComDados,
  servicoImportado,
  type AmbienteDeTeste,
} from "../../testes/renderComDados";
import { BackupPage } from "./BackupPage";

const dialogo = vi.hoisted(() => ({
  ask: vi.fn(async () => true),
  open: vi.fn(async () => "D:\\backups"),
}));
vi.mock("@tauri-apps/plugin-dialog", () => dialogo);

const recarregarApp = vi.hoisted(() => vi.fn());
vi.mock("../../data/recarregarApp", () => ({ recarregarApp }));

let ambiente: AmbienteDeTeste;
let backup: {
  pastaConfigurada: ReturnType<typeof vi.fn>;
  ultimoBackupEm: ReturnType<typeof vi.fn>;
  definirPasta: ReturnType<typeof vi.fn>;
  executarBackup: ReturnType<typeof vi.fn>;
  importarBanco: ReturnType<typeof vi.fn>;
  fazerBackupAutomaticoSePrecisar: ReturnType<typeof vi.fn>;
};

beforeEach(async () => {
  vi.clearAllMocks();
  ambiente = criarAmbienteDeTeste();
  await ambiente.repositorio.substituirTodosPor([servicoImportado({ id: 1 })]);
  backup = {
    pastaConfigurada: vi.fn(async () => null),
    ultimoBackupEm: vi.fn(async () => null),
    definirPasta: vi.fn(async () => {}),
    executarBackup: vi.fn(async () => "D:\\backups\\prados-backup-x.db"),
    importarBanco: vi.fn(async () => {}),
    fazerBackupAutomaticoSePrecisar: vi.fn(async () => {}),
  };
  ambiente.dados.backup = backup as unknown as BackupService;
});

afterEach(() => ambiente.banco.fechar());

function renderizar() {
  return renderizarComDados(<BackupPage ativa />, ambiente.dados);
}

describe("BackupPage", () => {
  it("mostra a situação: contagem, pasta não configurada e botão de backup travado", async () => {
    renderizar();
    expect(await screen.findByText("1")).toBeInTheDocument();
    expect(screen.getByText(/não configurada/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fazer backup agora/i })).toBeDisabled();
  });

  it("escolher pasta grava a configuração e confirma", async () => {
    const usuario = userEvent.setup();
    renderizar();
    await usuario.click(await screen.findByRole("button", { name: /escolher pasta/i }));
    await waitFor(() => expect(backup.definirPasta).toHaveBeenCalledWith("D:\\backups"));
    expect(await screen.findByText(/pasta de backup definida/i)).toBeInTheDocument();
  });

  it("faz backup e mostra o caminho gerado", async () => {
    backup.pastaConfigurada.mockResolvedValue("D:\\backups");
    const usuario = userEvent.setup();
    renderizar();
    await usuario.click(await screen.findByRole("button", { name: /fazer backup agora/i }));
    expect(await screen.findByText(/backup criado/i)).toBeInTheDocument();
    expect(backup.executarBackup).toHaveBeenCalledWith("D:\\backups");
  });

  it("falha de backup aparece em vermelho, não em verde", async () => {
    backup.pastaConfigurada.mockResolvedValue("E:\\pendrive");
    backup.executarBackup.mockRejectedValue(new Error("pendrive removido"));
    const usuario = userEvent.setup();
    renderizar();
    await usuario.click(await screen.findByRole("button", { name: /fazer backup agora/i }));
    const mensagem = await screen.findByText(/backup falhou/i);
    expect(mensagem).toHaveClass("mensagem-erro");
  });

  it("falha ao gravar a pasta aparece em vermelho", async () => {
    backup.definirPasta.mockRejectedValue(new Error("banco fechado"));
    const usuario = userEvent.setup();
    renderizar();
    await usuario.click(await screen.findByRole("button", { name: /escolher pasta/i }));
    const mensagem = await screen.findByText(/não foi possível definir a pasta/i);
    expect(mensagem).toHaveClass("mensagem-erro");
  });

  it("restauração confirmada importa o banco e recarrega o app", async () => {
    dialogo.open.mockResolvedValueOnce("D:\\prados.db");
    const usuario = userEvent.setup();
    renderizar();
    await usuario.click(await screen.findByRole("button", { name: /restaurar banco de dados/i }));
    await waitFor(() => expect(backup.importarBanco).toHaveBeenCalledWith("D:\\prados.db"));
    await waitFor(() => expect(recarregarApp).toHaveBeenCalled());
  });

  it("restauração cancelada no aviso não chama a importação", async () => {
    dialogo.open.mockResolvedValueOnce("D:\\prados.db");
    dialogo.ask.mockResolvedValueOnce(false);
    const usuario = userEvent.setup();
    renderizar();
    await usuario.click(await screen.findByRole("button", { name: /restaurar banco de dados/i }));
    await waitFor(() => expect(dialogo.ask).toHaveBeenCalled());
    expect(backup.importarBanco).not.toHaveBeenCalled();
  });

  it("falha na restauração mostra erro e destrava a tela", async () => {
    dialogo.open.mockResolvedValueOnce("D:\\arquivo-errado.db");
    backup.importarBanco.mockRejectedValue(new Error("não é um banco SQLite válido"));
    const usuario = userEvent.setup();
    renderizar();
    await usuario.click(await screen.findByRole("button", { name: /restaurar banco de dados/i }));
    const mensagem = await screen.findByText(/importação falhou/i);
    expect(mensagem).toHaveClass("mensagem-erro");
    expect(screen.getByRole("button", { name: /restaurar banco de dados/i })).toBeEnabled();
  });
});
