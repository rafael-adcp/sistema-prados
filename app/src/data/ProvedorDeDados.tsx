import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Carregando } from "../ui/Carregando";
import { AnaliseRepository } from "./analiseRepository";
import { BackupService } from "./backupService";
import { ConfigRepository } from "./configRepository";
import { obterBanco } from "./database";
import { ImportacaoService } from "./importacaoService";
import { ServicoRepository } from "./servicoRepository";

export interface Dados {
  repositorio: ServicoRepository;
  backup: BackupService;
  importacao: ImportacaoService;
  analises: AnaliseRepository;
}

const ContextoDeDados = createContext<Dados | null>(null);

/** Só para testes: injeta serviços prontos (fakes ou sobre SQLite em memória). */
export function ProvedorDeDadosParaTeste({
  dados,
  children,
}: {
  dados: Dados;
  children: ReactNode;
}) {
  return <ContextoDeDados.Provider value={dados}>{children}</ContextoDeDados.Provider>;
}

/** Abre o banco uma vez e injeta repositório e backup em toda a árvore. */
export function ProvedorDeDados({ children }: { children: ReactNode }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    obterBanco()
      .then((db) => {
        const repositorio = new ServicoRepository(db);
        setDados({
          repositorio,
          backup: new BackupService(db, new ConfigRepository(db)),
          importacao: new ImportacaoService(repositorio),
          analises: new AnaliseRepository(db),
        });
      })
      .catch((causa) => setErro(String(causa)));
  }, []);

  if (erro !== null) {
    return (
      <div className="tela-erro">
        <h1>Não foi possível abrir o banco de dados</h1>
        <p>{erro}</p>
      </div>
    );
  }
  if (dados === null) return <Carregando mensagem="Abrindo o banco de dados…" />;
  return <ContextoDeDados.Provider value={dados}>{children}</ContextoDeDados.Provider>;
}

function useDados(): Dados {
  const dados = useContext(ContextoDeDados);
  if (dados === null) throw new Error("useDados fora do ProvedorDeDados");
  return dados;
}

export function useRepositorio(): ServicoRepository {
  return useDados().repositorio;
}

export function useBackup(): BackupService {
  return useDados().backup;
}

export function useImportacao(): ImportacaoService {
  return useDados().importacao;
}

export function useAnalises(): AnaliseRepository {
  return useDados().analises;
}
