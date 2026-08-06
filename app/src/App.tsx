import { useEffect, useRef, useState } from "react";
import { useBackup, useVersao } from "./data/ProvedorDeDados";
import { hojeIso } from "./domain/datas";
import { AnalisesPage } from "./features/analises/AnalisesPage";
import { AvisoDeAtualizacao } from "./features/atualizacao/AvisoDeAtualizacao";
import { BackupPage } from "./features/backup/BackupPage";
import { ConsultasPage } from "./features/consultas/ConsultasPage";
import { HistoricoPage } from "./features/historico/HistoricoPage";
import { NovoServicoPage } from "./features/novo-servico/NovoServicoPage";
import { RelatoriosPage } from "./features/relatorios/RelatoriosPage";

type Aba = "novo" | "consultas" | "relatorios" | "analises" | "backup";

type Tela = { nome: Aba } | { nome: "historico"; placa: string; origem: Aba };

const ABAS: { nome: Aba; rotulo: string }[] = [
  { nome: "novo", rotulo: "Novo Serviço" },
  { nome: "consultas", rotulo: "Consultas" },
  { nome: "relatorios", rotulo: "Relatórios" },
  { nome: "analises", rotulo: "Análises" },
  { nome: "backup", rotulo: "Backup" },
];

export default function App() {
  const [tela, setTela] = useState<Tela>({ nome: "novo" });
  const [avisoBackup, setAvisoBackup] = useState<string | null>(null);
  const [versaoEmUso, setVersaoEmUso] = useState<string | null>(null);
  const backup = useBackup();
  const versao = useVersao();
  const backupJaVerificado = useRef(false);

  // Carimba a data quando o número muda; o cabeçalho só mostra o número.
  useEffect(() => {
    versao
      .registrarAbertura(hojeIso())
      .then((emUso) => setVersaoEmUso(emUso.numero))
      .catch((causa) => console.error("Não foi possível ler a versão:", causa));
  }, [versao]);

  useEffect(() => {
    if (backupJaVerificado.current) return;
    backupJaVerificado.current = true;
    backup.fazerBackupAutomaticoSePrecisar().catch((causa) => {
      console.error("Backup automático falhou:", causa);
      setAvisoBackup(
        "O backup automático falhou — confira a pasta de backup na aba Backup (pendrive removido?).",
      );
    });
  }, [backup]);

  const verHistorico = (placa: string) => {
    setTela((atual) => ({
      nome: "historico",
      placa,
      origem: atual.nome === "historico" ? atual.origem : atual.nome,
    }));
  };

  const emHistorico = tela.nome === "historico";

  return (
    <div className="app">
      <header className="cabecalho no-print">
        <h1>
          Super Troca de Óleo Prado's
          {versaoEmUso !== null && <span className="versao-do-app">versão {versaoEmUso}</span>}
        </h1>
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
      <AvisoDeAtualizacao />
      {avisoBackup !== null && (
        <div className="banner-aviso no-print">
          <span>{avisoBackup}</span>
          <button type="button" onClick={() => setAvisoBackup(null)}>
            ✕
          </button>
        </div>
      )}
      <main className="conteudo">
        {/* As abas ficam montadas (hidden) para não perder formulário/busca ao navegar. */}
        <div hidden={emHistorico || tela.nome !== "novo"}>
          <NovoServicoPage aoVerHistorico={verHistorico} />
        </div>
        <div hidden={emHistorico || tela.nome !== "consultas"}>
          <ConsultasPage ativa={tela.nome === "consultas"} aoVerHistorico={verHistorico} />
        </div>
        <div hidden={emHistorico || tela.nome !== "relatorios"}>
          <RelatoriosPage aoVerHistorico={verHistorico} />
        </div>
        <div hidden={emHistorico || tela.nome !== "analises"}>
          <AnalisesPage ativa={tela.nome === "analises"} aoVerHistorico={verHistorico} />
        </div>
        <div hidden={emHistorico || tela.nome !== "backup"}>
          <BackupPage ativa={tela.nome === "backup"} />
        </div>
        {tela.nome === "historico" && (
          <HistoricoPage placa={tela.placa} aoVoltar={() => setTela({ nome: tela.origem })} />
        )}
      </main>
    </div>
  );
}
