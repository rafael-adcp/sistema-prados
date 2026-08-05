import { useEffect, useState } from "react";
import { useRepositorio } from "../../data/ProvedorDeDados";
import { formatarDataBr, hojeIso } from "../../domain/datas";
import type { Servico } from "../../domain/servico";
import { Carregando } from "../../ui/Carregando";
import { TabelaServicos } from "../../ui/TabelaServicos";

interface Props {
  placa: string;
  aoVoltar: () => void;
}

export function HistoricoPage({ placa, aoVoltar }: Props) {
  const repositorio = useRepositorio();
  const [visitas, setVisitas] = useState<Servico[] | null>(null);

  useEffect(() => {
    let cancelada = false;
    repositorio
      .historico(placa)
      .then((encontradas) => {
        if (!cancelada) setVisitas(encontradas);
      })
      .catch((causa) => console.error("Histórico falhou:", causa));
    return () => {
      cancelada = true;
    };
  }, [repositorio, placa]);

  if (visitas === null) return <Carregando mensagem="Carregando histórico…" />;

  const primeira = visitas[visitas.length - 1];
  const carro = visitas.find((visita) => visita.carro !== "")?.carro ?? "—";

  return (
    <section>
      <div className="barra-de-acoes no-print">
        <button type="button" className="botao-secundario" onClick={aoVoltar}>
          ‹ Voltar
        </button>
        <button type="button" className="botao-secundario" onClick={() => window.print()}>
          🖨 Imprimir
        </button>
      </div>
      <header className="cabecalho-relatorio">
        <h2>Histórico do veículo {placa}</h2>
        <p>
          {carro} · {visitas.length.toLocaleString("pt-BR")} visita{visitas.length === 1 ? "" : "s"}
          {primeira !== undefined && ` · cliente desde ${formatarDataBr(primeira.data)}`}
        </p>
        <p className="so-impressao">
          Super Troca de Óleo Prado's — emitido em {formatarDataBr(hojeIso())}
        </p>
      </header>
      <TabelaServicos itens={visitas} />
    </section>
  );
}
