import { ask, open } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import { useImportacao } from "../../data/ProvedorDeDados";
import { ImportacaoCancelada, type ProgressoDaImportacao } from "../../data/importacaoService";

interface Props {
  aoConcluir: (mensagem: string) => void;
  aoFalhar: (mensagem: string) => void;
}

function descreverProgresso(progresso: ProgressoDaImportacao): string {
  if (progresso.etapa === "lendo-access") return "Lendo o arquivo do Access…";
  if (progresso.etapa === "copiando") return "Guardando cópia do banco atual…";
  return `Importando ${progresso.feitos.toLocaleString("pt-BR")} de ${progresso.total.toLocaleString("pt-BR")} serviços…`;
}

/**
 * Migração 100% via tela: escolhe o .mdb, o app lê o Access e importa tudo.
 * Sem Node, sem scripts, sem linha de comando na máquina do balcão.
 */
export function MigracaoAccess({ aoConcluir, aoFalhar }: Props) {
  const importacao = useImportacao();
  const [progresso, setProgresso] = useState<ProgressoDaImportacao | null>(null);

  /** Importar menos do que já existe é o sinal de "refiz a migração e vou perder o
   *  que foi digitado desde a virada". Vale uma segunda confirmação, com os números. */
  const confirmarReducao = (aImportar: number, jaGravados: number) =>
    ask(
      `O arquivo tem ${aImportar.toLocaleString("pt-BR")} serviços, mas o sistema já tem ` +
        `${jaGravados.toLocaleString("pt-BR")}.\nContinuar apaga os ` +
        `${(jaGravados - aImportar).toLocaleString("pt-BR")} que só existem aqui.\nContinuar mesmo assim?`,
      { title: "Atenção: a importação vai reduzir a base", kind: "warning" },
    );

  const migrar = async () => {
    const arquivo = await open({
      title: "Escolha o Sistema Prado.mdb (sistema antigo)",
      filters: [{ name: "Banco do Access", extensions: ["mdb", "accdb"] }],
    });
    if (typeof arquivo !== "string") return;
    const confirmado = await ask(
      "Isto SUBSTITUI todos os dados atuais pelos registros do sistema antigo.\nUse apenas na primeira instalação (ou para refazer a migração).\nContinuar?",
      { title: "Migrar do sistema antigo", kind: "warning" },
    );
    if (!confirmado) return;
    setProgresso({ etapa: "lendo-access", feitos: 0, total: 0 });
    try {
      const resultado = await importacao.importarDoAccess(arquivo, setProgresso, confirmarReducao);
      aoConcluir(
        `✓ Migração concluída: ${resultado.servicos.length.toLocaleString("pt-BR")} serviços importados ` +
          `(${resultado.semData.toLocaleString("pt-BR")} sem data, ${resultado.semPlaca.toLocaleString("pt-BR")} sem placa — todos preservados). ` +
          `O banco anterior ficou guardado em ${resultado.copiaDeSeguranca}.`,
      );
    } catch (causa) {
      if (causa instanceof ImportacaoCancelada) return;
      // A importação apaga tudo antes de gravar: se falhou no meio, o banco ficou
      // incompleto. A cópia de segurança é a saída, e a tela precisa dizer isso.
      aoFalhar(
        `Migração falhou: ${causa}. Repita a migração para recomeçar do zero — ` +
          `se o problema continuar, use "Restaurar banco de dados…" com a cópia ` +
          `prados-antes-da-migracao-*.db da pasta de dados do sistema.`,
      );
    } finally {
      setProgresso(null);
    }
  };

  return (
    <>
      <h3>Migrar do sistema antigo (Access)</h3>
      <p className="texto-apoio">
        Escolha o arquivo <code>Sistema Prado.mdb</code> e o sistema importa tudo sozinho —
        funciona nesta máquina mesmo sem Office (usa o leitor que já vem no Windows).
      </p>
      <button
        type="button"
        className="botao-secundario"
        disabled={progresso !== null}
        onClick={() => void migrar()}
      >
        {progresso !== null ? descreverProgresso(progresso) : "Migrar do sistema antigo (.mdb)…"}
      </button>
    </>
  );
}
