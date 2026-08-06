import { useState } from "react";
import { useQualidade } from "../../data/ProvedorDeDados";
import type {
  ContagensDeInconsistencias,
  InconsistenciaListavel,
  PlacaComVariacoes,
} from "../../data/qualidadeRepository";
import type { Servico } from "../../domain/servico";
import { Carregando } from "../../ui/Carregando";
import { TabelaServicos } from "../../ui/TabelaServicos";
import { EditarServicoDialog } from "../editar-servico/EditarServicoDialog";

export const LIMITE_DA_LISTA = 200;

const RELATORIOS: { tipo: InconsistenciaListavel; titulo: string }[] = [
  { tipo: "semData", titulo: "Sem data" },
  { tipo: "dataNoFuturo", titulo: "Data no futuro" },
  { tipo: "dataAntesDe2000", titulo: "Data antes de 2000" },
  { tipo: "semPlaca", titulo: "Sem placa" },
  { tipo: "placaForaDoPadrao", titulo: "Placa fora do padrão" },
  { tipo: "semKm", titulo: "Sem quilometragem" },
  { tipo: "kmIlegivel", titulo: "Quilometragem ilegível ou impossível" },
  { tipo: "semProduto", titulo: "Sem produto" },
  { tipo: "semCarro", titulo: "Sem descrição do carro" },
  { tipo: "possiveisDuplicados", titulo: "Possíveis lançamentos duplicados" },
];

interface Props {
  contagens: ContagensDeInconsistencias;
  aoVerHistorico: (placa: string) => void;
  /** Um registro foi corrigido: o pai recarrega contagens e números. */
  aoMudar: () => void;
}

/** "carregando" era representado por `undefined`, o mesmo valor de "deu erro" —
 *  por isso uma falha prendia o acordeão em "Carregando registros…" para sempre. */
const ERRO = "erro" as const;
type Lista<T> = T[] | typeof ERRO | undefined;

export function SecaoQualidade({ contagens, aoVerHistorico, aoMudar }: Props) {
  const qualidade = useQualidade();
  const [listas, setListas] = useState<Partial<Record<InconsistenciaListavel, Lista<Servico>>>>({});
  const [placasDiferentes, setPlacasDiferentes] = useState<Lista<PlacaComVariacoes>>(undefined);
  const [emEdicao, setEmEdicao] = useState<Servico | null>(null);

  const carregarLista = (tipo: InconsistenciaListavel) => {
    setListas((atuais) => ({ ...atuais, [tipo]: undefined }));
    qualidade
      .listarInconsistencia(tipo, LIMITE_DA_LISTA)
      .then((lista) => setListas((atuais) => ({ ...atuais, [tipo]: lista })))
      .catch((causa) => {
        console.error("Lista de inconsistências falhou:", causa);
        setListas((atuais) => ({ ...atuais, [tipo]: ERRO }));
      });
  };

  const carregarPlacasDiferentes = () => {
    setPlacasDiferentes(undefined);
    qualidade
      .listarPlacasComCarrosDiferentes(LIMITE_DA_LISTA)
      .then(setPlacasDiferentes)
      .catch((causa) => {
        console.error("Placas com carros diferentes falhou:", causa);
        setPlacasDiferentes(ERRO);
      });
  };

  /** Erro visível com saída, no lugar do girador eterno. */
  const avisoDeFalha = (tentarDeNovo: () => void) => (
    <>
      <p className="mensagem-erro">Não foi possível carregar estes registros.</p>
      <button type="button" className="botao-secundario" onClick={tentarDeNovo}>
        Tentar novamente
      </button>
    </>
  );

  const aoAbrir = (tipo: InconsistenciaListavel, aberto: boolean) => {
    if (aberto && !(tipo in listas)) carregarLista(tipo);
  };

  /** Recarrega as listas já abertas e avisa o pai para refazer as contagens. */
  const aposCorrigir = () => {
    for (const tipo of Object.keys(listas) as InconsistenciaListavel[]) carregarLista(tipo);
    if (placasDiferentes !== undefined) carregarPlacasDiferentes();
    aoMudar();
  };

  return (
    <div className="secao-analises">
      <h3>Qualidade dos dados</h3>
      <p className="texto-apoio no-print">
        Registros com informação faltando ou estranha, herdados do sistema antigo. Clique num
        relatório para ver os registros e clique num registro para corrigi-lo.
      </p>
      {RELATORIOS.map(({ tipo, titulo }) => {
        const lista = listas[tipo];
        const contagem = contagens[tipo];
        return (
          <details
            key={tipo}
            className="acordeao"
            onToggle={(evento) => aoAbrir(tipo, evento.currentTarget.open)}
          >
            <summary>{`${titulo} (${contagem.toLocaleString("pt-BR")})`}</summary>
            <div className="corpo-acordeao">
              {lista === undefined ? (
                <Carregando mensagem="Carregando registros…" />
              ) : lista === ERRO ? (
                avisoDeFalha(() => carregarLista(tipo))
              ) : (
                <>
                  {contagem > LIMITE_DA_LISTA && (
                    <p className="aviso">
                      Mostrando {LIMITE_DA_LISTA} de {contagem.toLocaleString("pt-BR")} registros —
                      corrija estes que a lista traz os próximos.
                    </p>
                  )}
                  <TabelaServicos
                    itens={lista}
                    aoClicarNaPlaca={aoVerHistorico}
                    aoClicarNaLinha={setEmEdicao}
                  />
                </>
              )}
            </div>
          </details>
        );
      })}
      <details
        className="acordeao"
        onToggle={(evento) => {
          if (evento.currentTarget.open && placasDiferentes === undefined) {
            carregarPlacasDiferentes();
          }
        }}
      >
        <summary>{`Mesma placa com carros diferentes (${contagens.mesmaPlacaCarrosDiferentes.toLocaleString("pt-BR")})`}</summary>
        <div className="corpo-acordeao">
          {placasDiferentes === undefined ? (
            <Carregando mensagem="Carregando registros…" />
          ) : placasDiferentes === ERRO ? (
            avisoDeFalha(carregarPlacasDiferentes)
          ) : placasDiferentes.length === 0 ? (
            <p className="estado-vazio">Nenhuma placa com descrições diferentes.</p>
          ) : (
            <table className="tabela-servicos">
              <thead>
                <tr>
                  <th>Placa</th>
                  <th>Descrições encontradas</th>
                </tr>
              </thead>
              <tbody>
                {placasDiferentes.map((linha) => (
                  <tr key={linha.placa}>
                    <td className="col-placa">
                      <button
                        type="button"
                        className="link-placa"
                        title="Ver histórico deste veículo para corrigir"
                        onClick={() => aoVerHistorico(linha.placa)}
                      >
                        {linha.placa}
                      </button>
                    </td>
                    <td>{linha.carros}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </details>
      {emEdicao !== null && (
        <EditarServicoDialog
          servico={emEdicao}
          aoFechar={() => setEmEdicao(null)}
          aoMudar={aposCorrigir}
        />
      )}
    </div>
  );
}
