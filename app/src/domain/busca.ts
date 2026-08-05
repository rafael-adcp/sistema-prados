/** Linguagem de filtro do repositório — tudo que buscar() sabe executar. */
export type Busca =
  | { tipo: "vazia" }
  | { tipo: "data"; de: string; ate: string }
  | { tipo: "placa"; prefixo: string }
  | { tipo: "texto"; termo: string }
  | { tipo: "carro"; termo: string };

/** O que a caixa de busca produz ("carro" existe só nos relatórios). */
export type BuscaDigitada = Exclude<Busca, { tipo: "carro" }>;
