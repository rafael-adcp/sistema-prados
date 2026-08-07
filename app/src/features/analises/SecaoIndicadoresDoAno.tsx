import { useMemo } from "react";
import {
  DIAS_DA_SEMANA,
  FAIXAS_DE_RETORNO,
  FAIXAS_DE_VISITAS,
  montarSeriesDeItens,
  percentual,
  resumoDosRetornos,
  totaisPorDiaDaSemana,
  totaisPorFaixa,
  type RetornoNoAno,
} from "../../domain/analises";
import { Grafico } from "../../ui/Grafico";
import { ITENS_NO_GRAFICO_DE_MIX } from "./carregarPainel";
import { inteiro, type IndicadoresDoAno } from "./numerosDaOficina";
import { TabelaKpi } from "./TabelaKpi";
import { TabelaRetornoPorProduto } from "./TabelaRetornoPorProduto";
import { TabelaTop } from "./TabelaTop";

interface Props {
  indicadores: IndicadoresDoAno;
  /** Série histórica recortada aqui na tela: a consulta vem sempre completa. */
  retornoPorAno: RetornoNoAno[];
  anoEscolhido: string;
  anos: string[];
  aoEscolherAno: (ano: string) => void;
}

/** A metade da aba que obedece ao seletor de ano. */
export function SecaoIndicadoresDoAno({
  indicadores,
  retornoPorAno,
  anoEscolhido,
  anos,
  aoEscolherAno,
}: Props) {
  const rotuloDoAno = anoEscolhido === "todos" ? "todos os anos" : anoEscolhido;
  const sufixoDoMix = anoEscolhido === "todos" ? "" : ` até ${anoEscolhido}`;
  const retornosDoRecorte =
    anoEscolhido === "todos"
      ? retornoPorAno
      : retornoPorAno.filter((linha) => linha.ano === anoEscolhido);

  const faixas = useMemo(
    () => ({
      rotulosX: FAIXAS_DE_RETORNO.map((faixa) => faixa.rotulo),
      series: [
        {
          nome: "Retornos",
          pontos: totaisPorFaixa(indicadores.faixasDeRetorno, FAIXAS_DE_RETORNO),
        },
      ],
    }),
    [indicadores.faixasDeRetorno],
  );

  const visitas = useMemo(
    () => ({
      rotulosX: FAIXAS_DE_VISITAS.map((faixa) => faixa.rotulo),
      series: [
        { nome: "Carros", pontos: totaisPorFaixa(indicadores.faixasDeVisitas, FAIXAS_DE_VISITAS) },
      ],
    }),
    [indicadores.faixasDeVisitas],
  );

  // Com um ano escolhido, o gráfico é "a base como estava até aquele ano":
  // o eixo para nele e o top vem só do que existia então (o corte da consulta).
  const mix = useMemo(() => {
    const anosDoEixo = [...anos]
      .sort()
      .filter((ano) => anoEscolhido === "todos" || ano <= anoEscolhido);
    return {
      rotulosX: anosDoEixo,
      produtos: montarSeriesDeItens(indicadores.produtosPorAno, anosDoEixo),
      carros: montarSeriesDeItens(indicadores.carrosPorAno, anosDoEixo),
    };
  }, [indicadores.produtosPorAno, indicadores.carrosPorAno, anos, anoEscolhido]);

  const diasDaSemana = useMemo(
    () => ({
      series: [{ nome: "Trocas", pontos: totaisPorDiaDaSemana(indicadores.porDiaDaSemana) }],
    }),
    [indicadores.porDiaDaSemana],
  );

  const { retorno, concentracao } = indicadores;

  return (
    <div className="secao-analises">
      <div className="cabecalho-do-ano">
        <h3>Indicadores — {rotuloDoAno}</h3>
        <label className="no-print">
          Ano
          <select value={anoEscolhido} onChange={(evento) => aoEscolherAno(evento.target.value)}>
            <option value="todos">Todos os anos</option>
            {anos.map((ano) => (
              <option key={ano} value={ano}>
                {ano}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="cartoes-resumo">
        <div className="cartao-resumo">
          <strong>{percentual(retorno.voltam, retorno.total)}</strong>
          <span>Carros que voltam ({inteiro(retorno.voltam)})</span>
        </div>
        <div className="cartao-resumo">
          <strong>{percentual(retorno.naoVoltam, retorno.total)}</strong>
          <span>Vieram uma vez só ({inteiro(retorno.naoVoltam)})</span>
        </div>
        <div className="cartao-resumo">
          <strong>{inteiro(retorno.total)}</strong>
          <span>Carros atendidos</span>
        </div>
        {/* Menos de 5 carros não têm "20%": o SQL devolve tudo zero e vira "—". */}
        <div className="cartao-resumo">
          <strong>
            {concentracao.carrosNoTopo === 0
              ? "—"
              : percentual(concentracao.trocasDoTopo, concentracao.trocasTotal)}
          </strong>
          <span>
            Trocas feitas pelos 20% mais fiéis
            {concentracao.carrosNoTopo === 0 ? "" : ` (${inteiro(concentracao.carrosNoTopo)} carros)`}
          </span>
        </div>
      </div>

      <div className="grade-de-graficos">
        <Grafico
          titulo={`Em quanto tempo os carros voltam — ${rotuloDoAno}`}
          tipo="barra"
          rotulosX={faixas.rotulosX}
          series={faixas.series}
        />
        <Grafico
          titulo={`Trocas por dia da semana — ${rotuloDoAno}`}
          tipo="barra"
          rotulosX={DIAS_DA_SEMANA}
          series={diasDaSemana.series}
        />
        <Grafico
          titulo={`Visitas por carro — ${rotuloDoAno}`}
          tipo="barra"
          rotulosX={visitas.rotulosX}
          series={visitas.series}
        />
        <TabelaRetornoPorProduto
          titulo={`Dias para voltar, por produto — ${rotuloDoAno}`}
          linhas={indicadores.retornoPorProduto}
        />
        <TabelaTop
          titulo={`Produtos mais usados — ${rotuloDoAno}`}
          coluna="Produto"
          linhas={indicadores.topProdutos}
          vazio="Nenhum produto registrado."
        />
        <TabelaTop
          titulo={`Carros mais atendidos — ${rotuloDoAno}`}
          coluna="Carro"
          linhas={indicadores.topCarros}
          vazio="Nenhum carro registrado."
        />
      </div>
      <p className="texto-apoio">
        Nos dias para voltar por produto, o produto considerado é o da troca anterior — o que
        estava no carro durante o intervalo até a volta.
      </p>

      <Grafico
        titulo={`Produtos mais usados ao longo dos anos${sufixoDoMix} — top ${ITENS_NO_GRAFICO_DE_MIX}`}
        tipo="linha"
        rotulosX={mix.rotulosX}
        series={mix.produtos}
      />
      <Grafico
        titulo={`Carros mais atendidos ao longo dos anos${sufixoDoMix} — top ${ITENS_NO_GRAFICO_DE_MIX}`}
        tipo="linha"
        rotulosX={mix.rotulosX}
        series={mix.carros}
      />

      <div className="grade-de-tabelas">
        <TabelaKpi
          titulo={`Trocas de óleo — ${rotuloDoAno}`}
          linhas={[
            { rotulo: "Por dia", resumo: indicadores.porDia },
            { rotulo: "Por mês", resumo: indicadores.porMes },
            { rotulo: "Por ano", resumo: indicadores.porAno },
          ]}
        />
        <TabelaKpi
          titulo={`Fidelidade dos clientes — ${rotuloDoAno}`}
          linhas={[
            { rotulo: "Visitas por carro", resumo: retorno.visitasPorCarro },
            { rotulo: "Dias para voltar", resumo: resumoDosRetornos(retornosDoRecorte) },
          ]}
        />
      </div>
    </div>
  );
}
