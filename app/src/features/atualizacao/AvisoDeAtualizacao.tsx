import { useEffect, useRef, useState } from "react";
import { procurarAtualizacao, type AtualizacaoEncontrada } from "../../data/atualizacao";

type Estado =
  | { fase: "procurando" }
  | { fase: "nada" }
  | { fase: "disponivel"; atualizacao: AtualizacaoEncontrada }
  | { fase: "instalando"; versao: string }
  | { fase: "erro"; mensagem: string };

/**
 * Aviso discreto de versão nova. Duas regras deliberadas:
 *
 * 1. Nunca instala sozinho. A loja atende com o app aberto; reiniciar no meio de
 *    um lançamento seria pior que ficar uma semana desatualizado.
 * 2. Falha na verificação é silenciosa. Sem internet no dia, o app tem de abrir
 *    e funcionar como sempre — só o console registra.
 */
export function AvisoDeAtualizacao() {
  const [estado, setEstado] = useState<Estado>({ fase: "procurando" });
  const jaProcurou = useRef(false);

  useEffect(() => {
    if (jaProcurou.current) return;
    jaProcurou.current = true;
    procurarAtualizacao()
      .then((atualizacao) => {
        setEstado(atualizacao === null ? { fase: "nada" } : { fase: "disponivel", atualizacao });
      })
      .catch((causa) => {
        console.error("Verificação de atualização falhou:", causa);
        setEstado({ fase: "nada" }); // offline não é erro para o usuário
      });
  }, []);

  const instalar = async (atualizacao: AtualizacaoEncontrada) => {
    setEstado({ fase: "instalando", versao: atualizacao.versao });
    try {
      await atualizacao.baixarEInstalar();
      await atualizacao.reiniciar();
    } catch (causa) {
      console.error("Atualização falhou:", causa);
      setEstado({
        fase: "erro",
        mensagem: `Não foi possível atualizar: ${causa}. O sistema continua funcionando normalmente.`,
      });
    }
  };

  if (estado.fase === "procurando" || estado.fase === "nada") return null;

  if (estado.fase === "erro") {
    return (
      <div className="banner-aviso no-print">
        <span>{estado.mensagem}</span>
        <button type="button" aria-label="Fechar aviso" onClick={() => setEstado({ fase: "nada" })}>
          ✕
        </button>
      </div>
    );
  }

  if (estado.fase === "instalando") {
    return (
      <div className="banner-aviso no-print">
        <span>Baixando a versão {estado.versao}… o sistema reinicia sozinho ao terminar.</span>
      </div>
    );
  }

  return (
    <div className="banner-aviso no-print">
      <span>Versão {estado.atualizacao.versao} disponível.</span>
      <span className="acoes-do-aviso">
        <button
          type="button"
          className="botao-principal"
          onClick={() => void instalar(estado.atualizacao)}
        >
          Atualizar agora
        </button>
        <button type="button" aria-label="Fechar aviso" onClick={() => setEstado({ fase: "nada" })}>
          ✕
        </button>
      </span>
    </div>
  );
}
