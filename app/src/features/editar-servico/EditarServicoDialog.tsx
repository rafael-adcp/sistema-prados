import { ask } from "@tauri-apps/plugin-dialog";
import { useRef, useState, type KeyboardEvent } from "react";
import { useRepositorio } from "../../data/ProvedorDeDados";
import { hojeIso } from "../../domain/datas";
import {
  paraEdicao,
  temProblemas,
  validarEdicaoDeServico,
  type NovoServico,
  type ProblemasDoServico,
  type Servico,
} from "../../domain/servico";
import { CampoComErro } from "../../ui/CampoComErro";

interface Props {
  servico: Servico;
  aoFechar: () => void;
  aoMudar: () => void; // avisar a lista para recarregar após salvar/excluir
}

export function EditarServicoDialog({ servico, aoFechar, aoMudar }: Props) {
  const repositorio = useRepositorio();
  const [formulario, setFormulario] = useState<NovoServico>(() => paraEdicao(servico));
  const [problemas, setProblemas] = useState<ProblemasDoServico>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  const alterar = (mudanca: Partial<NovoServico>) => {
    setFormulario((atual) => ({ ...atual, ...mudanca }));
  };

  const salvar = async () => {
    if (ocupado) return;
    const encontrados = validarEdicaoDeServico(formulario, hojeIso());
    setProblemas(encontrados);
    setErroGeral(null); // erro da tentativa anterior não fica pendurado junto com os novos
    if (temProblemas(encontrados)) return;
    setOcupado(true);
    try {
      await repositorio.atualizar(servico.id, formulario);
      aoMudar();
      aoFechar();
    } catch (causa) {
      setErroGeral(`Não foi possível salvar: ${causa}`);
      setOcupado(false);
    }
  };

  const excluir = async () => {
    if (ocupado) return;
    const confirmado = await ask(
      `Excluir o serviço nº ${servico.id.toLocaleString("pt-BR")}?\nEsta ação não pode ser desfeita.`,
      { title: "Excluir serviço", kind: "warning" },
    );
    if (!confirmado) return;
    setOcupado(true);
    try {
      await repositorio.excluir(servico.id);
      aoMudar();
      aoFechar();
    } catch (causa) {
      setErroGeral(`Não foi possível excluir: ${causa}`);
      setOcupado(false);
    }
  };

  /** Tab circula dentro do diálogo: sem isto o foco escapava para a tabela atrás. */
  const prenderFoco = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (evento.key !== "Tab" || caixa.current === null) return;
    const focaveis = caixa.current.querySelectorAll<HTMLElement>(
      "input:not([disabled]), button:not([disabled])",
    );
    if (focaveis.length === 0) return;
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (evento.shiftKey && document.activeElement === primeiro) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    }
  };

  return (
    // O fecha-no-fundo escuta mouseDown e confere o alvo: com onClick, arrastar
    // para selecionar texto e soltar fora fechava o diálogo e perdia a edição.
    <div
      className="fundo-modal"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) aoFechar();
      }}
    >
      <div
        ref={caixa}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Editar serviço ${servico.id}`}
        onKeyDown={(evento) => {
          if (evento.key === "Escape") {
            evento.stopPropagation();
            aoFechar();
            return;
          }
          prenderFoco(evento);
        }}
      >
        <h3>Editar serviço nº {servico.id.toLocaleString("pt-BR")}</h3>
        {erroGeral !== null && <p className="mensagem-erro">{erroGeral}</p>}
        <form
          onSubmit={(evento) => {
            evento.preventDefault();
            void salvar();
          }}
        >
          <div className="grupo-campos">
            <CampoComErro rotulo="Placa" erro={problemas.placa}>
              <input
                type="text"
                className="entrada-maiuscula"
                value={formulario.placa}
                maxLength={8}
                autoFocus
                onChange={(evento) => alterar({ placa: evento.target.value })}
              />
            </CampoComErro>
            <CampoComErro rotulo="Carro">
              <input
                type="text"
                className="entrada-maiuscula"
                value={formulario.carro}
                maxLength={60}
                onChange={(evento) => alterar({ carro: evento.target.value })}
              />
            </CampoComErro>
            <CampoComErro rotulo="Km">
              <input
                type="text"
                inputMode="numeric"
                value={formulario.kmRaw}
                maxLength={12}
                onChange={(evento) => alterar({ kmRaw: evento.target.value })}
              />
            </CampoComErro>
            <CampoComErro rotulo="Produto / Serviço" erro={problemas.produto}>
              <input
                type="text"
                className="entrada-maiuscula"
                value={formulario.produto}
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
          <div className="barra-de-acoes acoes-modal">
            <button type="submit" className="botao-principal" disabled={ocupado}>
              {ocupado ? "Salvando…" : "Salvar alterações"}
            </button>
            <button type="button" className="botao-secundario" onClick={aoFechar}>
              Cancelar
            </button>
            <button
              type="button"
              className="botao-perigo"
              disabled={ocupado}
              onClick={() => void excluir()}
            >
              Excluir…
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
