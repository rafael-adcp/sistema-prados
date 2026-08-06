import type { ResumoMinMediaMax } from "../../domain/analises";

export interface LinhaKpi {
  rotulo: string;
  resumo: ResumoMinMediaMax | null;
}

interface Props {
  titulo: string;
  linhas: LinhaKpi[];
  formatar?: (valor: number) => string;
}

const formatarPadrao = (valor: number) =>
  valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** Tabela burra de mín/média/máx — KPIs e sazonalidade usam a mesma. */
export function TabelaKpi({ titulo, linhas, formatar }: Props) {
  const formatarValor = formatar ?? formatarPadrao;
  return (
    <div className="tabela-kpi">
      <h3>{titulo}</h3>
      <table className="tabela-servicos">
        <thead>
          <tr>
            <th />
            <th>Mínimo</th>
            <th>Média</th>
            <th>Máximo</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr key={linha.rotulo}>
              <th scope="row">{linha.rotulo}</th>
              {linha.resumo === null ? (
                <td colSpan={3}>—</td>
              ) : (
                <>
                  <td>{formatarValor(linha.resumo.minimo)}</td>
                  <td>{formatarValor(linha.resumo.media)}</td>
                  <td>{formatarValor(linha.resumo.maximo)}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
