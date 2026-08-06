import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ServicoImportado } from "../domain/importarAccess";
import { criarBancoDeTeste, type BancoDeTeste } from "../testes/bancoDeTeste";
import { QualidadeRepository } from "./qualidadeRepository";
import { ServicoRepository } from "./servicoRepository";

let banco: BancoDeTeste;
let repositorio: ServicoRepository;
let qualidade: QualidadeRepository;

beforeEach(() => {
  banco = criarBancoDeTeste();
  repositorio = new ServicoRepository(banco);
  qualidade = new QualidadeRepository(banco);
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
    expect(await qualidade.contarBase()).toEqual({ total: 17, validos: 14 });
  });

  it("conta cada inconsistência com o mesmo filtro da listagem", async () => {
    expect(await qualidade.contarInconsistencias()).toEqual({
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
    const lista = await qualidade.listarInconsistencia("kmIlegivel", 200);
    expect(lista.map((servico) => servico.id)).toEqual([11, 10]);
    expect(lista[0].kmRaw).toBe("9999999");
  });

  it("lista datas no futuro e antes de 2000 separadamente", async () => {
    const futuro = await qualidade.listarInconsistencia("dataNoFuturo", 200);
    const antigas = await qualidade.listarInconsistencia("dataAntesDe2000", 200);
    expect(futuro.map((servico) => servico.id)).toEqual([3]);
    expect(antigas.map((servico) => servico.id)).toEqual([4]);
  });

  it("aceita os dois padrões de placa e flagra o resto", async () => {
    const lista = await qualidade.listarInconsistencia("placaForaDoPadrao", 200);
    expect(lista.map((servico) => servico.placa).sort()).toEqual(["AB1234", "AVJ4DS3"]);
  });

  it("respeita o limite da listagem", async () => {
    const lista = await qualidade.listarInconsistencia("placaForaDoPadrao", 1);
    expect(lista).toHaveLength(1);
  });

  it("lista possíveis duplicados agrupados (mesma placa, data e produto)", async () => {
    const lista = await qualidade.listarInconsistencia("possiveisDuplicados", 200);
    expect(lista.map((servico) => servico.id)).toEqual([16, 17]);
  });

  it("lista placas com descrições de carro diferentes", async () => {
    const lista = await qualidade.listarPlacasComCarrosDiferentes(200);
    expect(lista).toHaveLength(1);
    expect(lista[0].placa).toBe("BBB0001");
    expect(lista[0].variacoes).toBe(2);
    expect(lista[0].carros.split(" · ").sort()).toEqual(["GOL 1.0", "UNO MILLE"]);
  });
});
