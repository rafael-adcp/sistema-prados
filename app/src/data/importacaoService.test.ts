import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarBancoDeTeste, type BancoDeTeste } from "../testes/bancoDeTeste";
import { servicoImportado } from "../testes/renderComDados";
import {
  ImportacaoCancelada,
  ImportacaoService,
  type ProgressoDaImportacao,
} from "./importacaoService";
import { ServicoRepository } from "./servicoRepository";

const CSV_CHEIO = [
  "codigo,carro,km,placa,produto,data",
  '"2","PALIO","126.705","XYZ9876","3 SELENIA","2007-10-01"',
  '"7","SANTANA","\'\'\'\'","BFD 6186","3SL BR",""',
].join("\r\n");

/** O que o .ps1 escreve quando a tabela Produtos está vazia (arquivo errado/truncado). */
const CSV_SO_CABECALHO = "codigo,carro,km,placa,produto,data";

const conteudoDoCsv = vi.hoisted(() => ({ atual: "" }));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (comando: string) => {
    if (comando === "exportar_access") return "C:\\temp\\prados-servicos.csv";
    if (comando === "ler_arquivo_texto") return conteudoDoCsv.atual;
    throw new Error(`comando inesperado: ${comando}`);
  }),
}));

let banco: BancoDeTeste;
let repositorio: ServicoRepository;
let copiasTiradas: number;
const copiarBanco = async () => {
  copiasTiradas++;
  return "C:\\dados\\prados-antes-da-migracao-2026-08-06.db";
};

function criarServico() {
  return new ImportacaoService(repositorio, copiarBanco);
}

beforeEach(() => {
  banco = criarBancoDeTeste();
  repositorio = new ServicoRepository(banco);
  conteudoDoCsv.atual = CSV_CHEIO;
  copiasTiradas = 0;
});

afterEach(() => banco.fechar());

describe("ImportacaoService", () => {
  it("lê o Access via Rust, converte com as regras do domínio e grava tudo", async () => {
    const progresso: ProgressoDaImportacao[] = [];
    const servico = criarServico();

    const resultado = await servico.importarDoAccess("C:\\dados\\Sistema Prado.mdb", (p) =>
      progresso.push(p),
    );

    expect(resultado.servicos.length).toBe(2);
    expect(resultado.semData).toBe(1);
    expect(resultado.copiaDeSeguranca).toMatch(/prados-antes-da-migracao/);
    expect(copiasTiradas).toBe(1);
    expect(await repositorio.contarServicos()).toBe(2);

    const [santana] = await repositorio.historico("BFD6186"); // placa compactada
    expect(santana.id).toBe(7);
    expect(santana.km).toBeNull();
    expect(santana.kmRaw).toBe("''''");

    expect(progresso[0].etapa).toBe("lendo-access");
    expect(progresso.at(-1)).toEqual({ etapa: "importando", feitos: 2, total: 2 });
  });

  // O pior cenário do projeto: .mdb errado/vazio apagava os 140 mil serviços do
  // cliente e a tela mostrava "✓ Migração concluída: 0 serviços importados".
  it("recusa um .mdb sem nenhum serviço SEM tocar no banco", async () => {
    await repositorio.substituirTodosPor([
      servicoImportado({ id: 1, placa: "ABC1234" }),
      servicoImportado({ id: 2, placa: "GOL1234" }),
    ]);
    conteudoDoCsv.atual = CSV_SO_CABECALHO;

    await expect(
      criarServico().importarDoAccess("C:\\dados\\vazio.mdb", () => {}),
    ).rejects.toThrow(/não tem nenhum serviço/i);

    expect(await repositorio.contarServicos()).toBe(2);
    expect(copiasTiradas).toBe(0);
  });

  it("importação que encolhe a base só prossegue com confirmação", async () => {
    await repositorio.substituirTodosPor(
      Array.from({ length: 5 }, (_, i) => servicoImportado({ id: i + 1 })),
    );

    const recusar = vi.fn(async () => false);
    await expect(
      criarServico().importarDoAccess("C:\\dados\\antigo.mdb", () => {}, recusar),
    ).rejects.toBeInstanceOf(ImportacaoCancelada);

    expect(recusar).toHaveBeenCalledWith(2, 5);
    expect(await repositorio.contarServicos()).toBe(5); // intacto
    expect(copiasTiradas).toBe(0);
  });

  it("confirmada, a importação menor prossegue e guarda cópia antes de apagar", async () => {
    await repositorio.substituirTodosPor(
      Array.from({ length: 5 }, (_, i) => servicoImportado({ id: i + 1 })),
    );

    await criarServico().importarDoAccess("C:\\dados\\antigo.mdb", () => {}, async () => true);

    expect(await repositorio.contarServicos()).toBe(2);
    expect(copiasTiradas).toBe(1);
  });

  it("a cópia de segurança é tirada ANTES do DELETE, não depois", async () => {
    await repositorio.substituirTodosPor([servicoImportado({ id: 1 })]);
    let servicosQuandoCopiou: number | null = null;
    const servico = new ImportacaoService(repositorio, async () => {
      servicosQuandoCopiou = await repositorio.contarServicos();
      return "C:\\dados\\copia.db";
    });

    await servico.importarDoAccess("C:\\dados\\Sistema Prado.mdb", () => {});

    expect(servicosQuandoCopiou).toBe(1); // o banco antigo ainda estava lá
  });
});
