import { hojeIso } from "../domain/datas";
import type { Servico } from "../domain/servico";
import { BASE } from "./baseDeAnalise";
import type { PortaDoBanco } from "./portaDoBanco";
import { COLUNAS, paraServico, type LinhaServico } from "./servicoRepository";

/** Padrões brasileiros de placa na forma canônica (maiúscula, sem hífen). */
const GLOB_PLACA_ANTIGA = "[A-Z][A-Z][A-Z][0-9][0-9][0-9][0-9]";
const GLOB_PLACA_MERCOSUL = "[A-Z][A-Z][A-Z][0-9][A-Z][0-9][0-9]";

/**
 * O que é um "possível duplicado", em um lugar só. A listagem e a contagem
 * derivam daqui: escritas em separado, elas podiam divergir e fazer o título
 * dizer 300 enquanto a tabela mostrava 180.
 */
const AGRUPAMENTO_DE_DUPLICADOS = `FROM servicos
       WHERE placa <> '' AND data IS NOT NULL AND produto <> ''
       GROUP BY placa, data, produto HAVING COUNT(*) > 1`;

const GRUPOS_DUPLICADOS = `SELECT placa, data, produto ${AGRUPAMENTO_DE_DUPLICADOS}`;

/** Soma quantas LINHAS estão nos grupos repetidos (não quantos grupos existem). */
const CONTAGEM_DE_DUPLICADOS = `SELECT SUM(repetidos) AS total FROM (
         SELECT COUNT(*) AS repetidos ${AGRUPAMENTO_DE_DUPLICADOS}
       )`;

const PLACAS_COM_CARROS_DIFERENTES = `SELECT placa, carro FROM servicos
         WHERE placa <> '' AND carro <> ''
         GROUP BY placa, carro`;

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

export interface BaseDeAnalise {
  total: number;
  validos: number;
}

export interface PlacaComVariacoes {
  placa: string;
  variacoes: number;
  carros: string;
}

/**
 * Um relatório de inconsistência descrito inteiro num lugar só: o WHERE, os
 * parâmetros que ele precisa e como ordena. Antes, "parâmetro" e "ordem" eram
 * dois `if` sobre o tipo espalhados pelo método — acrescentar o 12º relatório
 * exigia lembrar de três pontos além desta tabela.
 */
interface RelatorioDeInconsistencia {
  where: string;
  parametros?: () => unknown[];
  ordem?: string;
  /** Cai fora do SELECT de somas: o IN por linha é caro sobre 140 mil registros. */
  contadoSeparadamente?: true;
}

const RELATORIOS: Record<InconsistenciaListavel, RelatorioDeInconsistencia> = {
  semData: { where: "data IS NULL" },
  dataNoFuturo: { where: "data IS NOT NULL AND data > $1", parametros: () => [hojeIso()] },
  dataAntesDe2000: { where: "data IS NOT NULL AND data < '2000-01-01'" },
  semPlaca: { where: "placa = ''" },
  placaForaDoPadrao: {
    where: `placa <> '' AND placa NOT GLOB '${GLOB_PLACA_ANTIGA}' AND placa NOT GLOB '${GLOB_PLACA_MERCOSUL}'`,
  },
  semKm: { where: "km IS NULL AND km_raw = ''" },
  kmIlegivel: { where: "km IS NULL AND km_raw <> ''" },
  semProduto: { where: "produto = ''" },
  semCarro: { where: "carro = ''" },
  possiveisDuplicados: {
    where: `(placa, data, produto) IN (${GRUPOS_DUPLICADOS})`,
    ordem: "ORDER BY placa, data, id",
    contadoSeparadamente: true,
  },
};

/**
 * A aba "Qualidade dos dados": conta e lista os registros inconsistentes que
 * vieram do sistema antigo. Só leitura — as correções passam pelo
 * ServicoRepository, como em qualquer outra tela.
 */
export class QualidadeRepository {
  constructor(private readonly db: PortaDoBanco) {}

  async contarBase(): Promise<BaseDeAnalise> {
    const linhas = await this.db.select<{ total: number; validos: number | null }[]>(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN ${BASE} THEN 1 ELSE 0 END) AS validos FROM servicos`,
    );
    return { total: linhas[0]?.total ?? 0, validos: linhas[0]?.validos ?? 0 };
  }

  async contarInconsistencias(): Promise<ContagensDeInconsistencias> {
    const somaveis = (Object.keys(RELATORIOS) as InconsistenciaListavel[]).filter(
      (tipo) => RELATORIOS[tipo].contadoSeparadamente !== true,
    );
    const somas = somaveis
      .map((tipo) => `SUM(CASE WHEN ${RELATORIOS[tipo].where} THEN 1 ELSE 0 END) AS ${tipo}`)
      .join(", ");

    const [linhas, duplicados, placasDiferentes] = await Promise.all([
      this.db.select<Record<string, number | null>[]>(`SELECT ${somas} FROM servicos`, [hojeIso()]),
      this.db.select<{ total: number | null }[]>(CONTAGEM_DE_DUPLICADOS),
      this.db.select<{ total: number }[]>(
        `SELECT COUNT(*) AS total FROM (
           SELECT placa FROM servicos WHERE placa <> '' AND carro <> ''
           GROUP BY placa HAVING COUNT(DISTINCT carro) > 1
         )`,
      ),
    ]);

    const linha = linhas[0] ?? {};
    const contagens = Object.fromEntries(
      somaveis.map((tipo) => [tipo, linha[tipo] ?? 0]),
    ) as ContagensDeInconsistencias;
    return {
      ...contagens,
      possiveisDuplicados: duplicados[0]?.total ?? 0,
      mesmaPlacaCarrosDiferentes: placasDiferentes[0]?.total ?? 0,
    };
  }

  async listarInconsistencia(tipo: InconsistenciaListavel, limite: number): Promise<Servico[]> {
    const relatorio = RELATORIOS[tipo];
    const parametros = relatorio.parametros?.() ?? [];
    const ordem = relatorio.ordem ?? "ORDER BY id DESC";
    const linhas = await this.db.select<LinhaServico[]>(
      `SELECT ${COLUNAS} FROM servicos WHERE ${relatorio.where}
       ${ordem} LIMIT $${parametros.length + 1}`,
      [...parametros, limite],
    );
    return linhas.map(paraServico);
  }

  async listarPlacasComCarrosDiferentes(limite: number): Promise<PlacaComVariacoes[]> {
    return this.db.select<PlacaComVariacoes[]>(
      `SELECT placa, COUNT(*) AS variacoes, GROUP_CONCAT(carro, ' · ') AS carros FROM (
         ${PLACAS_COM_CARROS_DIFERENTES} ORDER BY placa, carro
       )
       GROUP BY placa HAVING COUNT(*) > 1
       ORDER BY variacoes DESC, placa LIMIT $1`,
      [limite],
    );
  }
}
