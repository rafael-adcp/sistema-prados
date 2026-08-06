// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
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
  inspecionarBanco: ReturnType<typeof vi.fn>;
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
    inspecionarBanco: vi.fn(async () => 140840),
    fazerBackupAutomaticoSePrecisar: vi.fn(async () => {}),
  };
  ambiente.dados.backup = backup as unknown as BackupService;
});

afterEach(() => {
  vi.useRealTimers(); // garante timers reais de volta mesmo se um teste estourar
  ambiente.banco.fechar();
});

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

  // Antes, a aba inteira renderizava null: sumiam o backup, a migração e o restaurar,
  // sem nenhuma mensagem — exatamente quando o usuário mais precisa deles.
  it("falha ao ler a situação mostra erro e deixa tentar de novo, em vez de tela em branco", async () => {
    backup.pastaConfigurada.mockRejectedValueOnce(new Error("banco indisponível"));
    const usuario = userEvent.setup();
    renderizar();

    expect(await screen.findByText(/não foi possível ler a situação/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /backup e dados/i })).toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: /tentar novamente/i }));
    expect(await screen.findByText(/não configurada/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /migrar do sistema antigo/i })).toBeInTheDocument();
  });

  it("a ficha mostra a versão e desde quando ela está em uso", async () => {
    await ambiente.dados.versao.registrarAbertura("2026-08-06");
    renderizar();
    expect(await screen.findByText(/2\.0\.0 — em uso desde 06\/08\/2026/)).toBeInTheDocument();
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

  it("o aviso de backup criado fecha no ✕", async () => {
    backup.pastaConfigurada.mockResolvedValue("D:\\backups");
    const usuario = userEvent.setup();
    renderizar();
    await usuario.click(await screen.findByRole("button", { name: /fazer backup agora/i }));
    expect(await screen.findByText(/backup criado/i)).toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: /fechar aviso/i }));
    expect(screen.queryByText(/backup criado/i)).not.toBeInTheDocument();
  });

  // Timers falsos ligados ANTES de a mensagem aparecer, senão o setTimeout já
  // saiu com timer real e adiantar o relógio não o alcança. fireEvent (síncrono)
  // em vez de userEvent: os delays internos do userEvent travam sob timers falsos.
  it("o aviso de backup criado some sozinho depois de um tempo", async () => {
    vi.useFakeTimers();
    backup.pastaConfigurada.mockResolvedValue("D:\\backups");
    renderizar();
    await act(async () => {}); // deixa a situação carregar

    fireEvent.click(screen.getByRole("button", { name: /fazer backup agora/i }));
    await act(async () => {}); // deixa o backup resolver
    expect(screen.getByText(/backup criado/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(9000);
    });
    expect(screen.queryByText(/backup criado/i)).not.toBeInTheDocument();
  });

  // "Backup falhou" sumindo sozinho é justamente o que não pode acontecer.
  it("o erro NÃO some sozinho — só sai no ✕", async () => {
    vi.useFakeTimers();
    backup.pastaConfigurada.mockResolvedValue("E:\\pendrive");
    backup.executarBackup.mockRejectedValue(new Error("pendrive removido"));
    renderizar();
    await act(async () => {});

    fireEvent.click(screen.getByRole("button", { name: /fazer backup agora/i }));
    await act(async () => {});
    expect(screen.getByText(/backup falhou/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(screen.getByText(/backup falhou/i)).toBeInTheDocument(); // continua lá

    fireEvent.click(screen.getByRole("button", { name: /fechar aviso/i }));
    expect(screen.queryByText(/backup falhou/i)).not.toBeInTheDocument();
  });

  it("falha de backup aparece em vermelho, não em verde", async () => {
    backup.pastaConfigurada.mockResolvedValue("E:\\pendrive");
    backup.executarBackup.mockRejectedValue(new Error("pendrive removido"));
    const usuario = userEvent.setup();
    renderizar();
    await usuario.click(await screen.findByRole("button", { name: /fazer backup agora/i }));
    const mensagem = await screen.findByText(/backup falhou/i);
    expect(mensagem.closest("p")).toHaveClass("mensagem-erro");
  });

  it("falha ao gravar a pasta aparece em vermelho", async () => {
    backup.definirPasta.mockRejectedValue(new Error("banco fechado"));
    const usuario = userEvent.setup();
    renderizar();
    await usuario.click(await screen.findByRole("button", { name: /escolher pasta/i }));
    const mensagem = await screen.findByText(/não foi possível definir a pasta/i);
    expect(mensagem.closest("p")).toHaveClass("mensagem-erro");
  });

  it("restauração confirmada importa o banco e recarrega o app", async () => {
    dialogo.open.mockResolvedValueOnce("D:\\prados.db");
    const usuario = userEvent.setup();
    renderizar();
    await usuario.click(await screen.findByRole("button", { name: /restaurar banco de dados/i }));
    await waitFor(() => expect(backup.importarBanco).toHaveBeenCalledWith("D:\\prados.db"));
    await waitFor(() => expect(recarregarApp).toHaveBeenCalled());
  });

  it("a confirmação mostra quantos serviços há no arquivo e quantos há agora", async () => {
    dialogo.open.mockResolvedValueOnce("D:\\prados.db");
    const usuario = userEvent.setup();
    renderizar();
    await usuario.click(await screen.findByRole("button", { name: /restaurar banco de dados/i }));
    await waitFor(() =>
      expect(dialogo.ask).toHaveBeenCalledWith(
        expect.stringMatching(/140\.840 serviços[\s\S]*sistema tem 1 agora/i),
        expect.objectContaining({ kind: "warning" }),
      ),
    );
  });

  // Antes, um .db de outro programa passava (só os 16 bytes mágicos eram conferidos),
  // substituía o banco e o app abria zerado, parecendo perda de dados.
  it("arquivo que não é banco do Prados é recusado sem substituir nada", async () => {
    dialogo.open.mockResolvedValueOnce("D:\\historico-do-navegador.db");
    backup.inspecionarBanco.mockRejectedValueOnce(new Error("não é do Sistema Prado"));
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(await screen.findByRole("button", { name: /restaurar banco de dados/i }));

    const mensagem = await screen.findByText(/arquivo recusado.*não é do sistema prado/i);
    expect(mensagem.closest("p")).toHaveClass("mensagem-erro");
    expect(dialogo.ask).not.toHaveBeenCalled(); // nem chegou a perguntar
    expect(backup.importarBanco).not.toHaveBeenCalled();
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
    expect(mensagem.closest("p")).toHaveClass("mensagem-erro");
    expect(screen.getByRole("button", { name: /restaurar banco de dados/i })).toBeEnabled();
  });
});
