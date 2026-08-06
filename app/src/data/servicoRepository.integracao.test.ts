import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hojeIso } from "../domain/datas";
import type { ServicoImportado } from "../domain/importarAccess";
import { criarBancoDeTeste, type BancoDeTeste } from "../testes/bancoDeTeste";
import { ServicoRepository } from "./servicoRepository";

let banco: BancoDeTeste;
let repositorio: ServicoRepository;

beforeEach(() => {
  banco = criarBancoDeTeste();
  repositorio = new ServicoRepository(banco);
});

afterEach(() => banco.fechar());

function importado(parcial: Partial<ServicoImportado> & { id: number }): ServicoImportado {
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

describe("inserir", () => {
  it("normaliza tudo na escrita e devolve o id", async () => {
    const id = await repositorio.inserir({
      carro: "gol 1.0",
      kmRaw: "126.705",
      placa: "abc-1234",
      produto: "3 sl",
      data: hojeIso(),
    });
    const [servico] = await repositorio.historico("ABC1234");
    expect(id).toBe(servico.id);
    expect(servico.carro).toBe("GOL 1.0");
    expect(servico.km).toBe(126705);
    expect(servico.kmRaw).toBe("126.705");
    expect(servico.placa).toBe("ABC1234");
    expect(servico.produto).toBe("3 SL");
    expect(servico.dataSuspeita).toBe(false);
  });

  it("marca data futura como suspeita já na gravação", async () => {
    await repositorio.inserir({
      carro: "",
      kmRaw: "",
      placa: "AAA0001",
      produto: "X",
      data: "2207-06-15",
    });
    const [servico] = await repositorio.historico("AAA0001");
    expect(servico.dataSuspeita).toBe(true);
  });

  it("continua os códigos a partir do maior id importado do Access", async () => {
    await semear([importado({ id: 140908 })]);
    const id = await repositorio.inserir({
      carro: "",
      kmRaw: "",
      placa: "BBB0002",
      produto: "X",
      data: hojeIso(),
    });
    expect(id).toBe(140909);
  });
});

describe("buscar", () => {
  beforeEach(() =>
    semear([
      importado({ id: 1, placa: "ABC1234", carro: "35S14", produto: "4 HAV", data: "2024-04-08" }),
      importado({ id: 2, placa: "ABC1234", carro: "35S14", produto: "3 SL", data: "2025-12-24" }),
      importado({ id: 3, placa: "GOL1234", carro: "UNO MILLE", produto: "PSL560", data: "2025-12-24" }),
      importado({ id: 4, placa: "", carro: "SEM PLACA 50% OFF", produto: "ADITIVO 50%", data: null }),
    ]),
  );

  it("vazia lista os mais recentes com total", async () => {
    const pagina = await repositorio.buscar({ tipo: "vazia" }, 0, 2);
    expect(pagina.total).toBe(4);
    expect(pagina.itens.map((s) => s.id)).toEqual([4, 3]);
  });

  it("pagina com offset", async () => {
    const pagina = await repositorio.buscar({ tipo: "vazia" }, 1, 2);
    expect(pagina.itens.map((s) => s.id)).toEqual([2, 1]);
  });

  it("por prefixo de placa via range", async () => {
    const pagina = await repositorio.buscar({ tipo: "placa", prefixo: "ABC" }, 0, 50);
    expect(pagina.total).toBe(2);
    expect(pagina.itens[0].data).toBe("2025-12-24");
  });

  it("por período de datas", async () => {
    const pagina = await repositorio.buscar(
      { tipo: "data", de: "2025-12-01", ate: "2025-12-31" },
      0,
      50,
    );
    expect(pagina.total).toBe(2);
  });

  it("texto procura em carro, produto E placa", async () => {
    expect((await repositorio.buscar({ tipo: "texto", termo: "UNO" }, 0, 50)).total).toBe(1);
    expect((await repositorio.buscar({ tipo: "texto", termo: "HAV" }, 0, 50)).total).toBe(1);
    expect((await repositorio.buscar({ tipo: "texto", termo: "6914" }, 0, 50)).total).toBe(2);
  });

  // O LIKE do SQLite só ignora caixa em ASCII: sem subir o termo para maiúsculas,
  // "camarão" não achava "CAMARÃO" e o balconista concluía que o serviço sumiu.
  it("acha texto acentuado digitado em minúsculas", async () => {
    // gravado pelo caminho normal do balcão, que já sobe tudo para maiúsculas
    await repositorio.inserir({
      placa: "CAM0001",
      carro: "Golf 2.0 8V",
      kmRaw: "120000",
      produto: "5 ELAION SEMI obs tr Camarão",
      data: "2025-11-03",
    });

    expect((await repositorio.buscar({ tipo: "texto", termo: "camarão" }, 0, 50)).total).toBe(1);
    expect((await repositorio.buscar({ tipo: "texto", termo: "golf" }, 0, 50)).total).toBe(1);
    expect((await repositorio.buscar({ tipo: "carro", termo: "golf 2.0" }, 0, 50)).total).toBe(1);
  });

  it("escapa os curingas do LIKE: buscar 50% acha só o aditivo", async () => {
    expect((await repositorio.buscar({ tipo: "texto", termo: "50%" }, 0, 50)).total).toBe(1);
    expect((await repositorio.buscar({ tipo: "texto", termo: "_" }, 0, 50)).total).toBe(0);
  });

  it("carro filtra só a coluna carro (relatórios)", async () => {
    expect((await repositorio.buscar({ tipo: "carro", termo: "PSL560" }, 0, 50)).total).toBe(0);
    expect((await repositorio.buscar({ tipo: "carro", termo: "35S14" }, 0, 50)).total).toBe(2);
  });
});

describe("ultimaTroca / contarPorPlaca / historico", () => {
  it("última troca ignora registro com data suspeita", async () => {
    await semear([
      importado({ id: 1, placa: "ABC1234", data: "2107-05-10", dataSuspeita: true, produto: "ERRADO" }),
      importado({ id: 2, placa: "ABC1234", data: "2025-12-24", produto: "CERTO" }),
    ]);
    const ultima = await repositorio.ultimaTroca("abc-1234");
    expect(ultima?.produto).toBe("CERTO");
  });

  it("se só há registros suspeitos, ainda devolve algum", async () => {
    await semear([importado({ id: 1, placa: "ABC1234", data: "2107-05-10", dataSuspeita: true })]);
    expect(await repositorio.ultimaTroca("ABC1234")).not.toBeNull();
  });

  it("placa desconhecida devolve null e contagem zero", async () => {
    expect(await repositorio.ultimaTroca("ZZZ9999")).toBeNull();
    expect(await repositorio.contarPorPlaca("ZZZ9999")).toBe(0);
  });

  it("histórico vem em ordem cronológica inversa", async () => {
    await semear([
      importado({ id: 1, placa: "ABC1234", data: "2024-04-08" }),
      importado({ id: 2, placa: "ABC1234", data: "2025-12-24" }),
    ]);
    const historico = await repositorio.historico("ABC1234");
    expect(historico.map((s) => s.id)).toEqual([2, 1]);
    expect(await repositorio.contarPorPlaca("ABC1234")).toBe(2);
  });
});

describe("sugestoesDePlaca", () => {
  it("uma sugestão por placa, com o carro da visita mais recente, sem placas vazias", async () => {
    await semear([
      importado({ id: 1, placa: "ABC1234", carro: "ANTIGO", data: "2019-07-19" }),
      importado({ id: 2, placa: "ABC1234", carro: "35S14", data: "2024-04-08" }),
      importado({ id: 3, placa: "ABC1230", carro: "DAIKY", data: "2020-01-01" }),
      importado({ id: 4, placa: "", carro: "FANTASMA", data: "2026-01-01" }),
    ]);
    const sugestoes = await repositorio.sugestoesDePlaca("ABC", 8);
    expect(sugestoes.map((s) => s.placa)).toEqual(["ABC1230", "ABC1234"]);
    expect(sugestoes[1].carro).toBe("35S14");
  });
});

describe("atualizar / excluir", () => {
  it("atualiza normalizando e recalculando a flag de data", async () => {
    await semear([importado({ id: 10 })]);
    await repositorio.atualizar(10, {
      carro: "novo carro",
      kmRaw: "200.000",
      placa: "bbb-2222",
      produto: "novo produto",
      data: "2207-01-01",
    });
    const [servico] = await repositorio.historico("BBB2222");
    expect(servico.id).toBe(10);
    expect(servico.carro).toBe("NOVO CARRO");
    expect(servico.km).toBe(200000);
    expect(servico.dataSuspeita).toBe(true);
  });

  it("edição de legado pode manter data vazia (vira NULL)", async () => {
    await semear([importado({ id: 10 })]);
    await repositorio.atualizar(10, { carro: "X", kmRaw: "", placa: "AAA0001", produto: "Y", data: "" });
    const [servico] = await repositorio.historico("AAA0001");
    expect(servico.data).toBeNull();
    expect(servico.dataSuspeita).toBe(false);
  });

  it("excluir remove só o registro pedido", async () => {
    await semear([importado({ id: 1 }), importado({ id: 2 })]);
    await repositorio.excluir(1);
    expect(await repositorio.contarServicos()).toBe(1);
  });
});

describe("substituirTodosPor", () => {
  it("substitui tudo preservando códigos, em lotes maiores que 100", async () => {
    await semear([importado({ id: 999 })]);
    const muitos = Array.from({ length: 250 }, (_, i) => importado({ id: i + 1 }));
    let ultimoProgresso = 0;
    const total = await repositorio.substituirTodosPor(muitos, (feitos) => {
      ultimoProgresso = feitos;
    });
    expect(total).toBe(250);
    expect(ultimoProgresso).toBe(250);
    expect(await repositorio.contarServicos()).toBe(250);
    expect(await repositorio.contarPorPlaca("AAA0001")).toBe(250);
  });
});
