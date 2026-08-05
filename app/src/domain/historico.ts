import type { Servico } from "./servico";

export interface ResumoDoHistorico {
  carro: string;
  clienteDesde: string | null;
  totalDeVisitas: number;
}

/** Deriva o cabeçalho do histórico sem depender da ordem em que as visitas chegam. */
export function resumirHistorico(visitas: Servico[]): ResumoDoHistorico {
  const carro = visitas.find((visita) => visita.carro !== "")?.carro ?? "—";
  const datasValidas = visitas
    .filter((visita) => !visita.dataSuspeita && visita.data !== null)
    .map((visita) => visita.data as string)
    .sort();
  return {
    carro,
    clienteDesde: datasValidas[0] ?? null,
    totalDeVisitas: visitas.length,
  };
}
