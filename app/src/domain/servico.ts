import { dataEhSuspeita } from "./datas";

export interface Servico {
  id: number;
  carro: string;
  km: number | null;
  kmRaw: string;
  placa: string;
  produto: string;
  data: string | null; // ISO yyyy-mm-dd
  dataSuspeita: boolean;
}

export interface NovoServico {
  carro: string;
  kmRaw: string;
  placa: string;
  produto: string;
  data: string; // ISO yyyy-mm-dd ("" = sem data, só permitido na edição de legado)
}

/** Problema apontado no próprio campo, para o erro aparecer onde se corrige. */
export type ProblemasDoServico = Partial<Record<"placa" | "produto" | "data", string>>;

export function novoServicoVazio(dataDeHoje: string): NovoServico {
  return { carro: "", kmRaw: "", placa: "", produto: "", data: dataDeHoje };
}

export function temProblemas(problemas: ProblemasDoServico): boolean {
  return Object.keys(problemas).length > 0;
}

interface OpcoesDeValidacao {
  /** Registros legados sem data podem ser editados sem forçar uma data. */
  exigirData: boolean;
}

export function validarServico(
  servico: NovoServico,
  hoje: string,
  opcoes: OpcoesDeValidacao,
): ProblemasDoServico {
  const problemas: ProblemasDoServico = {};
  if (servico.produto.trim() === "") {
    problemas.produto = "Informe o produto/serviço aplicado.";
  }
  if (servico.placa.trim() === "" && servico.carro.trim() === "") {
    problemas.placa = "Informe a placa (ou pelo menos o carro).";
  }
  if (servico.data === "") {
    if (opcoes.exigirData) problemas.data = "Informe a data do serviço.";
  } else if (dataEhSuspeita(servico.data, hoje)) {
    problemas.data = "Confira o ano — esta data está no futuro ou muito no passado.";
  }
  return problemas;
}

export function validarNovoServico(servico: NovoServico, hoje: string): ProblemasDoServico {
  return validarServico(servico, hoje, { exigirData: true });
}

export function validarEdicaoDeServico(servico: NovoServico, hoje: string): ProblemasDoServico {
  return validarServico(servico, hoje, { exigirData: false });
}

export function paraEdicao(servico: Servico): NovoServico {
  return {
    carro: servico.carro,
    kmRaw: servico.kmRaw,
    placa: servico.placa,
    produto: servico.produto,
    data: servico.data ?? "",
  };
}
