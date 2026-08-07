import type { RetornoPorProduto } from "../../data/analiseRepository";
import { emDias, inteiro } from "./numerosDaOficina";

interface Props {
  titulo: string;
  linhas: RetornoPorProduto[];
}

/** Quantos dias o carro leva para voltar, conforme o produto da troca anterior. */
export function TabelaRetornoPorProduto({ titulo, linhas }: Props) {
  return (
    <div className="tabela-kpi">
      <h3>{titulo}</h3>
      {linhas.length === 0 ? (
        <p className="estado-vazio">Nenhum retorno registrado.</p>
      ) : (
        <table className="tabela-servicos">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Retornos</th>
              <th>Média para voltar</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.produto}>
                <td>{linha.produto}</td>
                <td>{inteiro(linha.retornos)}</td>
                <td>{emDias(linha.media)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
