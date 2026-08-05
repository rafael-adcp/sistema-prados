import { useEffect, useRef, useState } from "react";
import { useBackup } from "./data/ProvedorDeDados";
import { BackupPage } from "./features/backup/BackupPage";
import { ConsultasPage } from "./features/consultas/ConsultasPage";
import { HistoricoPage } from "./features/historico/HistoricoPage";
import { NovoServicoPage } from "./features/novo-servico/NovoServicoPage";
import { RelatoriosPage } from "./features/relatorios/RelatoriosPage";

type Tela =
  | { nome: "novo" }
  | { nome: "consultas" }
  | { nome: "historico"; placa: string }
  | { nome: "relatorios" }
  | { nome: "backup" };

const ABAS = [
  { nome: "novo", rotulo: "Novo Serviço" },
  { nome: "consultas", rotulo: "Consultas" },
  { nome: "relatorios", rotulo: "Relatórios" },
  { nome: "backup", rotulo: "Backup" },
] as const;

export default function App() {
  const [tela, setTela] = useState<Tela>({ nome: "novo" });
  const backup = useBackup();
  const backupJaVerificado = useRef(false);

  useEffect(() => {
    if (backupJaVerificado.current) return;
    backupJaVerificado.current = true;
    backup.fazerBackupAutomaticoSePrecisar().catch((causa) => {
      console.error("Backup automático falhou:", causa);
    });
  }, [backup]);

  const verHistorico = (placa: string) => setTela({ nome: "historico", placa });

  return (
    <div className="app">
      <header className="cabecalho no-print">
        <h1>Super Troca de Óleo Prado's</h1>
        <nav>
          {ABAS.map((aba) => (
            <button
              key={aba.nome}
              type="button"
              className={tela.nome === aba.nome ? "aba ativa" : "aba"}
              onClick={() => setTela({ nome: aba.nome })}
            >
              {aba.rotulo}
            </button>
          ))}
        </nav>
      </header>
      <main className="conteudo">
        {tela.nome === "novo" && <NovoServicoPage aoVerHistorico={verHistorico} />}
        {tela.nome === "consultas" && <ConsultasPage aoVerHistorico={verHistorico} />}
        {tela.nome === "historico" && (
          <HistoricoPage placa={tela.placa} aoVoltar={() => setTela({ nome: "consultas" })} />
        )}
        {tela.nome === "relatorios" && <RelatoriosPage aoVerHistorico={verHistorico} />}
        {tela.nome === "backup" && <BackupPage />}
      </main>
    </div>
  );
}
