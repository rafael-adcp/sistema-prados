import type { Busca } from "../domain/busca";
import { dataEhSuspeita, hojeIso } from "../domain/datas";
import type { ServicoImportado } from "../domain/importarAccess";
import { normalizarKm } from "../domain/km";
import { normalizarPlaca } from "../domain/placa";
import type { NovoServico, Servico } from "../domain/servico";
import type { PortaDoBanco } from "./portaDoBanco";

export interface PaginaDeServicos {
  itens: Servico[];
  total: number;
}

export interface SugestaoDePlaca {
  placa: string;
  carro: string;
  data: string | null;
}

interface LinhaServico {
  id: number;
  carro: string;
  km: number | null;
  km_raw: string;
  placa: string;
  produto: string;
  data: string | null;
  data_suspeita: number;
}

const COLUNAS = "id, carro, km, km_raw, placa, produto, data, data_suspeita";
/** Limite superior de um range de prefixo (maior que qualquer caractere de placa). */
const FIM_DO_PREFIXO = "￿";

function paraServico(linha: LinhaServico): Servico {
  return {
    id: linha.id,
    carro: linha.carro,
    km: linha.km,
    kmRaw: linha.km_raw,
    placa: linha.placa,
    produto: linha.produto,
    data: linha.data,
    dataSuspeita: linha.data_suspeita === 1,
  };
}

