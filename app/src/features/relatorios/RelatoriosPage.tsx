import { useState } from "react";
import { useRepositorio } from "../../data/ProvedorDeDados";
import type { PaginaDeServicos } from "../../data/servicoRepository";
import { formatarDataBr, hojeIso } from "../../domain/datas";
import type { Busca } from "../../domain/interpretarBusca";
import { prefixoDePlaca } from "../../domain/placa";
import { TabelaServicos } from "../../ui/TabelaServicos";

const LIMITE_DO_RELATORIO = 5000;

type TipoDeRelatorio = "periodo" | "carro" | "placa";

interface Filtros {
  tipo: TipoDeRelatorio;
  de: string;
  ate: string;
  termo: string;
}

function descreverFiltros(filtros: Filtros): string {
  if (filtros.tipo === "periodo") {
    return `Período de ${formatarDataBr(filtros.de)} a ${formatarDataBr(filtros.ate)}`;
  }
  const rotulo = filtros.tipo === "carro" ? "Carro" : "Placa";
  return `${rotulo}: ${filtros.termo}`;
}

function paraBusca(filtros: Filtros): Busca | null {
  if (filtros.tipo === "periodo") {
    if (filtros.de === "" || filtros.ate === "") return null;
    return { tipo: "data", de: filtros.de, ate: filtros.ate };
  }
  if (filtros.termo.trim() === "") return null;
  if (filtros.tipo === "carro") return { tipo: "carro", termo: filtros.termo };
  return { tipo: "placa", prefixo: prefixoDePlaca(filtros.termo) };
}

export function RelatoriosPage({ aoVerHistorico }: { aoVerHistorico: (placa: string) => void }) {
  const repositorio = useRepositorio();
  const [filtros, setFiltros] = useState<Filtros>({
    tipo: "periodo",
    de: hojeIso(),
    ate: hojeIso(),
    termo: "",
  });
  const [resultado, setResultado] = useState<PaginaDeServicos | null>(null);
  const [gerando, setGerando] = useState(false);

  const alterar = (mudanca: Partial<Filtros>) => {
    setFiltros((atuais) => ({ ...atuais, ...mudanca }));
    setResultado(null);
  };

  const gerar = async () => {
    const busca = paraBusca(filtros);
    if (busca === null) return;
    setGerando(true);
    try {
      setResultado(await repositorio.buscar(busca, 0, LIMITE_DO_RELATORIO));
    } catch (causa) {
      console.error("Relatório falhou:", causa);
    } finally {
      setGerando(false);
    }
  };

  return (
    <section>
      <div className="no-print">
        <h2>Relatórios</h2>
        <form
          className="filtros-relatorio"
          onSubmit={(evento) => {
            evento.preventDefault();
            void gerar();
          }}
        >
          <label>
            Tipo
            <select
              value={filtros.tipo}
              onChange={(evento) => alterar({ tipo: evento.target.value as TipoDeRelatorio })}
            >
              <option value="periodo">Por período</option>
              <option value="carro">Por carro</option>
              <option value="placa">Por placa</option>
            </select>
          </label>
          {filtros.tipo === "periodo" ? (
            <>
              <label>
                De
                <input
                  type="date"
                  value={filtros.de}
                  onChange={(evento) => alterar({ de: evento.target.value })}
                />
              </label>
              <label>
                Até
                <input
                  type="date"
                  value={filtros.ate}
                  onChange={(evento) => alterar({ ate: evento.target.value })}
                />
              </label>
            </>
          ) : (
            <label>
              {filtros.tipo === "carro" ? "Descrição do carro" : "Placa"}
              <input
                type="text"
                value={filtros.termo}
                placeholder={filtros.tipo === "carro" ? "Ex.: GOL 1.0" : "Ex.: ABC1234"}
                onChange={(evento) => alterar({ termo: evento.target.value.toUpperCase() })}
              />
            </label>
          )}
          <button type="submit" className="botao-principal" disabled={gerando}>
            {gerando ? "Gerando…" : "Gerar relatório"}
          </button>
          {resultado !== null && (
            <button type="button" className="botao-secundario" onClick={() => window.print()}>
              🖨 Imprimir
            </button>
          )}
        </form>
      </div>
      {resultado !== null && (
        <>
          <header className="cabecalho-relatorio">
            <h2 className="so-impressao">Super Troca de Óleo Prado's</h2>
            <p>
              {descreverFiltros(filtros)} · {resultado.total.toLocaleString("pt-BR")} serviço(s) ·
              emitido em {formatarDataBr(hojeIso())}
            </p>
            {resultado.total > LIMITE_DO_RELATORIO && (
              <p className="aviso">
                Mostrando os primeiros {LIMITE_DO_RELATORIO.toLocaleString("pt-BR")} — refine o
                filtro para um relatório completo.
              </p>
            )}
          </header>
          <TabelaServicos itens={resultado.itens} aoClicarNaPlaca={aoVerHistorico} />
        </>
      )}
    </section>
  );
}
