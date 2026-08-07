import { useEffect, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { useRepositorio } from "../../data/ProvedorDeDados";
import { formatarDataBr } from "../../domain/datas";
import { formatarKm } from "../../domain/km";
import { prefixoDePlaca } from "../../domain/placa";
import type { Servico } from "../../domain/servico";

const DEBOUNCE_MS = 150;
const MAXIMO_DE_SUGESTOES = 8;

interface Props {
  valor: string;
  aoDigitar: (placa: string) => void;
  aoEscolher: (sugestao: Servico) => void;
  ref?: Ref<HTMLInputElement>;
}

/** Campo de placa com autocomplete sobre as 47 mil placas já atendidas. */
export function CampoPlaca({ valor, aoDigitar, aoEscolher, ref }: Props) {
  const repositorio = useRepositorio();
  const [sugestoes, setSugestoes] = useState<Servico[]>([]);
  const [aberto, setAberto] = useState(false);
  /** -1 = nenhuma destacada; o Enter então salva o serviço, como sempre fez. */
  const [destacada, setDestacada] = useState(-1);
  const timerFechar = useRef<number | undefined>(undefined);

  useEffect(() => {
    const prefixo = prefixoDePlaca(valor);
    setDestacada(-1); // lista nova, destaque antigo não vale mais
    if (prefixo.length < 2) {
      setSugestoes([]);
      return;
    }
    let cancelada = false;
    const timer = setTimeout(() => {
      repositorio
        .sugestoesDePlaca(prefixo, MAXIMO_DE_SUGESTOES)
        .then((encontradas) => {
          if (!cancelada) setSugestoes(encontradas);
        })
        .catch((causa) => console.error("Autocomplete falhou:", causa));
    }, DEBOUNCE_MS);
    return () => {
      cancelada = true;
      clearTimeout(timer);
    };
  }, [repositorio, valor]);

  useEffect(() => () => clearTimeout(timerFechar.current), []);

  const escolher = (sugestao: Servico) => {
    setAberto(false);
    setDestacada(-1);
    aoEscolher(sugestao);
  };

  const mostrarLista = aberto && sugestoes.length > 0;

  /** Navegação por teclado: o foco nunca sai do campo — as opções são destacadas,
   *  não focadas (padrão combobox). Sem isto a lista só funcionava com o mouse. */
  const aoTeclar = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === "Escape") {
      setAberto(false);
      setDestacada(-1);
      return;
    }
    if (evento.key === "Enter" && mostrarLista && destacada >= 0) {
      evento.preventDefault(); // seleciona a placa em vez de submeter o formulário
      escolher(sugestoes[destacada]);
      return;
    }
    if (evento.key !== "ArrowDown" && evento.key !== "ArrowUp") return;
    evento.preventDefault();
    if (!aberto) {
      setAberto(true);
      return;
    }
    if (sugestoes.length === 0) return;
    const passo = evento.key === "ArrowDown" ? 1 : -1;
    setDestacada((atual) => {
      const proxima = atual + passo;
      if (proxima < 0) return sugestoes.length - 1;
      if (proxima >= sugestoes.length) return 0;
      return proxima;
    });
  };

  return (
    <div className="campo-placa">
      <input
        ref={ref}
        type="text"
        value={valor}
        placeholder="Ex.: ABC1234"
        autoComplete="off"
        spellCheck={false}
        maxLength={8}
        autoFocus
        role="combobox"
        aria-expanded={mostrarLista}
        aria-controls="sugestoes-de-placa"
        aria-autocomplete="list"
        aria-activedescendant={
          mostrarLista && destacada >= 0 ? `sugestao-${sugestoes[destacada].placa}` : undefined
        }
        onKeyDown={aoTeclar}
        onChange={(evento) => {
          aoDigitar(evento.target.value);
          setAberto(true);
        }}
        onFocus={() => {
          clearTimeout(timerFechar.current);
          setAberto(true);
        }}
        onBlur={() => {
          timerFechar.current = window.setTimeout(() => setAberto(false), 150);
        }}
      />
      {mostrarLista && (
        <ul className="sugestoes" id="sugestoes-de-placa" role="listbox">
          {sugestoes.map((sugestao, indice) => (
            <li key={sugestao.placa} role="presentation">
              <button
                type="button"
                id={`sugestao-${sugestao.placa}`}
                role="option"
                aria-selected={indice === destacada}
                className={indice === destacada ? "sugestao-destacada" : undefined}
                tabIndex={-1}
                // preventDefault segura o foco no campo; a escolha acontece no onClick,
                // que o mouse E o teclado disparam.
                onMouseDown={(evento) => evento.preventDefault()}
                onClick={() => escolher(sugestao)}
                onMouseEnter={() => setDestacada(indice)}
              >
                <strong>{sugestao.placa}</strong>
                <span>{sugestao.carro || "carro não informado"}</span>
                <span className="sugestao-data">
                  {formatarDataBr(sugestao.data)}
                  {sugestao.dataSuspeita && (
                    <span
                      className="badge-suspeita"
                      title="Data provavelmente digitada errada no sistema antigo"
                    >
                      ?
                    </span>
                  )}
                </span>
                {sugestao.produto !== "" && (
                  <span className="sugestao-produto">{sugestao.produto}</span>
                )}
                {formatarKm(sugestao.km, sugestao.kmRaw) !== "" && (
                  <span className="sugestao-km">{formatarKm(sugestao.km, sugestao.kmRaw)}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
