/**
 * Recarrega o app inteiro (após restaurar um banco, a conexão e todo o estado
 * das telas precisam nascer de novo). Vive num módulo próprio porque o jsdom
 * não implementa navegação — nos testes, isto aqui vira um mock.
 */
export function recarregarApp(): void {
  window.location.reload();
}