/** %/_ são curingas do LIKE; escapados, buscar "50%" acha só "50%". */
function padraoLike(termo: string): string {
  return `%${termo.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

interface FiltroSql {
  where: string;
  parametros: unknown[];
  ordem: string;
}

/**
 * Porta de acesso ao SQL de serviços: nenhuma tela monta query.
 * Recebe o Database pronto (injeção), então é trocável por um fake nos testes.
 */
export class ServicoRepository {
  constructor(private readonly db: PortaDoBanco) {}

  async buscar(busca: Busca, pagina: number, porPagina: number): Promise<PaginaDeServicos> {
    const filtro = this.filtroPara(busca);
    const [linhaTotal, itens] = await Promise.all([
      this.db.select<{ total: number }[]>(
        `SELECT COUNT(*) AS total FROM servicos ${filtro.where}`,
        filtro.parametros,
      ),
      this.db.select<LinhaServico[]>(
        `SELECT ${COLUNAS} FROM servicos ${filtro.where} ${filtro.ordem} LIMIT $${filtro.parametros.length + 1} OFFSET $${filtro.parametros.length + 2}`,
        [...filtro.parametros, porPagina, pagina * porPagina],
      ),
    ]);
    return { itens: itens.map(paraServico), total: linhaTotal[0]?.total ?? 0 };
  }

  /** Registros com data suspeita nunca vencem registros confiáveis. */
  async ultimaTroca(placa: string): Promise<Servico | null> {
    const linhas = await this.db.select<LinhaServico[]>(
      `SELECT ${COLUNAS} FROM servicos WHERE placa = $1 ORDER BY data_suspeita ASC, data DESC, id DESC LIMIT 1`,
      [normalizarPlaca(placa)],
    );
    return linhas.length > 0 ? paraServico(linhas[0]) : null;
  }

  async contarPorPlaca(placa: string): Promise<number> {
    const linhas = await this.db.select<{ total: number }[]>(
      "SELECT COUNT(*) AS total FROM servicos WHERE placa = $1",
      [normalizarPlaca(placa)],
    );
    return linhas[0]?.total ?? 0;
  }

  async historico(placa: string): Promise<Servico[]> {
    const linhas = await this.db.select<LinhaServico[]>(
      `SELECT ${COLUNAS} FROM servicos WHERE placa = $1 ORDER BY data DESC, id DESC`,
      [normalizarPlaca(placa)],
    );
    return linhas.map(paraServico);
  }

  /** Placas que começam com o prefixo, das visitas mais recentes para as antigas. */
  async sugestoesDePlaca(prefixo: string, limite: number): Promise<SugestaoDePlaca[]> {
    return this.db.select<SugestaoDePlaca[]>(
      `SELECT s.placa, s.carro, s.data
       FROM servicos s
       JOIN (
         SELECT placa, MAX(id) AS ultimo_id
         FROM servicos
         WHERE placa >= $1 AND placa < $2 AND placa <> ''
         GROUP BY placa
       ) u ON s.id = u.ultimo_id
       ORDER BY u.ultimo_id DESC
       LIMIT $3`,
      [prefixo, prefixo + FIM_DO_PREFIXO, limite],
    );
  }

  async inserir(novo: NovoServico): Promise<number> {
    const resultado = await this.db.execute(
      `INSERT INTO servicos (carro, km, km_raw, placa, produto, data, data_suspeita)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        novo.carro.trim().toUpperCase(),
        normalizarKm(novo.kmRaw),
        novo.kmRaw.trim(),
        normalizarPlaca(novo.placa),
        novo.produto.trim().toUpperCase(),
        novo.data,
        dataEhSuspeita(novo.data, hojeIso()) ? 1 : 0,
      ],
    );
    return resultado.lastInsertId ?? 0;
  }

  async atualizar(id: number, dados: NovoServico): Promise<void> {
    const data = dados.data === "" ? null : dados.data;
    await this.db.execute(
      `UPDATE servicos
       SET carro = $1, km = $2, km_raw = $3, placa = $4, produto = $5, data = $6, data_suspeita = $7
       WHERE id = $8`,
      [
        dados.carro.trim().toUpperCase(),
        normalizarKm(dados.kmRaw),
        dados.kmRaw.trim(),
        normalizarPlaca(dados.placa),
        dados.produto.trim().toUpperCase(),
        data,
        dataEhSuspeita(data, hojeIso()) ? 1 : 0,
        id,
      ],
    );
  }

  async excluir(id: number): Promise<void> {
    await this.db.execute("DELETE FROM servicos WHERE id = $1", [id]);
  }

  async contarServicos(): Promise<number> {
    const linhas = await this.db.select<{ total: number }[]>(
      "SELECT COUNT(*) AS total FROM servicos",
    );
    return linhas[0]?.total ?? 0;
  }

  /**
   * Importação inicial: apaga tudo e insere em lotes preservando os códigos
   * originais do Access. Sem transação explícita (o pool do plugin não garante
   * a mesma conexão entre chamadas) — se falhar no meio, repetir a importação
   * recomeça do zero e resolve.
   */
  async substituirTodosPor(
    servicos: ServicoImportado[],
    aoProgredir?: (feitos: number) => void,
  ): Promise<number> {
    const LOTE = 100;
    await this.db.execute("DELETE FROM servicos");
    for (let inicio = 0; inicio < servicos.length; inicio += LOTE) {
      const lote = servicos.slice(inicio, inicio + LOTE);
      const espacos = lote
        .map((_, i) => {
          const base = i * 8;
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
        })
        .join(", ");
      const parametros = lote.flatMap((servico) => [
        servico.id,
        servico.carro,
        servico.km,
        servico.kmRaw,
        servico.placa,
        servico.produto,
        servico.data,
        servico.dataSuspeita ? 1 : 0,
      ]);
      await this.db.execute(
        `INSERT INTO servicos (id, carro, km, km_raw, placa, produto, data, data_suspeita) VALUES ${espacos}`,
        parametros,
      );
      aoProgredir?.(Math.min(inicio + LOTE, servicos.length));
    }
    return servicos.length;
  }

  private filtroPara(busca: Busca): FiltroSql {
    switch (busca.tipo) {
      case "vazia":
        return { where: "", parametros: [], ordem: "ORDER BY id DESC" };
      case "placa":
        return {
          where: "WHERE placa >= $1 AND placa < $2",
          parametros: [busca.prefixo, busca.prefixo + FIM_DO_PREFIXO],
          ordem: "ORDER BY data DESC, id DESC",
        };
      case "data":
        return {
          where: "WHERE data >= $1 AND data <= $2",
          parametros: [busca.de, busca.ate],
          ordem: "ORDER BY data DESC, id DESC",
        };
      case "texto":
        return {
          where: "WHERE (carro LIKE $1 ESCAPE '\\' OR produto LIKE $1 ESCAPE '\\' OR placa LIKE $1 ESCAPE '\\')",
          parametros: [padraoLike(busca.termo)],
          ordem: "ORDER BY data DESC, id DESC",
        };
      case "carro":
        return {
          where: "WHERE carro LIKE $1 ESCAPE '\\'",
          parametros: [padraoLike(busca.termo)],
          ordem: "ORDER BY data DESC, id DESC",
        };
    }
  }
}
