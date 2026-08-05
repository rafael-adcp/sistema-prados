import { formatarDataBr } from "../domain/datas";
import { formatarKm } from "../domain/km";
import type { Servico } from "../domain/servico";

interface Props {
  itens: Servico[];
  aoClicarNaPlaca?: (placa: string) => void;
  aoClicarNaLinha?: (servico: Servico) => void;
}

/** Tabela burra e reutilizável: Consultas, Histórico e Relatórios usam a mesma. */
export function TabelaServicos({ itens, aoClicarNaPlaca, aoClicarNaLinha }: Props) {
  if (itens.length === 0) {
    return <p className="estado-vazio">Nenhum serviço encontrado.</p>;
  }
  const clicavel = aoClicarNaLinha !== undefined;
  return (
    <table className={clicavel ? "tabela-servicos linhas-clicaveis" : "tabela-servicos"}>
      <thead>
        <tr>
          <th>Data</th>
          <th>Placa</th>
          <th>Carro</th>
          <th>Km</th>
          <th>Produto / Serviço</th>
        </tr>
      </thead>
      <tbody>
        {itens.map((servico) => (
          <tr
            key={servico.id}
            title={clicavel ? "Clique para editar este serviço" : undefined}
            onClick={clicavel ? () => aoClicarNaLinha(servico) : undefined}
          >
            <td className="col-data">
              {formatarDataBr(servico.data)}
              {servico.dataSuspeita && (
                <span className="badge-suspeita" title="Data provavelmente digitada errada no sistema antigo">
                  ?
                </span>
              )}
            </td>
            <td className="col-placa">
              {servico.placa !== "" && aoClicarNaPlaca ? (
                <button
                  type="button"
                  className="link-placa"
                  title="Ver histórico deste veículo"
                  onClick={(evento) => {
                    evento.stopPropagation();
                    aoClicarNaPlaca(servico.placa);
                  }}
                >
                  {servico.placa}
                </button>
              ) : (
                servico.placa || "—"
              )}
            </td>
            <td>{servico.carro || "—"}</td>
            <td className="col-km">{formatarKm(servico.km, servico.kmRaw) || "—"}</td>
            <td>{servico.produto || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
