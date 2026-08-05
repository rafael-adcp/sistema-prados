import { useState } from "react";
import { descreverBusca } from "../../domain/interpretarBusca";
import type { Servico } from "../../domain/servico";
import { TabelaServicos } from "../../ui/TabelaServicos";
import { EditarServicoDialog } from "../editar-servico/EditarServicoDialog";
import { Paginacao } from "./Paginacao";
import { ITENS_POR_PAGINA, useBusca } from "./useBusca";

export function ConsultasPage({ aoVerHistorico }: { aoVerHistorico: (placa: string) => void }) {
  const [termo, setTermo] = useState("");
  const [pagina, setPagina] = useState(0);
  const [versao, setVersao] = useState(0);
  const [emEdicao, setEmEdicao] = useState<Servico | null>(null);
  const { resultado, buscaEfetiva, carregando, erro } = useBusca(termo, pagina, versao);

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
      />
      <p className="descricao-busca">
        {erro !== null
          ? erro
          : `${descreverBusca(buscaEfetiva)} — ${
              carregando ? "buscando…" : `${resultado.total.toLocaleString("pt-BR")} serviço(s)`
            } · clique na linha para editar`}
      </p>
      <TabelaServicos
        itens={resultado.itens}
        aoClicarNaPlaca={aoVerHistorico}
        aoClicarNaLinha={setEmEdicao}
      />
      <Paginacao
        pagina={pagina}
        totalDeItens={resultado.total}
        itensPorPagina={ITENS_POR_PAGINA}
        aoMudar={setPagina}
      />
      {emEdicao !== null && (
        <EditarServicoDialog
          servico={emEdicao}
          aoFechar={() => setEmEdicao(null)}
          aoMudar={() => setVersao((atual) => atual + 1)}
        />
      )}
    </section>
  );
}
