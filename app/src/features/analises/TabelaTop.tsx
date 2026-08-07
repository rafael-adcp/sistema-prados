import type { ItemMaisUsado } from "../../data/analiseRepository";
import { inteiro } from "./numerosDaOficina";

interface Props {
  titulo: string;
  /** Cabeçalho da coluna de nomes: "Produto", "Carro"… */
  coluna: string;
  linhas: ItemMaisUsado[];
  vazio: string;
}

/** Ranking simples de nome × vezes — produtos e carros usam a mesma. */
export function TabelaTop({ titulo, coluna, linhas, vazio }: Props) {
  return (
    <div className="tabela-kpi">
      <h3>{titulo}</h3>
      {linhas.length === 0 ? (
        <p className="estado-vazio">{vazio}</p>
      ) : (
        <table className="tabela-servicos">
          <thead>
            <tr>
              <th>{coluna}</th>
              <th>Vezes</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.nome}>
                <td>{linha.nome}</td>
                <td>{inteiro(linha.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
