import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ServicoImportado } from "../domain/importarAccess";
import { criarBancoDeTeste, type BancoDeTeste } from "../testes/bancoDeTeste";
import { AnaliseRepository } from "./analiseRepository";
import { ServicoRepository } from "./servicoRepository";

let banco: BancoDeTeste;
let repositorio: ServicoRepository;
let analises: AnaliseRepository;

beforeEach(() => {
  banco = criarBancoDeTeste();
  repositorio = new ServicoRepository(banco);
  analises = new AnaliseRepository(banco);
});

afterEach(() => banco.fechar());

function servicoImportado(parcial: Partial<ServicoImportado> & { id: number }): ServicoImportado {
  return {
    carro: "GOL 1.0",
    km: 100000,
    kmRaw: "100000",
    placa: "AAA0001",
    produto: "3 SL",
    data: "2024-01-10",
    dataSuspeita: false,
    ...parcial,
  };
}

async function semear(servicos: ServicoImportado[]) {
  await repositorio.substituirTodosPor(servicos);
}

describe("qualidade dos dados", () => {
  const fixtures: ServicoImportado[] = [
    servicoImportado({ id: 1, placa: "AAA0001", data: "2024-01-05" }), // válido
    servicoImportado({ id: 2, placa: "AAA0002", data: null }), // sem data
    servicoImportado({ id: 3, placa: "AAA0003", data: "2999-12-31", dataSuspeita: true }), // futuro
    servicoImportado({ id: 4, placa: "AAA0004", data: "1982-10-10", dataSuspeita: true }), // antes de 2000
    servicoImportado({ id: 5, placa: "", data: "2024-01-06" }), // sem placa
    servicoImportado({ id: 6, placa: "AVJ4DS3", data: "2024-01-07" }), // fora do padrão
    servicoImportado({ id: 7, placa: "AB1234", data: "2024-01-08" }), // fora do padrão (curta)
    servicoImportado({ id: 8, placa: "ABC1D23", data: "2024-01-09" }), // Mercosul: ok
    servicoImportado({ id: 9, placa: "AAA0005", km: null, kmRaw: "", data: "2024-01-10" }), // sem km
    servicoImportado({ id: 10, placa: "AAA0006", km: null, kmRaw: "4*", data: "2024-01-11" }), // km ilegível
    servicoImportado({ id: 11, placa: "AAA0007", km: null, kmRaw: "9999999", data: "2024-01-12" }), // km impossível
    servicoImportado({ id: 12, placa: "AAA0008", produto: "", data: "2024-01-13" }), // sem produto
    servicoImportado({ id: 13, placa: "AAA0009", carro: "", data: "2024-01-14" }), // sem carro
    servicoImportado({ id: 14, placa: "BBB0001", carro: "GOL 1.0", data: "2024-02-01" }),
    servicoImportado({ id: 15, placa: "BBB0001", carro: "UNO MILLE", data: "2024-03-01" }),
    servicoImportado({ id: 16, placa: "CCC0001", data: "2024-04-01" }),
    servicoImportado({ id: 17, placa: "CCC0001", data: "2024-04-01" }), // duplicado do 16
  ];

  beforeEach(() => semear(fixtures));

  it("conta a base confiável (com data e sem suspeita)", async () => {
    expect(await analises.contarBase()).toEqual({ total: 17, validos: 14 });
  });

  it("conta cada inconsistência com o mesmo filtro da listagem", async () => {
    expect(await analises.contarInconsistencias()).toEqual({
      semData: 1,
      dataNoFuturo: 1,
      dataAntesDe2000: 1,
      semPlaca: 1,
      placaForaDoPadrao: 2,
      semKm: 1,
      kmIlegivel: 2,
      semProduto: 1,
      semCarro: 1,
      mesmaPlacaCarrosDiferentes: 1,
      possiveisDuplicados: 2,
    });
  });

  it("lista km ilegível (inclui valores impossíveis), do mais recente ao mais antigo", async () => {
    const lista = await analises.listarInconsistencia("kmIlegivel", 200);
    expect(lista.map((servico) => servico.id)).toEqual([11, 10]);
    expect(lista[0].kmRaw).toBe("9999999");
  });

  it("lista datas no futuro e antes de 2000 separadamente", async () => {
    const futuro = await analises.listarInconsistencia("dataNoFuturo", 200);
    const antigas = await analises.listarInconsistencia("dataAntesDe2000", 200);
    expect(futuro.map((servico) => servico.id)).toEqual([3]);
    expect(antigas.map((servico) => servico.id)).toEqual([4]);
  });

  it("aceita os dois padrões de placa e flagra o resto", async () => {
    const lista = await analises.listarInconsistencia("placaForaDoPadrao", 200);
    expect(lista.map((servico) => servico.placa).sort()).toEqual(["AB1234", "AVJ4DS3"]);
  });

  it("respeita o limite da listagem", async () => {
    const lista = await analises.listarInconsistencia("placaForaDoPadrao", 1);
    expect(lista).toHaveLength(1);
  });

  it("lista possíveis duplicados agrupados (mesma placa, data e produto)", async () => {
    const lista = await analises.listarInconsistencia("possiveisDuplicados", 200);
    expect(lista.map((servico) => servico.id)).toEqual([16, 17]);
  });

  it("lista placas com descrições de carro diferentes", async () => {
    const lista = await analises.listarPlacasComCarrosDiferentes(200);
    expect(lista).toHaveLength(1);
    expect(lista[0].placa).toBe("BBB0001");
    expect(lista[0].variacoes).toBe(2);
    expect(lista[0].carros.split(" · ").sort()).toEqual(["GOL 1.0", "UNO MILLE"]);
  });
});

