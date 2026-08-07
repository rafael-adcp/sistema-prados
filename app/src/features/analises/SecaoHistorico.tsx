import { useMemo } from "react";
import {
  MESES_ABREVIADOS,
  mesIsoDe,
  mesmoMesDoAnoAnterior,
  montarSeriesDeProdutos,
  montarSeriesPorAno,
  rotuloDeMes,
  rotuloDeMesCalendario,
} from "../../domain/analises";
import { Grafico } from "../../ui/Grafico";
import { ANOS_NO_GRAFICO_MENSAL, PRODUTOS_NO_GRAFICO_DE_MIX } from "./carregarPainel";
import {
  emDias,
  emPercentual,
  inteiro,
  referenciaDeMedia,
  type NumerosHistoricos,
} from "./numerosDaOficina";
import { TabelaKpi } from "./TabelaKpi";

interface Props {
  numeros: NumerosHistoricos;
  hoje: string;
}

/** A metade da aba que sempre olha para todos os anos — o seletor não a afeta. */
export function SecaoHistorico({ numeros, hoje }: Props) {
  const mesAtual = mesIsoDe(hoje);

  // Props dos gráficos memoizadas: o Grafico regenera quando elas mudam.
  const graficos = useMemo(() => {
    // Os anos vêm dos próprios dados (a consulta já veio recortada na janela),
    // do mais antigo ao mais novo. Anos sem nenhum registro não viram linha vazia.
    const anosDoMensal = [...new Set(numeros.trocasPorAnoEMes.map((linha) => linha.ano))].sort();
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
      retornoMedio: {
        rotulosX: numeros.retornoPorAno.map((linha) => linha.ano),
        series: [{ nome: "Dias", pontos: numeros.retornoPorAno.map((linha) => linha.media) }],
      },
      novosERecorrentes: {
        rotulosX: numeros.novosERecorrentes.map((linha) => linha.ano),
        series: [
          { nome: "Novos", pontos: numeros.novosERecorrentes.map((linha) => linha.novos) },
          {
            nome: "Já conhecidos",
            pontos: numeros.novosERecorrentes.map((linha) => linha.recorrentes),
          },
        ],
      },
      // Cada carro estreante conta no ano da 1ª visita; novos nunca é 0 aqui,
      // porque o ano só existe na série se algum carro estreou nele.
      retornoDosNovos: {
        rotulosX: numeros.retornoDosNovos.map((linha) => linha.ano),
        series: [
          {
            nome: "% que voltou",
            pontos: numeros.retornoDosNovos.map((linha) => (linha.voltaram / linha.novos) * 100),
          },
        ],
      },
      produtos: {
        rotulosX: numeros.trocasPorAno.map((linha) => linha.ano),
        series: montarSeriesDeProdutos(
          numeros.produtosPorAno,
          numeros.trocasPorAno.map((linha) => linha.ano),
        ),
      },
    };
  }, [numeros, hoje, mesAtual]);

  const { comparativo } = numeros;

  return (
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
        titulo={`Trocas por mês — últimos ${ANOS_NO_GRAFICO_MENSAL} anos`}
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
        <Grafico
          titulo="Carros novos × já conhecidos, por ano"
          tipo="linha"
          rotulosX={graficos.novosERecorrentes.rotulosX}
          series={graficos.novosERecorrentes.series}
        />
        <Grafico
          titulo="% de carros novos que voltaram, por ano da 1ª visita"
          tipo="linha"
          rotulosX={graficos.retornoDosNovos.rotulosX}
          series={graficos.retornoDosNovos.series}
          formatarValor={emPercentual}
        />
      </div>
      <p className="texto-apoio">
        No gráfico de carros novos que voltaram, os anos recentes ainda vão subir: os carros que
        estrearam há pouco ainda estão dentro do prazo normal de retorno.
      </p>
      <Grafico
        titulo={`Produtos mais usados ao longo dos anos — top ${PRODUTOS_NO_GRAFICO_DE_MIX}`}
        tipo="linha"
        rotulosX={graficos.produtos.rotulosX}
        series={graficos.produtos.series}
      />
    </div>
  );
}
