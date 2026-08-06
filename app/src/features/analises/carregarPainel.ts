import type {
  AnaliseRepository,
  BaseDeAnalise,
  ContagensDeInconsistencias,
} from "../../data/analiseRepository";
import {
  mesIsoDe,
  mesmoMesDoAnoAnterior,
  periodoDeUltimosAnos,
  type PeriodoDeAnos,
} from "../../domain/analises";
import type { NumerosDaOficina } from "./SecaoNumeros";

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
  hoje: string,
  anoEscolhido: string,
): Promise<PainelDeAnalises> {
  const periodo = paraPeriodo(anoEscolhido);
  const mesAtual = mesIsoDe(hoje);
  const { base, contagens, anosDoBanco, ...numeros } = await aguardarNomeados({
    base: analises.contarBase(),
    contagens: analises.contarInconsistencias(),
    anosDoBanco: analises.anosDisponiveis(),
    trocasPorAnoEMes: analises.trocasPorAnoEMes(periodoDeUltimosAnos(hoje, 5)),
    trocasPorAno: analises.trocasPorAno(), // por ano é multi-anos por definição: o filtro não se aplica
    placasDistintasPorAno: analises.placasDistintasPorAno(),
    faixasDeRetorno: analises.faixasDeRetorno(periodo),
    retornoPorAno: analises.retornoPorAno(),
    porDia: analises.resumoDeTrocas("dia", periodo),
    porMes: analises.resumoDeTrocas("mes", periodo),
    porAno: analises.resumoDeTrocas("ano", periodo),
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