describe("números da oficina", () => {
  const fixtures: ServicoImportado[] = [
    // AAA0001: 3 visitas — intervalos de 60 e 306 dias
    servicoImportado({ id: 1, placa: "AAA0001", data: "2020-01-10", produto: "OLEO A" }),
    servicoImportado({ id: 2, placa: "AAA0001", data: "2020-03-10", produto: "OLEO A" }),
    servicoImportado({ id: 3, placa: "AAA0001", data: "2021-01-10", produto: "OLEO B" }),
    // BBB0002: visita única (não volta)
    servicoImportado({ id: 4, placa: "BBB0002", data: "2020-03-10", produto: "OLEO A" }),
    // CCC0003: dois lançamentos no mesmo dia (intervalo 0 não conta como retorno)
    servicoImportado({ id: 5, placa: "CCC0003", data: "2021-05-20", produto: "OLEO A" }),
    servicoImportado({ id: 6, placa: "CCC0003", data: "2021-05-20", produto: "OLEO C" }),
    // fora da base: data suspeita e sem data
    servicoImportado({ id: 7, placa: "DDD0004", data: "2042-01-01", dataSuspeita: true }),
    servicoImportado({ id: 8, placa: "EEE0005", data: null }),
  ];

  beforeEach(() => semear(fixtures));

  it("trocas por ano ignoram registros fora da base", async () => {
    expect(await analises.trocasPorAno()).toEqual([
      { ano: "2020", total: 3 },
      { ano: "2021", total: 3 },
    ]);
  });

  it("trocas por ano e mês", async () => {
    expect(await analises.trocasPorAnoEMes()).toEqual([
      { ano: "2020", mes: "01", total: 1 },
      { ano: "2020", mes: "03", total: 2 },
      { ano: "2021", mes: "01", total: 1 },
      { ano: "2021", mes: "05", total: 2 },
    ]);
  });

  it("placas distintas por ano deduplicam o mesmo carro no mesmo dia", async () => {
    expect(await analises.placasDistintasPorAno()).toEqual([
      { ano: "2020", total: 3 },
      { ano: "2021", total: 2 },
    ]);
  });

  it("faixas de retorno classificam os intervalos em meses", async () => {
    // 60 dias → "Até 3 meses" (faixa 0); 306 dias → "9 a 12 meses" (faixa 3)
    expect(await analises.faixasDeRetorno()).toEqual([
      { faixa: 0, total: 1 },
      { faixa: 3, total: 1 },
    ]);
  });

  it("retorno por ano usa o ano da visita de volta", async () => {
    expect(await analises.retornoPorAno()).toEqual([
      { ano: "2020", minimo: 60, media: 60, maximo: 60, total: 1 },
      { ano: "2021", minimo: 306, media: 306, maximo: 306, total: 1 },
    ]);
  });

  it("resumo de trocas por ano, mês e dia", async () => {
    expect(await analises.resumoDeTrocas("ano")).toEqual({ minimo: 3, media: 3, maximo: 3 });
    expect(await analises.resumoDeTrocas("mes")).toEqual({ minimo: 1, media: 1.5, maximo: 2 });
    expect(await analises.resumoDeTrocas("dia")).toEqual({ minimo: 1, media: 1.5, maximo: 2 });
  });

  it("resumo devolve null quando não há registros na base", async () => {
    await semear([]);
    expect(await analises.resumoDeTrocas("ano")).toBeNull();
    expect(await analises.retornoPorAno()).toEqual([]);
    expect((await analises.retornoDeClientes()).visitasPorCarro).toBeNull();
  });

  it("retorno de clientes: quem volta, quem não volta e as visitas por carro", async () => {
    expect(await analises.retornoDeClientes()).toEqual({
      voltam: 2,
      naoVoltam: 1,
      total: 3,
      visitasPorCarro: { minimo: 1, media: 2, maximo: 3 },
    });
  });

  it("sazonalidade cruza os anos por mês do calendário", async () => {
    expect(await analises.sazonalidade("2022-01")).toEqual([
      { mes: "01", minimo: 1, media: 1, maximo: 1 },
      { mes: "03", minimo: 2, media: 2, maximo: 2 },
      { mes: "05", minimo: 2, media: 2, maximo: 2 },
    ]);
  });

  it("sazonalidade deixa o mês corrente (incompleto) de fora", async () => {
    const linhas = await analises.sazonalidade("2021-05");
    expect(linhas.map((linha) => linha.mes)).toEqual(["01", "03"]);
  });

  it("comparativo do mês atual com o mesmo mês do ano passado", async () => {
    expect(await analises.comparativoDoMes("2021-05", "2020-05")).toEqual({
      mesAtual: 2,
      mesAnoPassado: 0,
    });
  });

  it("top produtos por quantidade", async () => {
    expect(await analises.topProdutos(2)).toEqual([
      { produto: "OLEO A", total: 4 },
      { produto: "OLEO B", total: 1 },
    ]);
  });

  it("o filtro de período restringe as agregações", async () => {
    const periodo = { deAno: "2020", ateAno: "2020" };
    expect(await analises.trocasPorAno(periodo)).toEqual([{ ano: "2020", total: 3 }]);
    // O corte das faixas é pelo ano da visita de volta: o retorno de jan/2021
    // (306 dias desde mar/2020) conta em 2021, mesmo com a ida em 2020.
    expect(await analises.faixasDeRetorno({ deAno: "2021", ateAno: "2021" })).toEqual([
      { faixa: 3, total: 1 },
    ]);
    expect(await analises.faixasDeRetorno({ deAno: "2020", ateAno: "2020" })).toEqual([
      { faixa: 0, total: 1 },
    ]);
  });

  it("anos disponíveis, do mais novo ao mais antigo", async () => {
    expect(await analises.anosDisponiveis()).toEqual(["2021", "2020"]);
  });
});
