export const MESES_ABREVIADOS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const NOMES_DOS_MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/**
 * Faixas de tempo até o carro voltar. A ordem importa: o SQL de agregação é
 * gerado daqui (CASE WHEN dias <= ateDias), e a última faixa (ateDias null)
 * recolhe todo o resto.
 */
export const FAIXAS_DE_RETORNO: { rotulo: string; ateDias: number | null }[] = [
  { rotulo: "Até 3 meses", ateDias: 92 },
  { rotulo: "3 a 6 meses", ateDias: 183 },
  { rotulo: "6 a 9 meses", ateDias: 274 },
  { rotulo: "9 a 12 meses", ateDias: 366 },
  { rotulo: "1 a 1,5 ano", ateDias: 548 },
  { rotulo: "1,5 a 2 anos", ateDias: 731 },
  { rotulo: "Mais de 2 anos", ateDias: null },
];

export interface SerieMensal {
  nome: string;
  pontos: (number | null)[];
}

export interface TrocasNoMes {
  ano: string;
  mes: string;
  total: number;
}

/**
 * Uma série de 12 pontos por ano pedido, preenchendo com 0 os meses sem
 * registro. No ano corrente, meses ainda não chegados viram null para a
 * linha parar no presente em vez de despencar a zero.
 */
export function montarSeriesPorAno(
  linhas: TrocasNoMes[],
  anos: string[],
  mesAtualIso: string,
): SerieMensal[] {
  const anoAtual = mesAtualIso.slice(0, 4);
  const mesAtual = mesAtualIso.slice(5, 7);
  const totais = new Map(linhas.map((linha) => [`${linha.ano}-${linha.mes}`, linha.total]));
  return anos.map((ano) => ({
    nome: ano,
    pontos: MESES_ABREVIADOS.map((_, indice) => {
      const mes = String(indice + 1).padStart(2, "0");
      if (ano === anoAtual && mes > mesAtual) return null;
      return totais.get(`${ano}-${mes}`) ?? 0;
    }),
  }));
}

/** Totais na ordem de FAIXAS_DE_RETORNO (faixas sem registro contam 0). */
export function totaisPorFaixa(linhas: { faixa: number; total: number }[]): number[] {
  const totais = FAIXAS_DE_RETORNO.map(() => 0);
  for (const linha of linhas) {
    if (linha.faixa >= 0 && linha.faixa < totais.length) totais[linha.faixa] = linha.total;
  }
  return totais;
}

export function mediaDe(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return valores.reduce((soma, valor) => soma + valor, 0) / valores.length;
}

export interface ResumoMinMediaMax {
  minimo: number;
  media: number;
  maximo: number;
}

/** Retornos de um ano: mín/média/máx de dias e quantos retornos houve. */
export interface RetornoNoAno extends ResumoMinMediaMax {
  ano: string;
  total: number;
}

/** Resumo geral a partir dos anos: média ponderada pelo nº de retornos. */
export function resumoDosRetornos(porAno: RetornoNoAno[]): ResumoMinMediaMax | null {
  const total = porAno.reduce((soma, linha) => soma + linha.total, 0);
  if (total === 0) return null;
  return {
    minimo: Math.min(...porAno.map((linha) => linha.minimo)),
    media: porAno.reduce((soma, linha) => soma + linha.media * linha.total, 0) / total,
    maximo: Math.max(...porAno.map((linha) => linha.maximo)),
  };
}

export function percentual(parte: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((parte / total) * 100)}%`;
}

export interface PeriodoDeAnos {
  deAno: string;
  ateAno: string;
}

export function periodoDeUltimosAnos(hoje: string, quantidade: number): PeriodoDeAnos {
  const anoAtual = Number(hoje.slice(0, 4));
  return { deAno: String(anoAtual - quantidade + 1), ateAno: String(anoAtual) };
}

/** Os últimos `quantidade` anos até hoje, em ordem crescente ("2022"…"2026"). */
export function ultimosAnos(hoje: string, quantidade: number): string[] {
  const anoAtual = Number(hoje.slice(0, 4));
  return Array.from({ length: quantidade }, (_, i) => String(anoAtual - quantidade + 1 + i));
}

export function mesIsoDe(dataIso: string): string {
  return dataIso.slice(0, 7);
}

export function mesmoMesDoAnoAnterior(mesIso: string): string {
  const ano = Number(mesIso.slice(0, 4));
  return `${ano - 1}${mesIso.slice(4)}`;
}

export function rotuloDeMes(mesIso: string): string {
  const mes = Number(mesIso.slice(5, 7));
  return `${NOMES_DOS_MESES[mes - 1]} de ${mesIso.slice(0, 4)}`;
}

export function rotuloDeMesCalendario(mes: string): string {
  return NOMES_DOS_MESES[Number(mes) - 1] ?? mes;
}
