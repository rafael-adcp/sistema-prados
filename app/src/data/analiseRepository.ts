import {
  FAIXAS_DE_RETORNO,
  type PeriodoDeAnos,
  type ResumoMinMediaMax,
  type RetornoNoAno,
} from "../domain/analises";
import { hojeIso } from "../domain/datas";
import { BASE } from "./baseDeAnalise";
import type { PortaDoBanco } from "./portaDoBanco";

export interface TotalPorAno {
  ano: string;
  total: number;
}

export interface TrocasPorAnoEMes {
  ano: string;
  mes: string;
  total: number;
}

export interface TotalPorFaixa {
  faixa: number;
  total: number;
}

export interface SazonalidadeDoMes {
  mes: string;
  minimo: number;
  media: number;
  maximo: number;
}

export interface RetornoDeClientes {
  voltam: number;
  naoVoltam: number;
  total: number;
  visitasPorCarro: ResumoMinMediaMax | null;
}

export interface ComparativoDoMes {
  mesAtual: number;
  mesAnoPassado: number;
}

export interface ProdutoMaisUsado {
  produto: string;
  total: number;
}

export interface NovosERecorrentesNoAno {
  ano: string;
  novos: number;
  recorrentes: number;
}

export interface RetornoDosNovosNoAno {
  ano: string;
  novos: number;
  voltaram: number;
}

export interface TotalPorDiaDaSemana {
  /** Como o %w do SQLite: "0" = domingo … "6" = sábado. */
  dia: string;
  total: number;
}

export interface ProdutoNoAno {
  produto: string;
  ano: string;
  total: number;
}

export type AgrupamentoDeTrocas = "dia" | "mes" | "ano";

const EXPRESSAO_DO_AGRUPAMENTO: Record<AgrupamentoDeTrocas, string> = {
  dia: "data",
  mes: "substr(data, 1, 7)",
  ano: "substr(data, 1, 4)",
};

interface FiltroDeBase {
  where: string;
  parametros: unknown[];
}

/** Faixa do intervalo em dias, gerada a partir de FAIXAS_DE_RETORNO. */
function casePorFaixa(): string {
  const condicoes = FAIXAS_DE_RETORNO.slice(0, -1)
    .map((faixa, indice) => `WHEN dias <= ${faixa.ateDias} THEN ${indice}`)
    .join(" ");
  return `CASE ${condicoes} ELSE ${FAIXAS_DE_RETORNO.length - 1} END`;
}

/**
 * Os números da oficina na aba Análises: trocas, carros, retorno, sazonalidade.
 * A qualidade dos dados é assunto do QualidadeRepository — as duas metades
 * moravam aqui e não compartilhavam nada além do corte BASE.
 * Só leitura — correções passam pelo ServicoRepository, como nas outras telas.
 */
export class AnaliseRepository {
  constructor(private readonly db: PortaDoBanco) {}

  async trocasPorAnoEMes(periodo?: PeriodoDeAnos): Promise<TrocasPorAnoEMes[]> {
    const filtro = this.filtroDaBase(periodo);
    return this.db.select<TrocasPorAnoEMes[]>(
      `SELECT substr(data, 1, 4) AS ano, substr(data, 6, 2) AS mes, COUNT(*) AS total
       FROM servicos WHERE ${filtro.where}
       GROUP BY ano, mes ORDER BY ano, mes`,
      filtro.parametros,
    );
  }

  async trocasPorAno(periodo?: PeriodoDeAnos): Promise<TotalPorAno[]> {
    const filtro = this.filtroDaBase(periodo);
    return this.db.select<TotalPorAno[]>(
      `SELECT substr(data, 1, 4) AS ano, COUNT(*) AS total
       FROM servicos WHERE ${filtro.where}
       GROUP BY ano ORDER BY ano`,
      filtro.parametros,
    );
  }

