import type {
  ComparativoDoMes,
  NovosERecorrentesNoAno,
  ProdutoMaisUsado,
  ProdutoNoAno,
  RetornoDeClientes,
  RetornoDosNovosNoAno,
  SazonalidadeDoMes,
  TotalPorAno,
  TotalPorDiaDaSemana,
  TotalPorFaixa,
  TrocasPorAnoEMes,
} from "../../data/analiseRepository";
import { mediaDe, type ResumoMinMediaMax, type RetornoNoAno } from "../../domain/analises";
import type { ReferenciaDoGrafico } from "../../ui/Grafico";

/**
 * O que NÃO obedece ao seletor de ano: séries históricas por definição.
 * Antes, isto e os indicadores do ano moravam num saco só chamado
 * `NumerosDaOficina`, e só lendo o `carregarPainel` dava para saber qual campo
 * respeitava o filtro. Agora o tipo diz.
 */
export interface NumerosHistoricos {
  trocasPorAnoEMes: TrocasPorAnoEMes[];
  trocasPorAno: TotalPorAno[];
  placasDistintasPorAno: TotalPorAno[];
  retornoPorAno: RetornoNoAno[];
  novosERecorrentes: NovosERecorrentesNoAno[];
  retornoDosNovos: RetornoDosNovosNoAno[];
  produtosPorAno: ProdutoNoAno[];
  /** Sempre sobre todos os anos, para o cartão de média mensal histórica. */
  porMesHistorico: ResumoMinMediaMax | null;
  sazonalidade: SazonalidadeDoMes[];
  comparativo: ComparativoDoMes;
}

/** O que É recortado pelo ano escolhido. */
export interface IndicadoresDoAno {
  faixasDeRetorno: TotalPorFaixa[];
  porDia: ResumoMinMediaMax | null;
  porMes: ResumoMinMediaMax | null;
  porAno: ResumoMinMediaMax | null;
  porDiaDaSemana: TotalPorDiaDaSemana[];
  retorno: RetornoDeClientes;
  topProdutos: ProdutoMaisUsado[];
}

export type NumerosDaOficina = NumerosHistoricos & IndicadoresDoAno;

export const inteiro = (valor: number) => Math.round(valor).toLocaleString("pt-BR");
export const emDias = (valor: number) => `${Math.round(valor).toLocaleString("pt-BR")} dias`;
export const emPercentual = (valor: number) => `${Math.round(valor)}%`;

export function referenciaDeMedia(totais: number[]): ReferenciaDoGrafico[] {
  const media = mediaDe(totais);
  return media === null ? [] : [{ rotulo: "Média", valor: media }];
}
