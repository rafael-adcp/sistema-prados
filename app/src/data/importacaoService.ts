import { invoke } from "@tauri-apps/api/core";
import { hojeIso } from "../domain/datas";
import { converterCsvDoAccess, type ResultadoDaConversao } from "../domain/importarAccess";
import type { CopiarBanco } from "./copiaDeSeguranca";
import type { ServicoRepository } from "./servicoRepository";

export interface ProgressoDaImportacao {
  etapa: "lendo-access" | "copiando" | "importando";
  feitos: number;
  total: number;
}

export interface ResultadoDaMigracao extends ResultadoDaConversao {
  /** Caminho da cópia do banco anterior, tirada antes de qualquer escrita. */
  copiaDeSeguranca: string;
}

/** Pergunta feita à tela quando a importação encolheria a base. */
export type ConfirmarReducao = (aImportar: number, jaGravados: number) => Promise<boolean>;

/** O usuário recusou a confirmação — nada foi tocado, e não é erro para exibir em vermelho. */
export class ImportacaoCancelada extends Error {
  constructor() {
    super("Importação cancelada pelo usuário.");
    this.name = "ImportacaoCancelada";
  }
}

/**
 * Migração 100% via tela: o Rust lê o .mdb com PowerShell/OLEDB (presentes em
 * qualquer Windows), o domínio converte, o repositório grava em lotes.
 * Nada de Node ou scripts manuais na máquina de destino.
 *
 * `substituirTodosPor` começa com um DELETE geral, então TUDO que pode recusar a
 * importação é decidido antes dele, e uma cópia do banco é tirada mesmo assim.
 */
export class ImportacaoService {
  constructor(
    private readonly repositorio: ServicoRepository,
    private readonly copiarBanco: CopiarBanco,
  ) {}

  async importarDoAccess(
    caminhoMdb: string,
    aoProgredir: (progresso: ProgressoDaImportacao) => void,
    confirmarReducao: ConfirmarReducao = async () => true,
  ): Promise<ResultadoDaMigracao> {
    aoProgredir({ etapa: "lendo-access", feitos: 0, total: 0 });
    const caminhoCsv = await invoke<string>("exportar_access", { caminhoMdb });
    const csv = await invoke<string>("ler_arquivo_texto", { caminho: caminhoCsv });

    const resultado = converterCsvDoAccess(csv, hojeIso());
    const total = resultado.servicos.length;

    // .mdb vazio/errado apagava o banco e a tela dizia "concluída: 0 serviços".
    if (total === 0) {
      throw new Error(
        "O arquivo escolhido não tem nenhum serviço. Nada foi alterado — confira se é o Sistema Prado.mdb certo.",
      );
    }
    const jaGravados = await this.repositorio.contarServicos();
    if (total < jaGravados && !(await confirmarReducao(total, jaGravados))) {
      throw new ImportacaoCancelada();
    }

    aoProgredir({ etapa: "copiando", feitos: 0, total });
    const copiaDeSeguranca = await this.copiarBanco();

    aoProgredir({ etapa: "importando", feitos: 0, total });
    await this.repositorio.substituirTodosPor(resultado.servicos, (feitos) =>
      aoProgredir({ etapa: "importando", feitos, total }),
    );
    return { ...resultado, copiaDeSeguranca };
  }
}
