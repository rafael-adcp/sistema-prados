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
  data: string; // ISO yyyy-mm-dd
}

export function novoServicoVazio(dataDeHoje: string): NovoServico {
  return { carro: "", kmRaw: "", placa: "", produto: "", data: dataDeHoje };
}

/** Retorna a lista de problemas que impedem o salvamento (vazia = pode salvar). */
export function validarNovoServico(servico: NovoServico): string[] {
  const problemas: string[] = [];
  if (servico.produto.trim() === "") {
    problemas.push("Informe o produto/serviço aplicado.");
  }
  if (servico.placa.trim() === "" && servico.carro.trim() === "") {
    problemas.push("Informe a placa ou a descrição do carro.");
  }
  if (servico.data === "") {
    problemas.push("Informe a data do serviço.");
  }
  return problemas;
}
