import { useMemo } from "react";
import type {
  ComparativoDoMes,
  ProdutoMaisUsado,
  RetornoDeClientes,
  SazonalidadeDoMes,
  TotalPorAno,
  TotalPorFaixa,
  TrocasPorAnoEMes,
} from "../../data/analiseRepository";
import {
  FAIXAS_DE_RETORNO,
  mediaDe,
  MESES_ABREVIADOS,
  mesIsoDe,
  mesmoMesDoAnoAnterior,
  montarSeriesPorAno,
  percentual,
  resumoDosRetornos,
  rotuloDeMes,
  rotuloDeMesCalendario,
  totaisPorFaixa,
  ultimosAnos,
  type ResumoMinMediaMax,
  type RetornoNoAno,
} from "../../domain/analises";
import { Grafico, type ReferenciaDoGrafico } from "../../ui/Grafico";
import { TabelaKpi } from "./TabelaKpi";

export interface NumerosDaOficina {
  trocasPorAnoEMes: TrocasPorAnoEMes[];
  trocasPorAno: TotalPorAno[];
  placasDistintasPorAno: TotalPorAno[];
  faixasDeRetorno: TotalPorFaixa[];
  retornoPorAno: RetornoNoAno[];
  porDia: ResumoMinMediaMax | null;
  porMes: ResumoMinMediaMax | null;
  porAno: ResumoMinMediaMax | null;
  /** Sempre sobre todos os anos, para o cartão de média mensal histórica. */
  porMesHistorico: ResumoMinMediaMax | null;
  retorno: RetornoDeClientes;
  sazonalidade: SazonalidadeDoMes[];
  comparativo: ComparativoDoMes;
  topProdutos: ProdutoMaisUsado[];
}

interface Props {
  numeros: NumerosDaOficina;
  hoje: string;
  /** "todos" ou um ano — recorte aplicado só à seção Indicadores do ano. */
  anoEscolhido: string;
  anos: string[];
  aoEscolherAno: (ano: string) => void;
}

const inteiro = (valor: number) => Math.round(valor).toLocaleString("pt-BR");
const emDias = (valor: number) => `${Math.round(valor).toLocaleString("pt-BR")} dias`;

function referenciaDeMedia(totais: number[]): ReferenciaDoGrafico[] {
  const media = mediaDe(totais);
  return media === null ? [] : [{ rotulo: "Média", valor: media }];
}

export function SecaoNumeros({ numeros, hoje, anoEscolhido, anos, aoEscolherAno }: Props) {
  const mesAtual = mesIsoDe(hoje);
  const rotuloDoAno = anoEscolhido === "todos" ? "todos os anos" : anoEscolhido;
  const retornosDoRecorte =
    anoEscolhido === "todos"
      ? numeros.retornoPorAno
      : numeros.retornoPorAno.filter((linha) => linha.ano === anoEscolhido);

  // Props dos gráficos memoizadas: o Grafico regenera quando elas mudam.
  const graficos = useMemo(() => {
    const anosDoMensal = ultimosAnos(hoje, 5).filter((ano) =>
      numeros.trocasPorAnoEMes.some((linha) => linha.ano === ano),
    );
    return {
      porMes: {
        series: montarSeriesPorAno(numeros.trocasPorAnoEMes, anosDoMensal, mesAtual),
      },
      porAno: {
        rotulosX: numeros.trocasPorAno.map((linha) => linha.ano),
        series: [{ nome: "Trocas", pontos: numeros.trocasPorAno.map((linha) => linha.total) }],
        referencias: referenciaDeMedia(numeros.trocasPorAno.map((linha) => linha.total)),
      },
      placas: {
        rotulosX: numeros.placasDistintasPorAno.map((linha) => linha.ano),
        series: [
          { nome: "Carros", pontos: numeros.placasDistintasPorAno.map((linha) => linha.total) },
        ],
        referencias: referenciaDeMedia(numeros.placasDistintasPorAno.map((linha) => linha.total)),
      },
      faixas: {
        rotulosX: FAIXAS_DE_RETORNO.map((faixa) => faixa.rotulo),
        series: [{ nome: "Retornos", pontos: totaisPorFaixa(numeros.faixasDeRetorno) }],
      },
      retornoMedio: {
        rotulosX: numeros.retornoPorAno.map((linha) => linha.ano),
        series: [{ nome: "Dias", pontos: numeros.retornoPorAno.map((linha) => linha.media) }],
      },
    };
  }, [numeros, hoje, mesAtual]);

  const { retorno, comparativo } = numeros;

  return (
    <>
      <div className="secao-analises">
        <h3>Números</h3>
        <div className="cartoes-resumo">
          <div className="cartao-resumo">
            <strong>{inteiro(comparativo.mesAtual)}</strong>
            <span>Trocas em {rotuloDeMes(mesAtual)}</span>
          </div>
          <div className="cartao-resumo">
            <strong>{inteiro(comparativo.mesAnoPassado)}</strong>
            <span>Trocas em {rotuloDeMes(mesmoMesDoAnoAnterior(mesAtual))}</span>
          </div>
          <div className="cartao-resumo">
            <strong>
              {numeros.porMesHistorico === null ? "—" : inteiro(numeros.porMesHistorico.media)}
            </strong>
            <span>Média mensal histórica</span>
          </div>
        </div>

        <Grafico
          titulo="Trocas por mês — últimos 5 anos"
          tipo="linha"
          rotulosX={MESES_ABREVIADOS}
          series={graficos.porMes.series}
        />
        <div className="grade-de-graficos">
          <Grafico
            titulo="Total de trocas por ano"
            tipo="linha"
            rotulosX={graficos.porAno.rotulosX}
            series={graficos.porAno.series}
            referencias={graficos.porAno.referencias}
          />
          <Grafico
            titulo="Carros diferentes atendidos por ano"
            tipo="linha"
            rotulosX={graficos.placas.rotulosX}
            series={graficos.placas.series}
            referencias={graficos.placas.referencias}
          />
          <Grafico
            titulo="Média de dias para voltar, por ano"
            tipo="linha"
            rotulosX={graficos.retornoMedio.rotulosX}
            series={graficos.retornoMedio.series}
            formatarValor={emDias}
          />
          <TabelaKpi
            titulo="Sazonalidade — trocas por mês do calendário"
            linhas={numeros.sazonalidade.map((linha) => ({
              rotulo: rotuloDeMesCalendario(linha.mes),
              resumo: linha,
            }))}
          />
        </div>
      </div>

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
            rotulosX={graficos.faixas.rotulosX}
            series={graficos.faixas.series}
          />
          <div className="tabela-kpi">
            <h3>Produtos mais usados — {rotuloDoAno}</h3>
            {numeros.topProdutos.length === 0 ? (
              <p className="estado-vazio">Nenhum produto registrado.</p>
            ) : (
              <table className="tabela-servicos">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Vezes</th>
                  </tr>
                </thead>
                <tbody>
                  {numeros.topProdutos.map((linha) => (
                    <tr key={linha.produto}>
                      <td>{linha.produto}</td>
                      <td>{inteiro(linha.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="grade-de-tabelas">
          <TabelaKpi
            titulo={`Trocas de óleo — ${rotuloDoAno}`}
            linhas={[
              { rotulo: "Por dia", resumo: numeros.porDia },
              { rotulo: "Por mês", resumo: numeros.porMes },
              { rotulo: "Por ano", resumo: numeros.porAno },
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
    </>
  );
}
