import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarBancoDeTeste, type BancoDeTeste } from "../testes/bancoDeTeste";
import { ImportacaoService, type ProgressoDaImportacao } from "./importacaoService";
import { ServicoRepository } from "./servicoRepository";

const CSV = [
  "codigo,carro,km,placa,produto,data",
  '"2","PALIO","126.705","XYZ9876","3 SELENIA","2007-10-01"',
  '"7","SANTANA","\'\'\'\'","BFD 6186","3SL BR",""',
].join("\r\n");

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (comando: string) => {
    if (comando === "exportar_access") return "C:\\temp\\prados-servicos.csv";
    if (comando === "ler_arquivo_texto") return CSV;
    throw new Error(`comando inesperado: ${comando}`);
  }),
}));

let banco: BancoDeTeste;
let repositorio: ServicoRepository;

beforeEach(() => {
  banco = criarBancoDeTeste();
  repositorio = new ServicoRepository(banco);
});

afterEach(() => banco.fechar());

describe("ImportacaoService", () => {
  it("lê o Access via Rust, converte com as regras do domínio e grava tudo", async () => {
    const progresso: ProgressoDaImportacao[] = [];
    const servico = new ImportacaoService(repositorio);

    const resultado = await servico.importarDoAccess("C:\\dados\\Sistema Prado.mdb", (p) =>
      progresso.push(p),
    );

    expect(resultado.servicos.length).toBe(2);
    expect(resultado.semData).toBe(1);
    expect(await repositorio.contarServicos()).toBe(2);

    const [santana] = await repositorio.historico("BFD6186"); // placa compactada
    expect(santana.id).toBe(7);
    expect(santana.km).toBeNull();
    expect(santana.kmRaw).toBe("''''");

    expect(progresso[0].etapa).toBe("lendo-access");
    expect(progresso.at(-1)).toEqual({ etapa: "importando", feitos: 2, total: 2 });
  });
});
