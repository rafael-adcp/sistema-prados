import { useEffect, useState } from "react";
import { useRepositorio } from "../../data/ProvedorDeDados";
import type { SugestaoDePlaca } from "../../data/servicoRepository";
import { hojeIso } from "../../domain/datas";
import { normalizarPlaca } from "../../domain/placa";
import {
  novoServicoVazio,
  validarNovoServico,
  type NovoServico,
  type Servico,
} from "../../domain/servico";
import { ListaDeProblemas } from "../../ui/ListaDeProblemas";
import { CampoPlaca } from "./CampoPlaca";
import { CartaoUltimaTroca } from "./CartaoUltimaTroca";

const TAMANHO_MINIMO_DE_PLACA = 6;

interface UltimaTroca {
  servico: Servico;
  totalDeVisitas: number;
}

export function NovoServicoPage({ aoVerHistorico }: { aoVerHistorico: (placa: string) => void }) {
  const repositorio = useRepositorio();
  const [formulario, setFormulario] = useState<NovoServico>(() => novoServicoVazio(hojeIso()));
  const [ultima, setUltima] = useState<UltimaTroca | null>(null);
  const [problemas, setProblemas] = useState<string[]>([]);
  const [idSalvo, setIdSalvo] = useState<number | null>(null);

  const alterar = (mudanca: Partial<NovoServico>) => {
    setFormulario((atual) => ({ ...atual, ...mudanca }));
  };

  const placaNormalizada = normalizarPlaca(formulario.placa);

  useEffect(() => {
    if (placaNormalizada.length < TAMANHO_MINIMO_DE_PLACA) {
      setUltima(null);
      return;
    }
    let cancelada = false;
    Promise.all([
      repositorio.ultimaTroca(placaNormalizada),
      repositorio.contarPorPlaca(placaNormalizada),
    ])
      .then(([servico, totalDeVisitas]) => {
        if (cancelada) return;
        setUltima(servico === null ? null : { servico, totalDeVisitas });
        if (servico !== null && servico.carro !== "") {
          setFormulario((atual) =>
            atual.carro === "" ? { ...atual, carro: servico.carro } : atual,
          );
        }
      })
      .catch((causa) => console.error("Última troca falhou:", causa));
    return () => {
      cancelada = true;
    };
  }, [repositorio, placaNormalizada]);

  const escolherSugestao = (sugestao: SugestaoDePlaca) => {
    alterar({ placa: sugestao.placa, carro: sugestao.carro });
  };

  const salvar = async () => {
    const encontrados = validarNovoServico(formulario);
    setProblemas(encontrados);
    if (encontrados.length > 0) return;
    try {
      const id = await repositorio.inserir(formulario);
      setIdSalvo(id);
      setUltima(null);
      setFormulario(novoServicoVazio(hojeIso()));
    } catch (causa) {
      setProblemas([`Não foi possível salvar: ${causa}`]);
    }
  };

  return (
    <section className="novo-servico">
      <h2>Novo Serviço</h2>
      {idSalvo !== null && (
        <p className="mensagem-sucesso">✓ Serviço nº {idSalvo.toLocaleString("pt-BR")} salvo.</p>
      )}
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          void salvar();
        }}
      >
        <div className="linha-formulario">
          <div className="grupo-campos">
            <label>
              Placa
              <CampoPlaca
                valor={formulario.placa}
                aoDigitar={(placa) => alterar({ placa })}
                aoEscolher={escolherSugestao}
              />
            </label>
            <label>
              Carro
              <input
                type="text"
                value={formulario.carro}
                placeholder="Ex.: GOL 1.0 16V"
                onChange={(evento) => alterar({ carro: evento.target.value.toUpperCase() })}
              />
            </label>
            <label>
              Km
              <input
                type="text"
                inputMode="numeric"
                value={formulario.kmRaw}
                placeholder="Ex.: 123456"
                onChange={(evento) => alterar({ kmRaw: evento.target.value })}
              />
            </label>
            <label>
              Produto / Serviço
              <input
                type="text"
                value={formulario.produto}
                placeholder="Ex.: 4 HAV 5W30 W6 MULTI"
                onChange={(evento) => alterar({ produto: evento.target.value.toUpperCase() })}
              />
            </label>
            <label>
              Data
              <input
                type="date"
                value={formulario.data}
                onChange={(evento) => alterar({ data: evento.target.value })}
              />
            </label>
          </div>
          {ultima !== null && (
            <CartaoUltimaTroca
              servico={ultima.servico}
              totalDeVisitas={ultima.totalDeVisitas}
              aoVerHistorico={aoVerHistorico}
            />
          )}
        </div>
        <ListaDeProblemas problemas={problemas} />
        <button type="submit" className="botao-principal">
          Salvar serviço
        </button>
      </form>
    </section>
  );
}
