import { useEffect, useState } from "react";
import { useRepositorio } from "../../data/ProvedorDeDados";
import type { PaginaDeServicos } from "../../data/servicoRepository";
import { interpretarBusca, type Busca } from "../../domain/interpretarBusca";

export const ITENS_POR_PAGINA = 50;
const DEBOUNCE_MS = 250;

interface EstadoDaBusca {
  resultado: PaginaDeServicos;
  buscaEfetiva: Busca;
  carregando: boolean;
}

const VAZIO: PaginaDeServicos = { itens: [], total: 0 };

/**
 * Interpreta o termo digitado, espera a pessoa parar de digitar e busca.
 * Se algo com cara de placa não encontrar nada (ex.: código de produto
 * "PSL560"), refaz automaticamente como busca por texto.
 */
export function useBusca(termo: string, pagina: number): EstadoDaBusca {
  const repositorio = useRepositorio();
  const [estado, setEstado] = useState<EstadoDaBusca>({
    resultado: VAZIO,
    buscaEfetiva: { tipo: "vazia" },
    carregando: true,
  });

  useEffect(() => {
    let cancelada = false;

    const buscarAgora = async () => {
      const busca = interpretarBusca(termo);
      let resultado = await repositorio.buscar(busca, pagina, ITENS_POR_PAGINA);
      let buscaEfetiva = busca;
      if (busca.tipo === "placa" && resultado.total === 0) {
        buscaEfetiva = { tipo: "texto", termo: termo.trim() };
        resultado = await repositorio.buscar(buscaEfetiva, pagina, ITENS_POR_PAGINA);
      }
      if (!cancelada) setEstado({ resultado, buscaEfetiva, carregando: false });
    };

    setEstado((atual) => ({ ...atual, carregando: true }));
    const timer = setTimeout(() => {
      buscarAgora().catch((causa) => console.error("Busca falhou:", causa));
    }, DEBOUNCE_MS);

    return () => {
      cancelada = true;
      clearTimeout(timer);
    };
  }, [repositorio, termo, pagina]);

  return estado;
}