  /**
   * Carros diferentes atendidos por ano — o mesmo carro conta uma vez só no ano,
   * tenha voltado quantas vezes for.
   *
   * O BI de 2016 (`pr_qtde_placas_distintasXano`) fazia `distinct placa, data`, o
   * que na prática contava placa-DIA: um carro que voltou em março contava 2. O
   * nome e o título do gráfico sempre prometeram carros distintos, então quem
   * estava errado era o SQL. Números daqui são menores que os do BI antigo.
   */
  async placasDistintasPorAno(periodo?: PeriodoDeAnos): Promise<TotalPorAno[]> {
    const filtro = this.filtroDaBase(periodo);
    return this.db.select<TotalPorAno[]>(
      `SELECT substr(data, 1, 4) AS ano, COUNT(DISTINCT placa) AS total
       FROM servicos WHERE ${filtro.where} AND placa <> ''
       GROUP BY ano ORDER BY ano`,
      filtro.parametros,
    );
  }

  /**
   * Distribuição do tempo de retorno. O período (opcional) corta pelo ano da
   * VISITA DE VOLTA — assim um retorno em jan/2026 vindo de 2025 conta, em vez
   * de sumir por a visita anterior ficar fora da janela.
   */
  async faixasDeRetorno(periodo?: PeriodoDeAnos): Promise<TotalPorFaixa[]> {
    const corte = periodo === undefined ? "" : "AND ano BETWEEN $1 AND $2";
    const parametros = periodo === undefined ? [] : [periodo.deAno, periodo.ateAno];
    return this.db.select<TotalPorFaixa[]>(
      `SELECT ${casePorFaixa()} AS faixa, COUNT(*) AS total
       FROM (${this.sqlDeIntervalos(BASE)}) WHERE dias > 0 ${corte}
       GROUP BY faixa ORDER BY faixa`,
      parametros,
    );
  }

  /**
   * Retornos por ano numa passada só: alimenta o gráfico de tendência e,
   * agregado no domínio (resumoDosRetornos), o KPI de dias para voltar.
   */
  async retornoPorAno(): Promise<RetornoNoAno[]> {
    return this.db.select<RetornoNoAno[]>(
      `SELECT ano, MIN(dias) AS minimo, AVG(dias) AS media, MAX(dias) AS maximo,
              COUNT(*) AS total
       FROM (${this.sqlDeIntervalos(BASE)}) WHERE dias > 0
       GROUP BY ano ORDER BY ano`,
    );
  }

  /** Anos com registro na base confiável, do mais novo ao mais antigo. */
  async anosDisponiveis(): Promise<string[]> {
    const linhas = await this.db.select<{ ano: string }[]>(
      `SELECT DISTINCT substr(data, 1, 4) AS ano FROM servicos WHERE ${BASE} ORDER BY ano DESC`,
    );
    return linhas.map((linha) => linha.ano);
  }

  /**
   * Mín/média/máx de trocas por dia, mês ou ano. O balde corrente (mês/dia de
   * hoje, ainda incompleto) fica de fora para não distorcer o mínimo.
   */
  async resumoDeTrocas(
    por: AgrupamentoDeTrocas,
    periodo?: PeriodoDeAnos,
  ): Promise<ResumoMinMediaMax | null> {
    const filtro = this.filtroDaBase(periodo);
    const hoje = hojeIso();
    const incompleto: Record<AgrupamentoDeTrocas, { clausula: string; parametro: string | null }> =
      {
        dia: { clausula: `AND data < $${filtro.parametros.length + 1}`, parametro: hoje },
        mes: {
          clausula: `AND substr(data, 1, 7) < $${filtro.parametros.length + 1}`,
          parametro: hoje.slice(0, 7),
        },
        ano: { clausula: "", parametro: null },
      };
    const corte = incompleto[por];
    const parametros =
      corte.parametro === null ? filtro.parametros : [...filtro.parametros, corte.parametro];
    const linhas = await this.db.select<
      { minimo: number | null; media: number | null; maximo: number | null }[]
    >(
      `SELECT MIN(total) AS minimo, AVG(total) AS media, MAX(total) AS maximo FROM (
         SELECT COUNT(*) AS total FROM servicos
         WHERE ${filtro.where} ${corte.clausula}
         GROUP BY ${EXPRESSAO_DO_AGRUPAMENTO[por]}
       )`,
      parametros,
    );
    return this.paraResumo(linhas[0]);
  }

