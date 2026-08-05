import { useEffect, useState } from "react";
import { useRepositorio } from "../../data/ProvedorDeDados";
import { formatarDataBr, hojeIso } from "../../domain/datas";
import { resumirHistorico } from "../../domain/historico";
import type { Servico } from "../../domain/servico";
import { Carregando } from "../../ui/Carregando";
import { TabelaServicos } from "../../ui/TabelaServicos";
import { EditarServicoDialog } from "../editar-servico/EditarServicoDialog";

interface Props {
  placa: string;
  aoVoltar: () => void;
}

export function HistoricoPage({ placa, aoVoltar }: Props) {
  const repositorio = useRepositorio();
  const [visitas, setVisitas] = useState<Servico[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [emEdicao, setEmEdicao] = useState<Servico | null>(null);

  useEffect(() => {
    let cancelada = false;
    repositorio
      .historico(placa)
      .then((encontradas) => {
        if (!cancelada) setVisitas(encontradas);
      })
      .catch((causa) => {
        console.error("Histórico falhou:", causa);
        if (!cancelada) setErro("Não foi possível carregar o histórico — tente novamente.");
      });
    return () => {
      cancelada = true;
    };
  }, [repositorio, placa, versao]);

  if (erro !== null) {
    return (
      <section>
        <button type="button" className="botao-secundario no-print" onClick={aoVoltar}>
          ‹ Voltar
        </button>
        <p className="mensagem-erro">{erro}</p>
      </section>
    );
  }
  if (visitas === null) return <Carregando mensagem="Carregando histórico…" />;

  const resumo = resumirHistorico(visitas);

  return (
    <section>
      <div className="barra-de-acoes no-print">
        <button type="button" className="botao-secundario" onClick={aoVoltar}>
          ‹ Voltar
        </button>
        <button type="button" className="botao-secundario" onClick={() => window.print()}>
          🖨 Imprimir
        </button>
      </div>
      <header className="cabecalho-relatorio">
        <h2>Histórico do veículo {placa}</h2>
        <p>
          {resumo.carro} · {resumo.totalDeVisitas.toLocaleString("pt-BR")} visita
          {resumo.totalDeVisitas === 1 ? "" : "s"}
          {resumo.clienteDesde !== null && ` · cliente desde ${formatarDataBr(resumo.clienteDesde)}`}
        </p>
        <p className="so-impressao">
          Super Troca de Óleo Prado's — emitido em {formatarDataBr(hojeIso())}
        </p>
      </header>
      <TabelaServicos itens={visitas} aoClicarNaLinha={setEmEdicao} />
      {emEdicao !== null && (
        <EditarServicoDialog
          servico={emEdicao}
          aoFechar={() => setEmEdicao(null)}
          aoMudar={() => setVersao((atual) => atual + 1)}
        />
      )}
    </section>
  );
}
