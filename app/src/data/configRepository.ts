import type { PortaDoBanco } from "./portaDoBanco";

/** Guarda pares chave/valor de configuração (pasta de backup, último backup…). */
export class ConfigRepository {
  constructor(private readonly db: PortaDoBanco) {}

  async ler(chave: string): Promise<string | null> {
    const linhas = await this.db.select<{ valor: string }[]>(
      "SELECT valor FROM config WHERE chave = $1",
      [chave],
    );
    return linhas.length > 0 ? linhas[0].valor : null;
  }

  async gravar(chave: string, valor: string): Promise<void> {
    await this.db.execute(
      "INSERT INTO config (chave, valor) VALUES ($1, $2) ON CONFLICT(chave) DO UPDATE SET valor = $2",
      [chave, valor],
    );
  }
}
