import { useState } from "react";
import { descreverBusca } from "../../domain/interpretarBusca";
import { TabelaServicos } from "../../ui/TabelaServicos";
import { Paginacao } from "./Paginacao";
import { ITENS_POR_PAGINA, useBusca } from "./useBusca";

export function ConsultasPage({ aoVerHistorico }: { aoVerHistorico: (placa: string) => void }) {
  const [termo, setTermo] = useState("");
  const [pagina, setPagina] = useState(0);
  const { resultado, buscaEfetiva, carregando } = useBusca(termo, pagina);

  const mudarTermo = (novoTermo: string) => {
    setTermo(novoTermo);
    setPagina(0);
  };

  return (
    <section>
      <h2>Consultas</h2>
      <input
        type="search"
        className="campo-busca"
        placeholder="Placa, carro, produto ou data (ex.: ABC1234 · GOL 1.0 · 12/2025)"
        value={termo}
        onChange={(evento) => mudarTermo(evento.target.value)}
        autoFocus
      />
      <p className="descricao-busca">
        {descreverBusca(buscaEfetiva)} —{" "}
        {carregando ? "buscando…" : `${resultado.total.toLocaleString("pt-BR")} serviço(s)`}
      </p>
      <TabelaServicos itens={resultado.itens} aoClicarNaPlaca={aoVerHistorico} />
      <Paginacao
        pagina={pagina}
        totalDeItens={resultado.total}
        itensPorPagina={ITENS_POR_PAGINA}
        aoMudar={setPagina}
      />
    </section>
  );
}
