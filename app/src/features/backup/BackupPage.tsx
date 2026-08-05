import { invoke } from "@tauri-apps/api/core";
import { ask, open } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
import { useBackup, useRepositorio } from "../../data/ProvedorDeDados";
import { fecharBanco } from "../../data/database";
import { formatarDataBr } from "../../domain/datas";

interface Situacao {
  totalDeServicos: number;
  pastaDeBackup: string | null;
  ultimoBackupEm: string | null;
}

export function BackupPage() {
  const repositorio = useRepositorio();
  const backup = useBackup();
  const [situacao, setSituacao] = useState<Situacao | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const recarregar = async () => {
    const [totalDeServicos, pastaDeBackup, ultimoBackupEm] = await Promise.all([
      repositorio.contarServicos(),
      backup.pastaConfigurada(),
      backup.ultimoBackupEm(),
    ]);
    setSituacao({ totalDeServicos, pastaDeBackup, ultimoBackupEm });
  };

  useEffect(() => {
    recarregar().catch((causa) => console.error("Situação do backup falhou:", causa));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const escolherPasta = async () => {
    const pasta = await open({ directory: true, title: "Escolha a pasta de backup" });
    if (typeof pasta !== "string") return;
    await backup.definirPasta(pasta);
    setMensagem(`Pasta de backup definida: ${pasta}`);
    await recarregar();
  };

  const fazerBackupAgora = async () => {
    if (situacao?.pastaDeBackup == null) return;
    setOcupado(true);
    try {
      const caminho = await backup.executarBackup(situacao.pastaDeBackup);
      setMensagem(`✓ Backup criado: ${caminho}`);
      await recarregar();
    } catch (causa) {
      setMensagem(`Backup falhou: ${causa}`);
    } finally {
      setOcupado(false);
    }
  };

  const importarBanco = async () => {
    const arquivo = await open({
      title: "Escolha o arquivo prados.db exportado da migração",
      filters: [{ name: "Banco SQLite", extensions: ["db"] }],
    });
    if (typeof arquivo !== "string") return;
    const confirmado = await ask(
      "Isto SUBSTITUI todos os dados atuais pelo arquivo escolhido. Continuar?",
      { title: "Importar banco de dados", kind: "warning" },
    );
    if (!confirmado) return;
    setOcupado(true);
    try {
      await fecharBanco();
      await invoke("substituir_banco", { caminhoOrigem: arquivo });
      window.location.reload();
    } catch (causa) {
      setMensagem(`Importação falhou: ${causa}`);
      setOcupado(false);
    }
  };

  if (situacao === null) return null;

  return (
    <section className="backup">
      <h2>Backup e dados</h2>
      {mensagem !== null && <p className="mensagem-sucesso">{mensagem}</p>}

      <dl className="ficha">
        <dt>Serviços registrados</dt>
        <dd>{situacao.totalDeServicos.toLocaleString("pt-BR")}</dd>
        <dt>Pasta de backup</dt>
        <dd>{situacao.pastaDeBackup ?? "não configurada — escolha uma pasta abaixo"}</dd>
        <dt>Último backup</dt>
        <dd>{formatarDataBr(situacao.ultimoBackupEm)}</dd>
      </dl>

      <p className="texto-apoio">
        Com a pasta configurada, o sistema faz um backup sozinho a cada 7 dias ao abrir. Use uma
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
      <h3>Importar dados</h3>
      <p className="texto-apoio">
        Usado uma única vez, na primeira instalação, para carregar o banco gerado pela migração do
        Access (arquivo <code>prados.db</code>).
      </p>
      <button type="button" className="botao-secundario" disabled={ocupado} onClick={() => void importarBanco()}>
        Importar banco de dados…
      </button>
    </section>
  );
}
