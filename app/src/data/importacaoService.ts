import { invoke } from "@tauri-apps/api/core";
import { hojeIso } from "../domain/datas";
import { converterCsvDoAccess, type ResultadoDaConversao } from "../domain/importarAccess";
import type { ServicoRepository } from "./servicoRepository";

export interface ProgressoDaImportacao {
  etapa: "lendo-access" | "importando";
  feitos: number;
  total: number;
}

/**
 * Migração 100% via tela: o Rust lê o .mdb com PowerShell/OLEDB (presentes em
 * qualquer Windows), o domínio converte, o repositório grava em lotes.
 * Nada de Node ou scripts manuais na máquina de destino.
 */
export class ImportacaoService {
  constructor(private readonly repositorio: ServicoRepository) {}

  async importarDoAccess(
    caminhoMdb: string,
    aoProgredir: (progresso: ProgressoDaImportacao) => void,
  ): Promise<ResultadoDaConversao> {
    aoProgredir({ etapa: "lendo-access", feitos: 0, total: 0 });
    const caminhoCsv = await invoke<string>("exportar_access", { caminhoMdb });
    const csv = await invoke<string>("ler_arquivo_texto", { caminho: caminhoCsv });

    const resultado = converterCsvDoAccess(csv, hojeIso());
    const total = resultado.servicos.length;
    aoProgredir({ etapa: "importando", feitos: 0, total });
    await this.repositorio.substituirTodosPor(resultado.servicos, (feitos) =>
      aoProgredir({ etapa: "importando", feitos, total }),
    );
    return resultado;
  }
}