  /** Quem volta, quem não volta e as visitas por carro — um GROUP BY só. */
  async retornoDeClientes(periodo?: PeriodoDeAnos): Promise<RetornoDeClientes> {
    const filtro = this.filtroDaBase(periodo);
    const linhas = await this.db.select<
      {
        voltam: number | null;
        nao_voltam: number | null;
        total: number;
        minimo: number | null;
        media: number | null;
        maximo: number | null;
      }[]
    >(
      `SELECT SUM(CASE WHEN visitas > 1 THEN 1 ELSE 0 END) AS voltam,
              SUM(CASE WHEN visitas = 1 THEN 1 ELSE 0 END) AS nao_voltam,
              COUNT(*) AS total,
              MIN(visitas) AS minimo, AVG(visitas) AS media, MAX(visitas) AS maximo
       FROM (
         SELECT COUNT(*) AS visitas FROM servicos
         WHERE ${filtro.where} AND placa <> ''
         GROUP BY placa
       )`,
      filtro.parametros,
    );
    const linha = linhas[0];
    return {
      voltam: linha?.voltam ?? 0,
      naoVoltam: linha?.nao_voltam ?? 0,
      total: linha?.total ?? 0,
      visitasPorCarro: this.paraResumo(linha),
    };
  }

  /** Mín/média/máx por mês do calendário cruzando os anos (sazonalidade). */
  async sazonalidade(mesAtualIso: string, periodo?: PeriodoDeAnos): Promise<SazonalidadeDoMes[]> {
    const filtro = this.filtroDaBase(periodo);
    return this.db.select<SazonalidadeDoMes[]>(
      `SELECT mes, MIN(total) AS minimo, AVG(total) AS media, MAX(total) AS maximo FROM (
         SELECT substr(data, 6, 2) AS mes, substr(data, 1, 4) AS ano, COUNT(*) AS total
         FROM servicos
         WHERE ${filtro.where} AND substr(data, 1, 7) < $${filtro.parametros.length + 1}
         GROUP BY ano, mes
       )
       GROUP BY mes ORDER BY mes`,
      [...filtro.parametros, mesAtualIso],
    );
  }

  async comparativoDoMes(mesAtualIso: string, mesAnoPassadoIso: string): Promise<ComparativoDoMes> {
    const linhas = await this.db.select<
      { mes_atual: number | null; mes_ano_passado: number | null }[]
    >(
      `SELECT SUM(CASE WHEN substr(data, 1, 7) = $1 THEN 1 ELSE 0 END) AS mes_atual,
              SUM(CASE WHEN substr(data, 1, 7) = $2 THEN 1 ELSE 0 END) AS mes_ano_passado
       FROM servicos WHERE ${BASE}`,
      [mesAtualIso, mesAnoPassadoIso],
    );
    return {
      mesAtual: linhas[0]?.mes_atual ?? 0,
      mesAnoPassado: linhas[0]?.mes_ano_passado ?? 0,
    };
  }

  /**
   * Carros na primeira visita da vida vs. já conhecidos, por ano. O mesmo
   * carro conta uma vez por ano, como em placasDistintasPorAno — as duas
   * parcelas de um ano somam exatamente aquele total. No primeiro ano da
   * base todo carro é "novo" por definição.
   */
  async novosERecorrentesPorAno(): Promise<NovosERecorrentesNoAno[]> {
    return this.db.select<NovosERecorrentesNoAno[]>(
      `SELECT ano,
              SUM(CASE WHEN ano = primeiro_ano THEN 1 ELSE 0 END) AS novos,
              SUM(CASE WHEN ano > primeiro_ano THEN 1 ELSE 0 END) AS recorrentes
       FROM (
         SELECT ano, MIN(ano) OVER (PARTITION BY placa) AS primeiro_ano
         FROM (SELECT DISTINCT substr(data, 1, 4) AS ano, placa
               FROM servicos WHERE ${BASE} AND placa <> '')
       )
       GROUP BY ano ORDER BY ano`,
    );
  }

