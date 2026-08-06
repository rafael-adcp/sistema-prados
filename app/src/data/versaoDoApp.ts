import { getVersion } from "@tauri-apps/api/app";

/**
 * A versão vem do binário (tauri.conf.json em tempo de build), não de uma
 * constante no código — assim ela nunca mente sobre o que está instalado.
 * Vive num módulo próprio porque fala com o runtime do Tauri: nos testes, mock.
 */
export function versaoDoApp(): Promise<string> {
  return getVersion();
}
