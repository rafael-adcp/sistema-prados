import { ask, open } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import { useImportacao } from "../../data/ProvedorDeDados";
import type { ProgressoDaImportacao } from "../../data/importacaoService";

interface Props {
  aoConcluir: (mensagem: string) => void;
  aoFalhar: (mensagem: string) => void;
}

function descreverProgresso(progresso: ProgressoDaImportacao): string {
  if (progresso.etapa === "lendo-access") return "Lendo o arquivo do Access…";
  return `Importando ${progresso.feitos.toLocaleString("pt-BR")} de ${progresso.total.toLocaleString("pt-BR")} serviços…`;
}

/**
 * Migração 100% via tela: escolhe o .mdb, o app lê o Access e importa tudo.
 * Sem Node, sem scripts, sem linha de comando na máquina do balcão.
 */
export function MigracaoAccess({ aoConcluir, aoFalhar }: Props) {
  const importacao = useImportacao();
  const [progresso, setProgresso] = useState<ProgressoDaImportacao | null>(null);

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
      const resultado = await importacao.importarDoAccess(arquivo, setProgresso);
      aoConcluir(
        `✓ Migração concluída: ${resultado.servicos.length.toLocaleString("pt-BR")} serviços importados ` +
          `(${resultado.semData.toLocaleString("pt-BR")} sem data, ${resultado.semPlaca.toLocaleString("pt-BR")} sem placa — todos preservados).`,
      );
    } catch (causa) {
      aoFalhar(`Migração falhou (nada além dos dados importados até aqui foi alterado — repita para recomeçar): ${causa}`);
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
