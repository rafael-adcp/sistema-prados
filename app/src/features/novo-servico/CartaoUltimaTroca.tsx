import { formatarDataBr } from "../../domain/datas";
import { formatarKm } from "../../domain/km";
import type { Servico } from "../../domain/servico";

interface Props {
  servico: Servico;
  totalDeVisitas: number;
  aoVerHistorico: (placa: string) => void;
}

/** O ouro do sistema: o que foi feito da última vez que este carro veio. */
export function CartaoUltimaTroca({ servico, totalDeVisitas, aoVerHistorico }: Props) {
  return (
    <aside className="cartao-ultima-troca">
      <h3>Última troca desta placa</h3>
      <p className="ultima-troca-produto">{servico.produto || "—"}</p>
      <p>
        {formatarDataBr(servico.data)}
        {servico.dataSuspeita && (
          <span className="badge-suspeita" title="Data provavelmente digitada errada no sistema antigo">
            ?
          </span>
        )}{" "}
        · {formatarKm(servico.km, servico.kmRaw) || "km não informado"}
      </p>
      <p className="ultima-troca-carro">{servico.carro}</p>
      <button type="button" className="botao-secundario" onClick={() => aoVerHistorico(servico.placa)}>
        Ver histórico completo ({totalDeVisitas.toLocaleString("pt-BR")} visita{totalDeVisitas === 1 ? "" : "s"})
      </button>
    </aside>
  );
}
