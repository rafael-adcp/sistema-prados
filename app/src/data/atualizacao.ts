import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";

export interface AtualizacaoEncontrada {
  versao: string;
  baixarEInstalar: () => Promise<void>;
  reiniciar: () => Promise<void>;
}

/**
 * Vive num módulo próprio porque fala com o runtime do Tauri (rede + instalador)
 * — nos testes, isto aqui vira um mock, como o recarregarApp.
 *
 * A verificação é a única parte do app que usa internet. A loja pode estar sem
 * conexão no dia: falhar aqui não pode atrapalhar nada, e quem chama trata isso
 * como "não há atualização".
 */
export async function procurarAtualizacao(): Promise<AtualizacaoEncontrada | null> {
  const atualizacao = await check();
  if (atualizacao === null) return null;
  return {
    versao: atualizacao.version,
    baixarEInstalar: () => atualizacao.downloadAndInstall(),
    reiniciar: relaunch,
  };
}
