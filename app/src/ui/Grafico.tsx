import bb, { bar, grid, line } from "billboard.js";
import "billboard.js/dist/billboard.css";
import { useEffect, useRef } from "react";

// No build ESM do billboard 4, grid é módulo opt-in. Sem registrá-lo, as linhas
// de referência não renderizam E o handler de mouse lança TypeError a cada
// movimento (showAxisGridFocus ausente) — o tooltip nunca chega a abrir.
grid();

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

/** Paleta validada para daltonismo (scripts/validate_palette.js do skill de dataviz). */
const PALETA = ["#0b6bcb", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];

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
      color: { pattern: PALETA },
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
      point: { show: rotulosX.length <= 31 },
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
