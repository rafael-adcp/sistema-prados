import type { AnaliseRepository } from "../../data/analiseRepository";
import type {
  BaseDeAnalise,
  ContagensDeInconsistencias,
  QualidadeRepository,
} from "../../data/qualidadeRepository";
import {
  mesIsoDe,
  mesmoMesDoAnoAnterior,
  periodoDeUltimosAnos,
  type PeriodoDeAnos,
} from "../../domain/analises";
import type { NumerosDaOficina } from "./numerosDaOficina";

/**
 * Janela do gráfico "Trocas por mês". Vive só aqui: a tela deriva os anos dos
 * próprios dados que recebe, então o número não fica repetido em dois lugares
 * (era assim antes, com o 5 escrito na consulta E na montagem das séries).
 */
export const ANOS_NO_GRAFICO_MENSAL = 10;

/** Linhas no gráfico de evolução do mix de produtos. */
export const PRODUTOS_NO_GRAFICO_DE_MIX = 5;

export interface PainelDeAnalises {
  base: BaseDeAnalise;
  contagens: ContagensDeInconsistencias;
  /** Anos do seletor: os do banco, garantindo o ano corrente presente. */
  anos: string[];
  numeros: NumerosDaOficina;
}

/** "todos" ou um ano ("2026"): filtra os indicadores, não os gráficos por ano. */
function paraPeriodo(anoEscolhido: string): PeriodoDeAnos | undefined {
  return anoEscolhido === "todos" ? undefined : { deAno: anoEscolhido, ateAno: anoEscolhido };
}

type Resolvidos<T> = { [K in keyof T]: Awaited<T[K]> };

/** Promise.all com resultado nomeado: cada consulta cai na chave certa. */
async function aguardarNomeados<T extends Record<string, Promise<unknown>>>(
  promessas: T,
): Promise<Resolvidos<T>> {
  const pares = Object.entries(promessas);
  const valores = await Promise.all(pares.map(([, promessa]) => promessa));
  return Object.fromEntries(pares.map(([chave], i) => [chave, valores[i]])) as Resolvidos<T>;
}

/** Todas as consultas da aba Análises, em paralelo, prontas para a tela. */
export async function carregarPainel(
  analises: AnaliseRepository,
  qualidade: QualidadeRepository,
  hoje: string,
  anoEscolhido: string,
): Promise<PainelDeAnalises> {
  const periodo = paraPeriodo(anoEscolhido);
  const mesAtual = mesIsoDe(hoje);
  const { base, contagens, anosDoBanco, ...numeros } = await aguardarNomeados({
    base: qualidade.contarBase(),
    contagens: qualidade.contarInconsistencias(),
    anosDoBanco: analises.anosDisponiveis(),
    trocasPorAnoEMes: analises.trocasPorAnoEMes(periodoDeUltimosAnos(hoje, ANOS_NO_GRAFICO_MENSAL)),
    trocasPorAno: analises.trocasPorAno(), // por ano é multi-anos por definição: o filtro não se aplica
    placasDistintasPorAno: analises.placasDistintasPorAno(),
    novosERecorrentes: analises.novosERecorrentesPorAno(),
    retornoDosNovos: analises.retornoDosNovosPorAno(),
    produtosPorAno: analises.produtosPorAno(PRODUTOS_NO_GRAFICO_DE_MIX),
    faixasDeRetorno: analises.faixasDeRetorno(periodo),
    retornoPorAno: analises.retornoPorAno(),
    porDia: analises.resumoDeTrocas("dia", periodo),
    porMes: analises.resumoDeTrocas("mes", periodo),
    porAno: analises.resumoDeTrocas("ano", periodo),
    porDiaDaSemana: analises.trocasPorDiaDaSemana(periodo),
    porMesHistorico: analises.resumoDeTrocas("mes"), // média mensal histórica do cartão, sempre completa
    retorno: analises.retornoDeClientes(periodo),
    sazonalidade: analises.sazonalidade(mesAtual), // multi-anos, como no BI antigo
    comparativo: analises.comparativoDoMes(mesAtual, mesmoMesDoAnoAnterior(mesAtual)),
    topProdutos: analises.topProdutos(10, periodo),
  });
  const anoAtual = hoje.slice(0, 4);
  return {
    base,
    contagens,
    anos: anosDoBanco.includes(anoAtual) ? anosDoBanco : [anoAtual, ...anosDoBanco],
    numeros,
  };
}
