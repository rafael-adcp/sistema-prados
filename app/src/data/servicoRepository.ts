import type Database from "@tauri-apps/plugin-sql";
import type { Busca } from "../domain/interpretarBusca";
import { normalizarKm } from "../domain/km";
import { normalizarPlaca } from "../domain/placa";
import type { NovoServico, Servico } from "../domain/servico";

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

interface FiltroSql {
  where: string;
  parametros: unknown[];
  ordem: string;
}

/**
 * Única porta de acesso ao SQL do app: nenhuma tela monta query.
 * Recebe o Database pronto (injeção), então é trocável por um fake nos testes.
 */
export class ServicoRepository {
  constructor(private readonly db: Database) {}

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

  async ultimaTroca(placa: string): Promise<Servico | null> {
    const linhas = await this.db.select<LinhaServico[]>(
      `SELECT ${COLUNAS} FROM servicos WHERE placa = $1 ORDER BY data DESC, id DESC LIMIT 1`,
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
       VALUES ($1, $2, $3, $4, $5, $6, 0)`,
      [
        novo.carro.trim(),
        normalizarKm(novo.kmRaw),
        novo.kmRaw.trim(),
        normalizarPlaca(novo.placa),
        novo.produto.trim(),
        novo.data,
      ],
    );
    return resultado.lastInsertId ?? 0;
  }

  async contarServicos(): Promise<number> {
    const linhas = await this.db.select<{ total: number }[]>(
      "SELECT COUNT(*) AS total FROM servicos",
    );
    return linhas[0]?.total ?? 0;
  }

  async lerConfig(chave: string): Promise<string | null> {
    const linhas = await this.db.select<{ valor: string }[]>(
      "SELECT valor FROM config WHERE chave = $1",
      [chave],
    );
    return linhas.length > 0 ? linhas[0].valor : null;
  }

  async gravarConfig(chave: string, valor: string): Promise<void> {
    await this.db.execute(
      "INSERT INTO config (chave, valor) VALUES ($1, $2) ON CONFLICT(chave) DO UPDATE SET valor = $2",
      [chave, valor],
    );
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
      case "texto": {
        const padrao = `%${busca.termo.trim()}%`;
        return {
          where: "WHERE (carro LIKE $1 OR produto LIKE $1 OR placa LIKE $1)",
          parametros: [padrao],
          ordem: "ORDER BY data DESC, id DESC",
        };
      }
      case "carro":
        return {
          where: "WHERE carro LIKE $1",
          parametros: [`%${busca.termo.trim()}%`],
          ordem: "ORDER BY data DESC, id DESC",
        };
    }
  }
}
