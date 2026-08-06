import { useState } from "react";
import { useRepositorio } from "../../data/ProvedorDeDados";
import type { PaginaDeServicos } from "../../data/servicoRepository";
import type { Busca } from "../../domain/busca";
import { formatarDataBr, hojeIso } from "../../domain/datas";
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

interface Relatorio {
  pagina: PaginaDeServicos;
  filtros: Filtros; // snapshot dos filtros usados na geração, não os da tela
}

function descreverFiltros(filtros: Filtros): string {
  if (filtros.tipo === "periodo") {
    const [de, ate] =
      filtros.de <= filtros.ate ? [filtros.de, filtros.ate] : [filtros.ate, filtros.de];
    return `Período de ${formatarDataBr(de)} a ${formatarDataBr(ate)}`;
  }
  const rotulo = filtros.tipo === "carro" ? "Carro" : "Placa";
  return `${rotulo}: ${filtros.termo.toUpperCase()}`;
}

/** Datas invertidas são corrigidas em silêncio — inverter "De" e "Até" é deslize comum. */
function paraBusca(filtros: Filtros): Busca | null {
  if (filtros.tipo === "periodo") {
    if (filtros.de === "" || filtros.ate === "") return null;
    const [de, ate] = filtros.de <= filtros.ate ? [filtros.de, filtros.ate] : [filtros.ate, filtros.de];
    return { tipo: "data", de, ate };
  }
  if (filtros.termo.trim() === "") return null;
  if (filtros.tipo === "carro") return { tipo: "carro", termo: filtros.termo };
  return { tipo: "placa", prefixo: prefixoDePlaca(filtros.termo) };
}

interface PropsDaPagina {
  aoVerHistorico: (placa: string) => void;
  /** Injetável só para o teste conseguir estourar o limite sem montar 5.000 linhas. */
  limite?: number;
}

export function RelatoriosPage({ aoVerHistorico, limite = LIMITE_DO_RELATORIO }: PropsDaPagina) {
  const repositorio = useRepositorio();
  const [filtros, setFiltros] = useState<Filtros>({
    tipo: "periodo",
    de: hojeIso(),
    ate: hojeIso(),
    termo: "",
  });
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const alterar = (mudanca: Partial<Filtros>) => {
    setFiltros((atuais) => ({ ...atuais, ...mudanca }));
    setRelatorio(null);
    setErro(null);
  };

  /** Sem isto o botão ficava habilitado e o clique não fazia nada, sem avisar. */
  const buscaPronta = paraBusca(filtros);

  const gerar = async () => {
    const busca = buscaPronta;
    if (busca === null) return;
    const filtrosUsados = filtros;
    setGerando(true);
    setErro(null);
    try {
      const pagina = await repositorio.buscar(busca, 0, limite);
      setRelatorio({ pagina, filtros: filtrosUsados });
    } catch (causa) {
      console.error("Relatório falhou:", causa);
      setErro("Não foi possível gerar o relatório — tente novamente.");
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
                className="entrada-maiuscula"
                value={filtros.termo}
                placeholder={filtros.tipo === "carro" ? "Ex.: GOL 1.0" : "Ex.: ABC1234"}
                onChange={(evento) => alterar({ termo: evento.target.value })}
              />
            </label>
          )}
          <button
            type="submit"
            className="botao-principal"
            disabled={gerando || buscaPronta === null}
            title={buscaPronta === null ? "Preencha o filtro para gerar o relatório" : undefined}
          >
            {gerando ? "Gerando…" : "Gerar relatório"}
          </button>
          {relatorio !== null && (
            <button type="button" className="botao-secundario" onClick={() => window.print()}>
              🖨 Imprimir
            </button>
          )}
        </form>
        {erro !== null && <p className="mensagem-erro">{erro}</p>}
      </div>
      {relatorio !== null && (
        <>
          <header className="cabecalho-relatorio">
            <h2 className="so-impressao">Super Troca de Óleo Prado's</h2>
            <p>
              {descreverFiltros(relatorio.filtros)} ·{" "}
              {relatorio.pagina.total.toLocaleString("pt-BR")} serviço(s) · emitido em{" "}
              {formatarDataBr(hojeIso())}
            </p>
            {relatorio.pagina.total > limite && (
              <p className="aviso">
                Mostrando os primeiros {limite.toLocaleString("pt-BR")} — refine o filtro para um
                relatório completo.
              </p>
            )}
          </header>
          <TabelaServicos itens={relatorio.pagina.itens} aoClicarNaPlaca={aoVerHistorico} />
        </>
      )}
    </section>
  );
}
