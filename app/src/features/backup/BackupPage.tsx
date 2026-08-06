import { ask, open } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
import { useBackup, useRepositorio } from "../../data/ProvedorDeDados";
import { recarregarApp } from "../../data/recarregarApp";
import { formatarDataBr } from "../../domain/datas";
import { Carregando } from "../../ui/Carregando";
import { MigracaoAccess } from "./MigracaoAccess";

interface Situacao {
  totalDeServicos: number;
  pastaDeBackup: string | null;
  ultimoBackupEm: string | null;
}

interface Mensagem {
  texto: string;
  tipo: "sucesso" | "erro";
}

/**
 * Um pouco mais longo que o aviso do Novo Serviço (6 s): aqui a mensagem traz o
 * caminho completo do arquivo, que a pessoa costuma querer ler até o fim.
 */
const DURACAO_DO_AVISO_MS = 9000;

export function BackupPage({ ativa }: { ativa: boolean }) {
  const repositorio = useRepositorio();
  const backup = useBackup();
  const [situacao, setSituacao] = useState<Situacao | null>(null);
  const [erroDaSituacao, setErroDaSituacao] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const recarregar = async () => {
    const [totalDeServicos, pastaDeBackup, ultimoBackupEm] = await Promise.all([
      repositorio.contarServicos(),
      backup.pastaConfigurada(),
      backup.ultimoBackupEm(),
    ]);
    setSituacao({ totalDeServicos, pastaDeBackup, ultimoBackupEm });
    setErroDaSituacao(null);
  };

  /**
   * Só o aviso de sucesso some sozinho. Erro fica até a pessoa fechar no ✕ —
   * "backup falhou" sumindo sozinho é exatamente o que não pode acontecer.
   */
  useEffect(() => {
    if (mensagem === null || mensagem.tipo === "erro") return;
    const temporizador = setTimeout(() => setMensagem(null), DURACAO_DO_AVISO_MS);
    return () => clearTimeout(temporizador);
  }, [mensagem]);

  useEffect(() => {
    if (!ativa) return;
    recarregar().catch((causa) => {
      console.error("Situação do backup falhou:", causa);
      setErroDaSituacao(String(causa));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativa]);

  const escolherPasta = async () => {
    const pasta = await open({ directory: true, title: "Escolha a pasta de backup" });
    if (typeof pasta !== "string") return;
    try {
      await backup.definirPasta(pasta);
      setMensagem({ texto: `Pasta de backup definida: ${pasta}`, tipo: "sucesso" });
      await recarregar();
    } catch (causa) {
      setMensagem({ texto: `Não foi possível definir a pasta: ${causa}`, tipo: "erro" });
    }
  };

  const fazerBackupAgora = async () => {
    if (situacao?.pastaDeBackup == null) return;
    setOcupado(true);
    try {
      const caminho = await backup.executarBackup(situacao.pastaDeBackup);
      setMensagem({ texto: `✓ Backup criado: ${caminho}`, tipo: "sucesso" });
      await recarregar();
    } catch (causa) {
      setMensagem({ texto: `Backup falhou: ${causa}`, tipo: "erro" });
    } finally {
      setOcupado(false);
    }
  };

  const importarBanco = async () => {
    if (situacao === null) return; // botão só existe com a situação carregada
    const arquivo = await open({
      title: "Escolha o arquivo prados.db exportado da migração",
      filters: [{ name: "Banco SQLite", extensions: ["db"] }],
    });
    if (typeof arquivo !== "string") return;

    // Conferir ANTES de perguntar: se o arquivo não for um banco do Prados, o
    // erro aparece sem nada ter sido tocado — e a pergunta mostra os dois números,
    // que é o que deixa óbvio quando o arquivo escolhido é o errado.
    let servicosNoArquivo: number;
    try {
      servicosNoArquivo = await backup.inspecionarBanco(arquivo);
    } catch (causa) {
      setMensagem({ texto: `Arquivo recusado: ${causa}`, tipo: "erro" });
      return;
    }

    const confirmado = await ask(
      `O arquivo escolhido tem ${servicosNoArquivo.toLocaleString("pt-BR")} serviços.\n` +
        `O sistema tem ${situacao.totalDeServicos.toLocaleString("pt-BR")} agora.\n\n` +
        "Isto SUBSTITUI todos os dados atuais pelo arquivo escolhido.\n" +
        "O banco atual fica guardado na pasta de dados como cópia de segurança.\nContinuar?",
      { title: "Restaurar banco de dados", kind: "warning" },
    );
    if (!confirmado) return;
    setOcupado(true);
    try {
      await backup.importarBanco(arquivo);
      recarregarApp();
    } catch (causa) {
      setMensagem({ texto: `Importação falhou: ${causa}`, tipo: "erro" });
      setOcupado(false);
    }
  };

  // Sem isto a aba ficava em branco para sempre — e com ela sumiam o backup e a
  // migração, que são justamente o que se procura quando algo deu errado.
  if (situacao === null) {
    return (
      <section className="backup">
        <h2>Backup e dados</h2>
        {erroDaSituacao === null ? (
          <Carregando mensagem="Lendo a situação do backup…" />
        ) : (
          <>
            <p className="mensagem-erro">
              Não foi possível ler a situação do backup: {erroDaSituacao}
            </p>
            <button
              type="button"
              className="botao-secundario"
              onClick={() =>
                void recarregar().catch((causa) => setErroDaSituacao(String(causa)))
              }
            >
              Tentar novamente
            </button>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="backup">
      <h2>Backup e dados</h2>
      {mensagem !== null && (
        <p
          className={`${mensagem.tipo === "sucesso" ? "mensagem-sucesso" : "mensagem-erro"} mensagem-fechavel`}
          role="status"
        >
          <span>{mensagem.texto}</span>
          <button type="button" aria-label="Fechar aviso" onClick={() => setMensagem(null)}>
            ✕
          </button>
        </p>
      )}

      <dl className="ficha">
        <dt>Serviços registrados</dt>
        <dd>{situacao.totalDeServicos.toLocaleString("pt-BR")}</dd>
        <dt>Pasta de backup</dt>
        <dd>{situacao.pastaDeBackup ?? "não configurada — escolha uma pasta abaixo"}</dd>
        <dt>Último backup</dt>
        <dd>{formatarDataBr(situacao.ultimoBackupEm)}</dd>
      </dl>

      <p className="texto-apoio">
        Com a pasta configurada, o sistema faz um backup sozinho uma vez por dia, ao abrir, e
        guarda os 10 últimos (os 10 últimos dias de uso). Use uma
        pasta do OneDrive ou um pendrive para ter cópia fora do computador.
      </p>

      <div className="barra-de-acoes">
        <button type="button" className="botao-secundario" onClick={() => void escolherPasta()}>
          Escolher pasta de backup…
        </button>
        <button
          type="button"
          className="botao-principal"
          disabled={ocupado || situacao.pastaDeBackup === null}
          onClick={() => void fazerBackupAgora()}
        >
          {ocupado ? "Fazendo backup…" : "Fazer backup agora"}
        </button>
      </div>

      <hr />
      <MigracaoAccess
        aoConcluir={(texto) => {
          setMensagem({ texto, tipo: "sucesso" });
          void recarregar();
        }}
        aoFalhar={(texto) => setMensagem({ texto, tipo: "erro" })}
      />

      <hr />
      <h3>Restaurar um banco pronto</h3>
      <p className="texto-apoio">
        Para carregar um arquivo <code>prados.db</code> (um backup ou um banco migrado em outra
        máquina). O banco atual fica guardado como cópia de segurança na pasta de dados.
      </p>
      <button type="button" className="botao-secundario" disabled={ocupado} onClick={() => void importarBanco()}>
        Restaurar banco de dados…
      </button>
    </section>
  );
}
