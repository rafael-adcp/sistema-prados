import { useMemo } from "react";
import {
  DIAS_DA_SEMANA,
  FAIXAS_DE_RETORNO,
  percentual,
  resumoDosRetornos,
  totaisPorDiaDaSemana,
  totaisPorFaixa,
  type RetornoNoAno,
} from "../../domain/analises";
import { Grafico } from "../../ui/Grafico";
import { inteiro, type IndicadoresDoAno } from "./numerosDaOficina";
import { TabelaKpi } from "./TabelaKpi";
import { TabelaTopProdutos } from "./TabelaTopProdutos";

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
  const retornosDoRecorte =
    anoEscolhido === "todos"
      ? retornoPorAno
      : retornoPorAno.filter((linha) => linha.ano === anoEscolhido);

  const faixas = useMemo(
    () => ({
      rotulosX: FAIXAS_DE_RETORNO.map((faixa) => faixa.rotulo),
      series: [{ nome: "Retornos", pontos: totaisPorFaixa(indicadores.faixasDeRetorno) }],
    }),
    [indicadores.faixasDeRetorno],
  );

  const diasDaSemana = useMemo(
    () => ({
      series: [{ nome: "Trocas", pontos: totaisPorDiaDaSemana(indicadores.porDiaDaSemana) }],
    }),
    [indicadores.porDiaDaSemana],
  );

  const { retorno } = indicadores;

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
        <TabelaTopProdutos titulo={`Produtos mais usados — ${rotuloDoAno}`} linhas={indicadores.topProdutos} />
      </div>

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
