import { useEffect, useRef, useState } from "react";
import { useRepositorio } from "../../data/ProvedorDeDados";
import type { SugestaoDePlaca } from "../../data/servicoRepository";
import { hojeIso } from "../../domain/datas";
import { normalizarPlaca } from "../../domain/placa";
import {
  novoServicoVazio,
  temProblemas,
  validarNovoServico,
  type NovoServico,
  type ProblemasDoServico,
  type Servico,
} from "../../domain/servico";
import { CampoComErro } from "../../ui/CampoComErro";
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
  const [problemas, setProblemas] = useState<ProblemasDoServico>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [idSalvo, setIdSalvo] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const placaRef = useRef<HTMLInputElement>(null);
  const kmRef = useRef<HTMLInputElement>(null);

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
    kmRef.current?.focus();
  };

  const formularioIntocado =
    formulario.placa === "" &&
    formulario.carro === "" &&
    formulario.kmRaw === "" &&
    formulario.produto === "";

  const salvar = async () => {
    if (salvando) return;
    // clique/Enter repetido logo após salvar: o formulário já está limpo — ignora
    if (idSalvo !== null && formularioIntocado) return;
    const encontrados = validarNovoServico(formulario, hojeIso());
    setProblemas(encontrados);
    setErroGeral(null);
    if (temProblemas(encontrados)) {
      setIdSalvo(null);
      return;
    }
    setSalvando(true);
    try {
      const id = await repositorio.inserir(formulario);
      setIdSalvo(id);
      setUltima(null);
      setFormulario(novoServicoVazio(hojeIso()));
      placaRef.current?.focus();
    } catch (causa) {
      setErroGeral(`Não foi possível salvar: ${causa}`);
      setIdSalvo(null);
    } finally {
      setSalvando(false);
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
            <CampoComErro rotulo="Placa" erro={problemas.placa}>
              <CampoPlaca
                ref={placaRef}
                valor={formulario.placa}
                aoDigitar={(placa) => alterar({ placa })}
                aoEscolher={escolherSugestao}
              />
            </CampoComErro>
            <CampoComErro rotulo="Carro">
              <input
                type="text"
                className="entrada-maiuscula"
                value={formulario.carro}
                placeholder="Ex.: GOL 1.0 16V"
                maxLength={60}
                onChange={(evento) => alterar({ carro: evento.target.value })}
              />
            </CampoComErro>
            <CampoComErro rotulo="Km">
              <input
                ref={kmRef}
                type="text"
                inputMode="numeric"
                value={formulario.kmRaw}
                placeholder="Ex.: 123456"
                maxLength={12}
                onChange={(evento) => alterar({ kmRaw: evento.target.value })}
              />
            </CampoComErro>
            <CampoComErro rotulo="Produto / Serviço" erro={problemas.produto}>
              <input
                type="text"
                className="entrada-maiuscula"
                value={formulario.produto}
                placeholder="Ex.: 4 HAV 5W30 W6 MULTI"
                maxLength={80}
                onChange={(evento) => alterar({ produto: evento.target.value })}
              />
            </CampoComErro>
            <CampoComErro rotulo="Data" erro={problemas.data}>
              <input
                type="date"
                value={formulario.data}
                min="2000-01-01"
                max={hojeIso()}
                onChange={(evento) => alterar({ data: evento.target.value })}
              />
            </CampoComErro>
          </div>
          {ultima !== null && (
            <CartaoUltimaTroca
              servico={ultima.servico}
              totalDeVisitas={ultima.totalDeVisitas}
              aoVerHistorico={aoVerHistorico}
            />
          )}
        </div>
        {erroGeral !== null && <p className="mensagem-erro">{erroGeral}</p>}
        <button type="submit" className="botao-principal" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar serviço"}
        </button>
      </form>
    </section>
  );
}
