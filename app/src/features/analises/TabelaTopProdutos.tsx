import type { ProdutoMaisUsado } from "../../data/analiseRepository";
import { inteiro } from "./numerosDaOficina";

interface Props {
  titulo: string;
  linhas: ProdutoMaisUsado[];
}

/** Estava inline no meio da seção; sozinho, cabe na tela e tem nome. */
export function TabelaTopProdutos({ titulo, linhas }: Props) {
  return (
    <div className="tabela-kpi">
      <h3>{titulo}</h3>
      {linhas.length === 0 ? (
        <p className="estado-vazio">Nenhum produto registrado.</p>
      ) : (
        <table className="tabela-servicos">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Vezes</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.produto}>
                <td>{linha.produto}</td>
                <td>{inteiro(linha.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
