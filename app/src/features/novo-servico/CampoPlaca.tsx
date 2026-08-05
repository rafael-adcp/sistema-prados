import { useEffect, useRef, useState, type Ref } from "react";
import { useRepositorio } from "../../data/ProvedorDeDados";
import type { SugestaoDePlaca } from "../../data/servicoRepository";
import { formatarDataBr } from "../../domain/datas";
import { prefixoDePlaca } from "../../domain/placa";

const DEBOUNCE_MS = 150;
const MAXIMO_DE_SUGESTOES = 8;

interface Props {
  valor: string;
  aoDigitar: (placa: string) => void;
  aoEscolher: (sugestao: SugestaoDePlaca) => void;
  ref?: Ref<HTMLInputElement>;
}

/** Campo de placa com autocomplete sobre as 47 mil placas já atendidas. */
export function CampoPlaca({ valor, aoDigitar, aoEscolher, ref }: Props) {
  const repositorio = useRepositorio();
  const [sugestoes, setSugestoes] = useState<SugestaoDePlaca[]>([]);
  const [aberto, setAberto] = useState(false);
  const timerFechar = useRef<number | undefined>(undefined);

  useEffect(() => {
    const prefixo = prefixoDePlaca(valor);
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

  const escolher = (sugestao: SugestaoDePlaca) => {
    setAberto(false);
    aoEscolher(sugestao);
  };

  const mostrarLista = aberto && sugestoes.length > 0;

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
        <ul className="sugestoes">
          {sugestoes.map((sugestao) => (
            <li key={sugestao.placa}>
              <button type="button" onMouseDown={() => escolher(sugestao)}>
                <strong>{sugestao.placa}</strong>
                <span>{sugestao.carro || "carro não informado"}</span>
                <span className="sugestao-data">{formatarDataBr(sugestao.data)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
