import type { ConfigRepository } from "./configRepository";

export const CONFIG_VERSAO = "versao_em_uso";
export const CONFIG_VERSAO_DESDE = "versao_em_uso_desde";

export interface VersaoEmUso {
  numero: string;
  /** Data ISO da primeira abertura NESTA versão; null enquanto não registrada. */
  desde: string | null;
}

/**
 * Qual versão está rodando e desde quando.
 *
 * O "desde quando" é a parte que importa na prática: sem ele, uma atualização que
 * falhou em silêncio é indistinguível de uma que deu certo. Com ele, dá para
 * conferir por telefone — "que número aparece aí embaixo, e desde quando?".
 *
 * É a data da primeira ABERTURA nesta versão, não a do instalador: é o que o
 * app consegue saber sozinho, e para o efeito prático dá no mesmo.
 */
export class VersaoService {
  constructor(
    private readonly config: ConfigRepository,
    private readonly obterVersao: () => Promise<string>,
  ) {}

  /** Chamado na abertura: carimba a data quando o número muda. */
  async registrarAbertura(hojeIso: string): Promise<VersaoEmUso> {
    const numero = await this.obterVersao();
    const anterior = await this.config.ler(CONFIG_VERSAO);
    if (anterior === numero) {
      return { numero, desde: await this.config.ler(CONFIG_VERSAO_DESDE) };
    }
    await this.config.gravar(CONFIG_VERSAO, numero);
    await this.config.gravar(CONFIG_VERSAO_DESDE, hojeIso);
    return { numero, desde: hojeIso };
  }

  /** Só leitura, para telas que exibem a informação sem carimbar nada. */
  async lerEmUso(): Promise<VersaoEmUso> {
    return {
      numero: await this.obterVersao(),
      desde: await this.config.ler(CONFIG_VERSAO_DESDE),
    };
  }
}
