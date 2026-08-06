import { useEffect, useState } from "react";
import { useAnalises, useQualidade } from "../../data/ProvedorDeDados";
import { formatarDataBr, hojeIso } from "../../domain/datas";
import { Carregando } from "../../ui/Carregando";
import { carregarPainel, type PainelDeAnalises } from "./carregarPainel";
import { SecaoHistorico } from "./SecaoHistorico";
import { SecaoIndicadoresDoAno } from "./SecaoIndicadoresDoAno";
import { SecaoQualidade } from "./SecaoQualidade";

interface Props {
  ativa: boolean;
  aoVerHistorico: (placa: string) => void;
}

/**
 * As agregações varrem a base inteira, então só rodam com a aba ativa —
 * e rodam de novo a cada ativação para refletir edições feitas nas outras abas.
 */
export function AnalisesPage({ ativa, aoVerHistorico }: Props) {
  const analises = useAnalises();
  const qualidade = useQualidade();
  const [painel, setPainel] = useState<PainelDeAnalises | null>(null);
  const [anoEscolhido, setAnoEscolhido] = useState(() => hojeIso().slice(0, 4));
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [recalculando, setRecalculando] = useState(false);

  useEffect(() => {
    if (!ativa) return;
    let cancelada = false;
    setErro(null);
    setRecalculando(true);
    carregarPainel(analises, qualidade, hojeIso(), anoEscolhido)
      .then((novo) => {
        if (!cancelada) setPainel(novo);
      })
      .catch((causa) => {
        console.error("Análises falharam:", causa);
        if (!cancelada) setErro("Não foi possível calcular as análises — tente novamente.");
      })
      .finally(() => {
        if (!cancelada) setRecalculando(false);
      });
    return () => {
      cancelada = true;
    };
  }, [analises, ativa, anoEscolhido, versao]);

  const hoje = hojeIso();

  return (
    <section>
      <div className="no-print">
        <h2>Análises</h2>
        <div className="filtros-relatorio">
          <button type="button" className="botao-secundario" onClick={() => window.print()}>
            🖨 Imprimir
          </button>
        </div>
        {erro !== null && (
          <p className="mensagem-erro">
            {erro}{" "}
            <button
              type="button"
              className="botao-secundario"
              onClick={() => setVersao((atual) => atual + 1)}
            >
              Tentar novamente
            </button>
          </p>
        )}
      </div>
      <header className="cabecalho-relatorio so-impressao">
        <h2>Super Troca de Óleo Prado's — Análises</h2>
        <p>Emitido em {formatarDataBr(hoje)}</p>
      </header>
      {painel === null ? (
        erro === null && <Carregando mensagem="Calculando as análises…" />
      ) : (
        <>
          {/* Fora do painel: o blur do conteúdo não pode desfocar o próprio aviso. */}
          {recalculando && (
            <div className="sobreposicao-carregando" role="status">
              <span className="girador" aria-hidden="true" />
              Recalculando…
            </div>
          )}
          <div
            className={recalculando ? "painel-analises atualizando" : "painel-analises"}
            aria-busy={recalculando}
          >
          {painel.base.validos < painel.base.total && (
            <p className="texto-apoio">
              Números calculados sobre {painel.base.validos.toLocaleString("pt-BR")} de{" "}
              {painel.base.total.toLocaleString("pt-BR")} registros — os demais estão sem data ou
              com data suspeita (veja Qualidade dos dados abaixo).
            </p>
          )}
          <SecaoHistorico numeros={painel.numeros} hoje={hoje} />
          <SecaoIndicadoresDoAno
            indicadores={painel.numeros}
            retornoPorAno={painel.numeros.retornoPorAno}
            anoEscolhido={anoEscolhido}
            anos={painel.anos}
            aoEscolherAno={setAnoEscolhido}
          />
          <SecaoQualidade
            contagens={painel.contagens}
            aoVerHistorico={aoVerHistorico}
            aoMudar={() => setVersao((atual) => atual + 1)}
          />
          </div>
        </>
      )}
    </section>
  );
}
