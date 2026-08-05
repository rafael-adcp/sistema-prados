import { render, type RenderResult } from "@testing-library/react";
import type { ReactNode } from "react";
import type { BackupService } from "../data/backupService";
import type { ImportacaoService } from "../data/importacaoService";
import { ProvedorDeDadosParaTeste, type Dados } from "../data/ProvedorDeDados";
import { ServicoRepository } from "../data/servicoRepository";
import type { ServicoImportado } from "../domain/importarAccess";
import { criarBancoDeTeste, type BancoDeTeste } from "./bancoDeTeste";

export interface AmbienteDeTeste {
  banco: BancoDeTeste;
  repositorio: ServicoRepository;
  dados: Dados;
}

/** Backup inofensivo para testes de tela — nunca toca em invoke/dialog. */
function backupInerte(): BackupService {
  return {
    pastaConfigurada: async () => null,
    ultimoBackupEm: async () => null,
    fazerBackupAutomaticoSePrecisar: async () => {},
  } as unknown as BackupService;
}

export function criarAmbienteDeTeste(): AmbienteDeTeste {
  const banco = criarBancoDeTeste();
  const repositorio = new ServicoRepository(banco);
  const dados: Dados = {
    repositorio,
    backup: backupInerte(),
    importacao: { importarDoAccess: async () => ({ servicos: [], semData: 0, semPlaca: 0, datasSuspeitas: 0 }) } as unknown as ImportacaoService,
  };
  return { banco, repositorio, dados };
}

export function servicoImportado(
  parcial: Partial<ServicoImportado> & { id: number },
): ServicoImportado {
  return {
    carro: "GOL 1.0",
    km: 100000,
    kmRaw: "100000",
    placa: "AAA0001",
    produto: "3 SL",
    data: "2024-01-10",
    dataSuspeita: false,
    ...parcial,
  };
}

export function renderizarComDados(ui: ReactNode, dados: Dados): RenderResult {
  return render(<ProvedorDeDadosParaTeste dados={dados}>{ui}</ProvedorDeDadosParaTeste>);
}
