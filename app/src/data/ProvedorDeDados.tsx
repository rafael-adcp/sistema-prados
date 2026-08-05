import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Carregando } from "../ui/Carregando";
import { BackupService } from "./backupService";
import { obterBanco } from "./database";
import { ServicoRepository } from "./servicoRepository";

interface Dados {
  repositorio: ServicoRepository;
  backup: BackupService;
}

const ContextoDeDados = createContext<Dados | null>(null);

/** Abre o banco uma vez e injeta repositório e backup em toda a árvore. */
export function ProvedorDeDados({ children }: { children: ReactNode }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    obterBanco()
      .then((db) => {
        const repositorio = new ServicoRepository(db);
        setDados({ repositorio, backup: new BackupService(db, repositorio) });
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