  /**
   * Dos carros que estrearam em cada ano, quantos voltaram alguma vez depois
   * (serviço em outra data, mesmo que no mesmo ano). Lançamentos duplicados
   * no mesmo dia não contam como retorno — o critério dos intervalos.
   */
  async retornoDosNovosPorAno(): Promise<RetornoDosNovosNoAno[]> {
    return this.db.select<RetornoDosNovosNoAno[]>(
      `SELECT substr(primeira, 1, 4) AS ano,
              COUNT(*) AS novos,
              SUM(CASE WHEN datas > 1 THEN 1 ELSE 0 END) AS voltaram
       FROM (
         SELECT MIN(data) AS primeira, COUNT(DISTINCT data) AS datas
         FROM servicos WHERE ${BASE} AND placa <> ''
         GROUP BY placa
       )
       GROUP BY ano ORDER BY ano`,
    );
  }

  async trocasPorDiaDaSemana(periodo?: PeriodoDeAnos): Promise<TotalPorDiaDaSemana[]> {
    const filtro = this.filtroDaBase(periodo);
    return this.db.select<TotalPorDiaDaSemana[]>(
      `SELECT strftime('%w', data) AS dia, COUNT(*) AS total
       FROM servicos WHERE ${filtro.where}
       GROUP BY dia ORDER BY dia`,
      filtro.parametros,
    );
  }

  /**
   * Contagem por ano dos produtos mais usados de toda a base (top `limite`).
   * O top é global de propósito: as mesmas linhas atravessam todos os anos e
   * mostram o mix migrando — um top por ano trocaria as linhas no meio.
   */
  async produtosPorAno(limite: number): Promise<ProdutoNoAno[]> {
    return this.db.select<ProdutoNoAno[]>(
      `WITH top AS (
         SELECT produto FROM servicos WHERE ${BASE} AND produto <> ''
         GROUP BY produto ORDER BY COUNT(*) DESC, produto LIMIT $1
       )
       SELECT produto, substr(data, 1, 4) AS ano, COUNT(*) AS total
       FROM servicos
       WHERE ${BASE} AND produto IN (SELECT produto FROM top)
       GROUP BY produto, ano ORDER BY ano, produto`,
      [limite],
    );
  }

  async topProdutos(limite: number, periodo?: PeriodoDeAnos): Promise<ProdutoMaisUsado[]> {
    const filtro = this.filtroDaBase(periodo);
    return this.db.select<ProdutoMaisUsado[]>(
      `SELECT produto, COUNT(*) AS total FROM servicos
       WHERE ${filtro.where} AND produto <> ''
       GROUP BY produto ORDER BY total DESC, produto
       LIMIT $${filtro.parametros.length + 1}`,
      [...filtro.parametros, limite],
    );
  }

  // ---------- Privados ----------

  private filtroDaBase(periodo?: PeriodoDeAnos): FiltroDeBase {
    if (periodo === undefined) return { where: BASE, parametros: [] };
    return {
      where: `${BASE} AND substr(data, 1, 4) BETWEEN $1 AND $2`,
      parametros: [periodo.deAno, periodo.ateAno],
    };
  }

  /**
   * Dias entre visitas consecutivas da mesma placa (janela LAG). A primeira
   * visita sai com dias NULL e lançamentos do mesmo dia com dias 0 — quem
   * consome filtra com "dias > 0".
   */
  private sqlDeIntervalos(where: string): string {
    return `SELECT substr(data, 1, 4) AS ano,
              julianday(data) - julianday(LAG(data) OVER (PARTITION BY placa ORDER BY data, id)) AS dias
            FROM servicos WHERE ${where} AND placa <> ''`;
  }

  private paraResumo(
    linha: { minimo: number | null; media: number | null; maximo: number | null } | undefined,
  ): ResumoMinMediaMax | null {
    if (linha === undefined || linha.minimo === null || linha.media === null || linha.maximo === null) {
      return null;
    }
    return { minimo: linha.minimo, media: linha.media, maximo: linha.maximo };
  }
}
