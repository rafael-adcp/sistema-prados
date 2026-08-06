import { useEffect, useState } from "react";
import type { BaseDeAnalise, ContagensDeInconsistencias } from "../../data/analiseRepository";
import { useAnalises } from "../../data/ProvedorDeDados";
import {
  mesIsoDe,
  mesmoMesDoAnoAnterior,
  periodoDeUltimosAnos,
  type PeriodoDeAnos,
} from "../../domain/analises";
import { formatarDataBr, hojeIso } from "../../domain/datas";
import { Carregando } from "../../ui/Carregando";
import { SecaoNumeros, type NumerosDaOficina } from "./SecaoNumeros";
import { SecaoQualidade } from "./SecaoQualidade";

/** "todos" ou um ano ("2026"): filtra os indicadores, não os gráficos por ano. */
function paraPeriodo(anoEscolhido: string): PeriodoDeAnos | undefined {
  return anoEscolhido === "todos" ? undefined : { deAno: anoEscolhido, ateAno: anoEscolhido };
}

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
  const [base, setBase] = useState<BaseDeAnalise | null>(null);
  const [contagens, setContagens] = useState<ContagensDeInconsistencias | null>(null);
  const [numeros, setNumeros] = useState<NumerosDaOficina | null>(null);
  const [anoEscolhido, setAnoEscolhido] = useState(() => hojeIso().slice(0, 4));
  const [anos, setAnos] = useState<string[]>(() => [hojeIso().slice(0, 4)]);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [recalculando, setRecalculando] = useState(false);

  useEffect(() => {
    if (!ativa) return;
    let cancelada = false;
    const hoje = hojeIso();
    const mesAtual = mesIsoDe(hoje);
    const periodo = paraPeriodo(anoEscolhido);
    setErro(null);
    setRecalculando(true);
    Promise.all([
      analises.contarBase(),
      analises.contarInconsistencias(),
      analises.anosDisponiveis(),
      analises.trocasPorAnoEMes(periodoDeUltimosAnos(hoje, 5)),
      analises.trocasPorAno(), // por ano é multi-anos por definição: o filtro não se aplica
      analises.placasDistintasPorAno(),
      analises.faixasDeRetorno(periodo),
      analises.retornoPorAno(),
      analises.resumoDeTrocas("dia", periodo),
      analises.resumoDeTrocas("mes", periodo),
      analises.resumoDeTrocas("ano", periodo),
      analises.resumoDeTrocas("mes"), // média mensal histórica do cartão, sempre completa
      analises.retornoDeClientes(periodo),
      analises.sazonalidade(mesAtual),
      analises.comparativoDoMes(mesAtual, mesmoMesDoAnoAnterior(mesAtual)),
      analises.topProdutos(10, periodo),
    ])
      .then(
        ([
          baseContada,
          inconsistencias,
          anosDoBanco,
          trocasPorAnoEMes,
          trocasPorAno,
          placasDistintasPorAno,
          faixasDeRetorno,
          retornoPorAno,
          porDia,
          porMes,
          porAno,
          porMesHistorico,
          retorno,
          sazonalidade,
          comparativo,
          topProdutos,
        ]) => {
          if (cancelada) return;
          const anoAtual = hoje.slice(0, 4);
          setAnos(anosDoBanco.includes(anoAtual) ? anosDoBanco : [anoAtual, ...anosDoBanco]);
          setBase(baseContada);
          setContagens(inconsistencias);
          setNumeros({
            trocasPorAnoEMes,
            trocasPorAno,
            placasDistintasPorAno,
            faixasDeRetorno,
            retornoPorAno,
            porDia,
            porMes,
            porAno,
            porMesHistorico,
            retorno,
            sazonalidade,
            comparativo,
            topProdutos,
          });
        },
      )
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
  const pronto = base !== null && contagens !== null && numeros !== null;

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
      {!pronto ? (
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
          {base.validos < base.total && (
            <p className="texto-apoio">
              Números calculados sobre {base.validos.toLocaleString("pt-BR")} de{" "}
              {base.total.toLocaleString("pt-BR")} registros — os demais estão sem data ou com data
              suspeita (veja Qualidade dos dados abaixo).
            </p>
          )}
          <SecaoNumeros
            numeros={numeros}
            hoje={hoje}
            anoEscolhido={anoEscolhido}
            anos={anos}
            aoEscolherAno={setAnoEscolhido}
          />
          <SecaoQualidade
            contagens={contagens}
            aoVerHistorico={aoVerHistorico}
            aoMudar={() => setVersao((atual) => atual + 1)}
          />
          </div>
        </>
      )}
    </section>
  );
}
