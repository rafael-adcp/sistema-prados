import { interpretarTermoDeData } from "./datas";
import { pareceBuscaPorPlaca, prefixoDePlaca } from "./placa";

export type Busca =
  | { tipo: "vazia" }
  | { tipo: "data"; de: string; ate: string }
  | { tipo: "placa"; prefixo: string }
  | { tipo: "texto"; termo: string }
  | { tipo: "carro"; termo: string }; // só nos relatórios; a caixa de busca nunca produz

/**
 * Uma caixa de busca só, que entende o que a pessoa quis dizer:
 * "25/12/2024" → data · "ABC1234" → placa · "GOL 1.0" → texto
 * (a busca por texto também olha a placa, então ambiguidade não esconde nada).
 */
export function interpretarBusca(termoDigitado: string): Busca {
  const termo = termoDigitado.trim();
  if (termo === "") return { tipo: "vazia" };

  const periodo = interpretarTermoDeData(termo);
  if (periodo !== null) return { tipo: "data", ...periodo };

  if (pareceBuscaPorPlaca(termo)) {
    return { tipo: "placa", prefixo: prefixoDePlaca(termo) };
  }

  return { tipo: "texto", termo };
}

export function descreverBusca(busca: Busca): string {
  switch (busca.tipo) {
    case "vazia":
      return "Mostrando os serviços mais recentes";
    case "data":
      return busca.de === busca.ate ? "Buscando por data" : "Buscando por período";
    case "placa":
      return "Buscando por placa";
    case "texto":
      return "Buscando em carro, produto e placa";
    case "carro":
      return "Buscando por carro";
  }
}
