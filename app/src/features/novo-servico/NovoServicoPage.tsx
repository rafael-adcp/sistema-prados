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
/** O aviso de salvo fica o bastante para ler e some sozinho. */
const DURACAO_DO_AVISO_MS = 6000;

interface UltimaTroca {
  servico: Servico;
  totalDeVisitas: number;
  /** A placa a que este cartão pertence — sem isto ele mostra os dados da placa anterior
   *  enquanto a consulta da placa nova ainda não voltou. */
  placa: string;
}

export function NovoServicoPage({ aoVerHistorico }: { aoVerHistorico: (placa: string) => void }) {
  const repositorio = useRepositorio();
  const [formulario, setFormulario] = useState<NovoServico>(() => novoServicoVazio(hojeIso()));
  const [ultima, setUltima] = useState<UltimaTroca | null>(null);
  const [problemas, setProblemas] = useState<ProblemasDoServico>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [idSalvo, setIdSalvo] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  /** Enquanto a pessoa não escolher uma data, o campo segue o dia de hoje. */
  const [dataEscolhidaAMao, setDataEscolhidaAMao] = useState(false);
  const placaRef = useRef<HTMLInputElement>(null);
  const kmRef = useRef<HTMLInputElement>(null);
  /** Último carro que o autopreenchimento escreveu. Só ele pode ser substituído por
   *  outro autopreenchimento — o que a pessoa digitou é intocável. */
  const carroAutoPreenchido = useRef<string | null>(null);

  const alterar = (mudanca: Partial<NovoServico>) => {
    setFormulario((atual) => ({ ...atual, ...mudanca }));
  };

  useEffect(() => {
    if (idSalvo === null) return;
    const temporizador = setTimeout(() => setIdSalvo(null), DURACAO_DO_AVISO_MS);
    return () => clearTimeout(temporizador);
  }, [idSalvo]);

  /**
   * A loja deixa o app aberto direto. Sem isto, o formulário guardava o `hojeIso()`
   * da última vez que foi semeado e o primeiro serviço de cada manhã era gravado
   * com a data de ontem — errado, plausível e portanto invisível.
   */
  useEffect(() => {
    if (dataEscolhidaAMao) return;
    const sincronizar = () => {
      const hoje = hojeIso();
      setFormulario((atual) => (atual.data === hoje ? atual : { ...atual, data: hoje }));
    };
    window.addEventListener("focus", sincronizar);
    document.addEventListener("visibilitychange", sincronizar);
    return () => {
      window.removeEventListener("focus", sincronizar);
      document.removeEventListener("visibilitychange", sincronizar);
    };
  }, [dataEscolhidaAMao]);

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
        setUltima(
          servico === null ? null : { servico, totalDeVisitas, placa: placaNormalizada },
        );
        if (servico !== null && servico.carro !== "") {
          const substituivel = carroAutoPreenchido.current;
          setFormulario((atual) =>
            atual.carro === "" || atual.carro === substituivel
              ? { ...atual, carro: servico.carro }
              : atual,
          );
          carroAutoPreenchido.current = servico.carro;
        }
      })
      .catch((causa) => console.error("Última troca falhou:", causa));
    return () => {
      cancelada = true;
    };
  }, [repositorio, placaNormalizada]);

  const escolherSugestao = (sugestao: SugestaoDePlaca) => {
    alterar({ placa: sugestao.placa, carro: sugestao.carro });
    carroAutoPreenchido.current = sugestao.carro;
    kmRef.current?.focus();
  };

  const formularioIntocado =
    formulario.placa === "" &&
    formulario.carro === "" &&
    formulario.kmRaw === "" &&
    formulario.produto === "";

  /** Recomeço do zero: campos, erros e cartão limpos, foco de volta na placa. */
  const limpar = () => {
    setFormulario(novoServicoVazio(hojeIso()));
    setProblemas({});
    setErroGeral(null);
    setIdSalvo(null);
    setUltima(null);
    carroAutoPreenchido.current = null;
    setDataEscolhidaAMao(false);
    placaRef.current?.focus();
  };

  const salvar = async () => {
    if (salvando) return;
    // clique/Enter repetido logo após salvar: o formulário já está limpo — ignora
    if (idSalvo !== null && formularioIntocado) return;
    const hoje = hojeIso();
    // Backstop do app que passou a virada do dia aberto: data não escolhida à mão é hoje.
    const aSalvar = dataEscolhidaAMao ? formulario : { ...formulario, data: hoje };
    const encontrados = validarNovoServico(aSalvar, hoje);
    setProblemas(encontrados);
    setErroGeral(null);
    if (temProblemas(encontrados)) {
      setIdSalvo(null);
      return;
    }
    setSalvando(true);
    try {
      const id = await repositorio.inserir(aSalvar);
      setIdSalvo(id);
      setUltima(null);
      carroAutoPreenchido.current = null;
      setDataEscolhidaAMao(false);
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
        <p className="mensagem-sucesso mensagem-fechavel">
          <span>✓ Serviço nº {idSalvo.toLocaleString("pt-BR")} salvo.</span>
          <button type="button" aria-label="Fechar aviso" onClick={() => setIdSalvo(null)}>
            ✕
          </button>
        </p>
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
                onChange={(evento) => {
                  setDataEscolhidaAMao(true);
                  alterar({ data: evento.target.value });
                }}
              />
            </CampoComErro>
          </div>
          {ultima !== null && ultima.placa === placaNormalizada && (
            <CartaoUltimaTroca
              servico={ultima.servico}
              totalDeVisitas={ultima.totalDeVisitas}
              aoVerHistorico={aoVerHistorico}
            />
          )}
        </div>
        {erroGeral !== null && <p className="mensagem-erro">{erroGeral}</p>}
        <div className="barra-de-acoes acoes-do-novo">
          <button type="submit" className="botao-principal" disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar serviço"}
          </button>
          <button
            type="button"
            className="botao-secundario"
            disabled={formularioIntocado}
            onClick={limpar}
          >
            Limpar campos
          </button>
        </div>
      </form>
    </section>
  );
}
