import {
  FAIXAS_DE_RETORNO,
  type PeriodoDeAnos,
  type ResumoMinMediaMax,
  type RetornoNoAno,
} from "../domain/analises";
import { hojeIso } from "../domain/datas";
import type { Servico } from "../domain/servico";
import type { PortaDoBanco } from "./portaDoBanco";
import { COLUNAS, paraServico, type LinhaServico } from "./servicoRepository";

/** Registros que entram nas contas: com data e sem suspeita de digitação. */
const BASE = "data IS NOT NULL AND data_suspeita = 0";

/** Padrões brasileiros de placa na forma canônica (maiúscula, sem hífen). */
const GLOB_PLACA_ANTIGA = "[A-Z][A-Z][A-Z][0-9][0-9][0-9][0-9]";
const GLOB_PLACA_MERCOSUL = "[A-Z][A-Z][A-Z][0-9][A-Z][0-9][0-9]";

const GRUPOS_DUPLICADOS = `SELECT placa, data, produto FROM servicos
       WHERE placa <> '' AND data IS NOT NULL AND produto <> ''
       GROUP BY placa, data, produto HAVING COUNT(*) > 1`;

export type InconsistenciaListavel =
  | "semData"
  | "dataNoFuturo"
  | "dataAntesDe2000"
  | "semPlaca"
  | "placaForaDoPadrao"
  | "semKm"
  | "kmIlegivel"
  | "semProduto"
  | "semCarro"
  | "possiveisDuplicados";

export type ContagensDeInconsistencias = Record<
  InconsistenciaListavel | "mesmaPlacaCarrosDiferentes",
  number
>;

/**
 * O WHERE de cada relatório de inconsistência — contagem e listagem usam o
 * MESMO filtro, então os números do título sempre batem com a tabela.
 * "dataNoFuturo" é o único que precisa de parâmetro ($1 = hoje).
 */
const FILTRO_DA_INCONSISTENCIA: Record<InconsistenciaListavel, string> = {
  semData: "data IS NULL",
  dataNoFuturo: "data IS NOT NULL AND data > $1",
  dataAntesDe2000: "data IS NOT NULL AND data < '2000-01-01'",
  semPlaca: "placa = ''",
  placaForaDoPadrao: `placa <> '' AND placa NOT GLOB '${GLOB_PLACA_ANTIGA}' AND placa NOT GLOB '${GLOB_PLACA_MERCOSUL}'`,
  semKm: "km IS NULL AND km_raw = ''",
  kmIlegivel: "km IS NULL AND km_raw <> ''",
  semProduto: "produto = ''",
  semCarro: "carro = ''",
  possiveisDuplicados: `(placa, data, produto) IN (${GRUPOS_DUPLICADOS})`,
};

export interface BaseDeAnalise {
  total: number;
  validos: number;
}

export interface PlacaComVariacoes {
  placa: string;
  variacoes: number;
  carros: string;
}

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
 * Todo o SQL de agregação e de qualidade de dados da aba Análises.
 * Só leitura — correções passam pelo ServicoRepository, como nas outras telas.
 */
export class AnaliseRepository {
  constructor(private readonly db: PortaDoBanco) {}

  // ---------- Qualidade dos dados ----------

  async contarBase(): Promise<BaseDeAnalise> {
    const linhas = await this.db.select<{ total: number; validos: number | null }[]>(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN ${BASE} THEN 1 ELSE 0 END) AS validos FROM servicos`,
    );
    return { total: linhas[0]?.total ?? 0, validos: linhas[0]?.validos ?? 0 };
  }

  async contarInconsistencias(): Promise<ContagensDeInconsistencias> {
    const somas = (Object.keys(FILTRO_DA_INCONSISTENCIA) as InconsistenciaListavel[])
      .filter((tipo) => tipo !== "possiveisDuplicados")
      .map((tipo) => `SUM(CASE WHEN ${FILTRO_DA_INCONSISTENCIA[tipo]} THEN 1 ELSE 0 END) AS ${tipo}`)
      .join(", ");
    const [linhas, duplicados, placasDiferentes] = await Promise.all([
      this.db.select<Record<string, number | null>[]>(`SELECT ${somas} FROM servicos`, [hojeIso()]),
      this.db.select<{ total: number | null }[]>(
        `SELECT SUM(repetidos) AS total FROM (
           SELECT COUNT(*) AS repetidos FROM servicos
           WHERE placa <> '' AND data IS NOT NULL AND produto <> ''
           GROUP BY placa, data, produto HAVING COUNT(*) > 1
         )`,
      ),
      this.db.select<{ total: number }[]>(
        `SELECT COUNT(*) AS total FROM (
           SELECT placa FROM servicos WHERE placa <> '' AND carro <> ''
           GROUP BY placa HAVING COUNT(DISTINCT carro) > 1
         )`,
      ),
    ]);
    const linha = linhas[0] ?? {};
    return {
      semData: linha.semData ?? 0,
      dataNoFuturo: linha.dataNoFuturo ?? 0,
      dataAntesDe2000: linha.dataAntesDe2000 ?? 0,
      semPlaca: linha.semPlaca ?? 0,
      placaForaDoPadrao: linha.placaForaDoPadrao ?? 0,
      semKm: linha.semKm ?? 0,
      kmIlegivel: linha.kmIlegivel ?? 0,
      semProduto: linha.semProduto ?? 0,
      semCarro: linha.semCarro ?? 0,
      possiveisDuplicados: duplicados[0]?.total ?? 0,
      mesmaPlacaCarrosDiferentes: placasDiferentes[0]?.total ?? 0,
    };
  }

  async listarInconsistencia(tipo: InconsistenciaListavel, limite: number): Promise<Servico[]> {
    const parametros: unknown[] = tipo === "dataNoFuturo" ? [hojeIso()] : [];
    // Duplicados saem agrupados (placa/data juntas); os demais, do mais recente ao mais antigo.
    const ordem = tipo === "possiveisDuplicados" ? "ORDER BY placa, data, id" : "ORDER BY id DESC";
    const linhas = await this.db.select<LinhaServico[]>(
      `SELECT ${COLUNAS} FROM servicos WHERE ${FILTRO_DA_INCONSISTENCIA[tipo]}
       ${ordem} LIMIT $${parametros.length + 1}`,
      [...parametros, limite],
    );
    return linhas.map(paraServico);
  }

  async listarPlacasComCarrosDiferentes(limite: number): Promise<PlacaComVariacoes[]> {
    return this.db.select<PlacaComVariacoes[]>(
      `SELECT placa, COUNT(*) AS variacoes, GROUP_CONCAT(carro, ' · ') AS carros FROM (
         SELECT placa, carro FROM servicos WHERE placa <> '' AND carro <> ''
         GROUP BY placa, carro ORDER BY placa, carro
       )
       GROUP BY placa HAVING COUNT(*) > 1
       ORDER BY variacoes DESC, placa LIMIT $1`,
      [limite],
    );
  }

  // ---------- Números da oficina ----------

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

  /** Placas distintas por ano: o mesmo carro no mesmo dia conta uma vez só. */
  async placasDistintasPorAno(periodo?: PeriodoDeAnos): Promise<TotalPorAno[]> {
    const filtro = this.filtroDaBase(periodo);
    return this.db.select<TotalPorAno[]>(
      `SELECT ano, COUNT(*) AS total FROM (
         SELECT DISTINCT substr(data, 1, 4) AS ano, placa, data
         FROM servicos WHERE ${filtro.where} AND placa <> ''
       )
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
