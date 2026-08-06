import bb, { bar, grid, line, zoom } from "billboard.js";
import "billboard.js/dist/billboard.css";
import { useEffect, useRef } from "react";

// No build ESM do billboard 4, grid é módulo opt-in. Sem registrá-lo, as linhas
// de referência não renderizam E o handler de mouse lança TypeError a cada
// movimento (showAxisGridFocus ausente) — o tooltip nunca chega a abrir.
grid();
// zoom também é opt-in (módulo de interação). Sem esta linha, as opções de zoom
// são aceitas em silêncio e nada acontece.
zoom();

export interface SerieDoGrafico {
  nome: string;
  /** null = sem dado (a linha quebra em vez de cair a zero). */
  pontos: (number | null)[];
}

export interface ReferenciaDoGrafico {
  rotulo: string;
  valor: number;
}

interface Props {
  titulo: string;
  tipo: "linha" | "barra";
  rotulosX: string[];
  series: SerieDoGrafico[];
  referencias?: ReferenciaDoGrafico[];
  formatarValor?: (valor: number) => string;
}

const formatarPadrao = (valor: number) => Math.round(valor).toLocaleString("pt-BR");

// Cores: as do próprio billboard (schemeCategory10, 10 tons). Nenhum gráfico do
// app passa de 10 séries — o mensal é capado em 10 anos —, então a paleta nunca
// cicla. Não configuramos `color.pattern`: é a lib quem decide.

/**
 * Wrapper fino do billboard.js: o resto do app só conhece esta interface.
 * O gráfico é regenerado quando os dados mudam — quem chama deve memoizar
 * as props (useMemo) para não regenerar a cada render.
 */
export function Grafico({ titulo, tipo, rotulosX, series, referencias, formatarValor }: Props) {
  const alvo = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (alvo.current === null) return;
    const formatar = formatarValor ?? formatarPadrao;
    const grafico = bb.generate({
      bindto: alvo.current,
      data: {
        columns: series.map((serie) => [serie.nome, ...serie.pontos]),
        type: tipo === "barra" ? bar() : line(),
      },
      line: { connectNull: false },
      axis: {
        x: {
          type: "category",
          categories: rotulosX,
          tick: { culling: rotulosX.length > 15 },
        },
        y: { min: 0, padding: { bottom: 0 }, tick: { format: formatar } },
      },
      grid: {
        y: {
          lines: (referencias ?? []).map((referencia) => ({
            value: referencia.valor,
            text: `${referencia.rotulo}: ${formatar(referencia.valor)}`,
          })),
        },
      },
      legend: { show: series.length > 1 },
      // order desc: no tooltip, a série de maior valor vem primeiro (útil no
      // gráfico mensal multi-anos, onde as linhas se cruzam).
      tooltip: { order: "desc", format: { value: (valor: number) => formatar(valor) } },
      // Com muitas séries os marcadores viram poeira sobre as linhas.
      point: { show: rotulosX.length <= 31 && series.length <= 6 },
      // Arrastar sobre o gráfico amplia o trecho selecionado. `enabled` é boolean
      // e `type` é irmão dele (no C3 antigo era enabled: { type }), e o padrão é
      // "wheel" — sem declarar o type, o arrastar não faz nada. `rescale` reajusta
      // o eixo Y ao trecho, senão a lupa não adianta em série achatada.
      zoom: {
        enabled: true,
        type: "drag",
        rescale: true,
        resetButton: { text: "Ver tudo" },
      },
    });
    return () => {
      grafico.destroy();
    };
  }, [tipo, rotulosX, series, referencias, formatarValor]);

  return (
    <figure className="grafico">
      <figcaption>{titulo}</figcaption>
      <div ref={alvo} />
    </figure>
  );
}
