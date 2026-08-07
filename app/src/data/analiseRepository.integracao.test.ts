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

describe("números da oficina", () => {
  const fixtures: ServicoImportado[] = [
    // AAA0001: 3 visitas — intervalos de 60 e 306 dias
    servicoImportado({ id: 1, placa: "AAA0001", data: "2020-01-10", produto: "OLEO A" }),
    servicoImportado({ id: 2, placa: "AAA0001", data: "2020-03-10", produto: "OLEO A" }),
    servicoImportado({ id: 3, placa: "AAA0001", data: "2021-01-10", produto: "OLEO B" }),
    // BBB0002: visita única (não volta)
    servicoImportado({ id: 4, placa: "BBB0002", data: "2020-03-10", produto: "OLEO A", carro: "UNO MILLE" }),
    // CCC0003: dois lançamentos no mesmo dia (intervalo 0 não conta como retorno)
    servicoImportado({ id: 5, placa: "CCC0003", data: "2021-05-20", produto: "OLEO A", carro: "FUSCA 1300" }),
    servicoImportado({ id: 6, placa: "CCC0003", data: "2021-05-20", produto: "OLEO C", carro: "FUSCA 1300" }),
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

  // AAA0001 visitou 2x em 2020 (jan e mar) e conta 1; BBB0002 conta 1.
  // O BI de 2016 devolvia 3 aqui, porque contava placa-dia em vez de placa.
  it("carros diferentes por ano contam o mesmo carro uma vez, mesmo voltando", async () => {
    expect(await analises.placasDistintasPorAno()).toEqual([
      { ano: "2020", total: 2 },
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
      { nome: "OLEO A", total: 4 },
      { nome: "OLEO B", total: 1 },
    ]);
  });

  // GOL 1.0 (AAA, 3 trocas), FUSCA 1300 (CCC, 2) e UNO MILLE (BBB, 1).
  it("top carros por quantidade", async () => {
    expect(await analises.topCarros(2)).toEqual([
      { nome: "GOL 1.0", total: 3 },
      { nome: "FUSCA 1300", total: 2 },
    ]);
    expect(await analises.topCarros(10, { deAno: "2020", ateAno: "2020" })).toEqual([
      { nome: "GOL 1.0", total: 2 },
      { nome: "UNO MILLE", total: 1 },
    ]);
  });

  it("carros por ano limita ao top global e conta cada ano", async () => {
    expect(await analises.carrosPorAno(2)).toEqual([
      { nome: "GOL 1.0", ano: "2020", total: 2 },
      { nome: "FUSCA 1300", ano: "2021", total: 2 },
      { nome: "GOL 1.0", ano: "2021", total: 1 },
    ]);
  });

  // Até 2020 o FUSCA (só de 2021) não existia e nada de 2021 é desenhado:
  // o corte mostra o gráfico como ele existiria naquele ano.
  it("o corte até um ano mostra a base como estava então", async () => {
    expect(await analises.carrosPorAno(2, "2020")).toEqual([
      { nome: "GOL 1.0", ano: "2020", total: 2 },
      { nome: "UNO MILLE", ano: "2020", total: 1 },
    ]);
    expect(await analises.produtosPorAno(2, "2020")).toEqual([
      { nome: "OLEO A", ano: "2020", total: 3 },
    ]);
  });

  // Os dois intervalos do AAA0001 (60 e 306 dias) começam em troca de OLEO A —
  // o produto da visita ANTERIOR é quem leva o retorno, não o da volta.
  it("retorno por produto agrupa pelo produto da visita anterior", async () => {
    expect(await analises.retornoPorProduto(10)).toEqual([
      { produto: "OLEO A", retornos: 2, media: 183 },
    ]);
    // O corte é pelo ano da visita de volta, como nas faixas de retorno.
    expect(await analises.retornoPorProduto(10, { deAno: "2021", ateAno: "2021" })).toEqual([
      { produto: "OLEO A", retornos: 1, media: 306 },
    ]);
  });

  // AAA fez 3 visitas (faixa "2 a 3"), BBB 1 ("1 visita") e CCC 2 ("2 a 3").
  it("carros por faixa de visitas", async () => {
    expect(await analises.carrosPorFaixaDeVisitas()).toEqual([
      { faixa: 0, total: 1 },
      { faixa: 1, total: 2 },
    ]);
    expect(await analises.carrosPorFaixaDeVisitas({ deAno: "2020", ateAno: "2020" })).toEqual([
      { faixa: 0, total: 1 },
      { faixa: 1, total: 1 },
    ]);
  });

  // Com só 3 carros não existe "20%" (floor(3/5) = 0): tudo zera, menos o total.
  it("concentração de clientes zera o topo quando há menos de 5 carros", async () => {
    expect(await analises.concentracaoDeClientes()).toEqual({
      carrosNoTopo: 0,
      trocasDoTopo: 0,
      trocasTotal: 6,
    });
  });

  // AAA e BBB estreiam em 2020; em 2021 o AAA volta (recorrente) e o CCC estreia.
  it("novos e recorrentes por ano somam os carros distintos do ano", async () => {
    expect(await analises.novosERecorrentesPorAno()).toEqual([
      { ano: "2020", novos: 2, recorrentes: 0 },
      { ano: "2021", novos: 1, recorrentes: 1 },
    ]);
  });

  // Dos novos de 2020, só AAA voltou; CCC (2021) tem 2 lançamentos no MESMO dia,
  // que não contam como retorno — o critério é serviço em outra data.
  it("retorno dos novos: quantos estreantes de cada ano voltaram depois", async () => {
    expect(await analises.retornoDosNovosPorAno()).toEqual([
      { ano: "2020", novos: 2, voltaram: 1 },
      { ano: "2021", novos: 1, voltaram: 0 },
    ]);
  });

  // 2020-01-10 sexta, 2020-03-10 terça (2×), 2021-01-10 domingo, 2021-05-20 quinta (2×).
  it("trocas por dia da semana na numeração do SQLite (0 = domingo)", async () => {
    expect(await analises.trocasPorDiaDaSemana()).toEqual([
      { dia: "0", total: 1 },
      { dia: "2", total: 2 },
      { dia: "4", total: 2 },
      { dia: "5", total: 1 },
    ]);
    expect(await analises.trocasPorDiaDaSemana({ deAno: "2020", ateAno: "2020" })).toEqual([
      { dia: "2", total: 2 },
      { dia: "5", total: 1 },
    ]);
  });

  // Top global: OLEO A (4 usos) e, no empate entre B e C, o alfabético OLEO B.
  it("produtos por ano limita ao top global e conta cada ano", async () => {
    expect(await analises.produtosPorAno(2)).toEqual([
      { nome: "OLEO A", ano: "2020", total: 3 },
      { nome: "OLEO A", ano: "2021", total: 1 },
      { nome: "OLEO B", ano: "2021", total: 1 },
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

describe("concentração de clientes com base maior", () => {
  // 5 carros: o topo é exatamente 1 (20%). AAA fez 5 das 9 trocas — 56%.
  it("mede quanto das trocas vem do quinto mais fiel", async () => {
    await semear([
      ...[1, 2, 3, 4, 5].map((i) =>
        servicoImportado({ id: i, placa: "AAA0001", data: `2024-0${i}-10` }),
      ),
      servicoImportado({ id: 6, placa: "BBB0002", data: "2024-01-15" }),
      servicoImportado({ id: 7, placa: "CCC0003", data: "2024-02-15" }),
      servicoImportado({ id: 8, placa: "DDD0004", data: "2024-03-15" }),
      servicoImportado({ id: 9, placa: "EEE0005", data: "2024-04-15" }),
    ]);
    expect(await analises.concentracaoDeClientes()).toEqual({
      carrosNoTopo: 1,
      trocasDoTopo: 5,
      trocasTotal: 9,
    });
  });
});
