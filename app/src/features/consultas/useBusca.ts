import { useEffect, useRef, useState } from "react";
import { useRepositorio } from "../../data/ProvedorDeDados";
import type { PaginaDeServicos } from "../../data/servicoRepository";
import type { BuscaDigitada } from "../../domain/busca";
import { interpretarBusca } from "../../domain/interpretarBusca";

export const ITENS_POR_PAGINA = 50;
const DEBOUNCE_MS = 250;

interface EstadoDaBusca {
  resultado: PaginaDeServicos;
  buscaEfetiva: BuscaDigitada;
  carregando: boolean;
  erro: string | null;
}

const VAZIO: PaginaDeServicos = { itens: [], total: 0 };

/**
 * Interpreta o termo digitado, espera a pessoa parar de digitar e busca.
 * Paginação não espera debounce (só digitação espera). Se algo com cara de
 * placa não encontrar nada (ex.: código de produto "PSL560"), refaz
 * automaticamente como busca por texto.
 */
export function useBusca(termo: string, pagina: number, versao = 0): EstadoDaBusca {
  const repositorio = useRepositorio();
  const termoAnterior = useRef(termo);
  const [estado, setEstado] = useState<EstadoDaBusca>({
    resultado: VAZIO,
    buscaEfetiva: { tipo: "vazia" },
    carregando: true,
    erro: null,
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
      if (!cancelada) setEstado({ resultado, buscaEfetiva, carregando: false, erro: null });
    };

    const aoFalhar = (causa: unknown) => {
      console.error("Busca falhou:", causa);
      if (!cancelada) {
        setEstado((atual) => ({
          ...atual,
          carregando: false,
          erro: "Não foi possível buscar — tente novamente.",
        }));
      }
    };

    setEstado((atual) => ({ ...atual, carregando: true }));
    // debounce só quando a pessoa está digitando; paginação e recarga são imediatas
    const termoNaoMudou = termoAnterior.current === termo;
    termoAnterior.current = termo;

    if (termoNaoMudou) {
      buscarAgora().catch(aoFalhar);
      return () => {
        cancelada = true;
      };
    }
    const timer = setTimeout(() => {
      buscarAgora().catch(aoFalhar);
    }, DEBOUNCE_MS);
    return () => {
      cancelada = true;
      clearTimeout(timer);
    };
  }, [repositorio, termo, pagina, versao]);

  return estado;
}
