interface Props {
  pagina: number;
  totalDeItens: number;
  itensPorPagina: number;
  aoMudar: (pagina: number) => void;
}

export function Paginacao({ pagina, totalDeItens, itensPorPagina, aoMudar }: Props) {
  const totalDePaginas = Math.max(1, Math.ceil(totalDeItens / itensPorPagina));
  if (totalDePaginas === 1) return null;
  return (
    <div className="paginacao no-print">
      <button type="button" disabled={pagina === 0} onClick={() => aoMudar(pagina - 1)}>
        ‹ Anterior
      </button>
      <span>
        Página {pagina + 1} de {totalDePaginas.toLocaleString("pt-BR")}
      </span>
      <button
        type="button"
        disabled={pagina >= totalDePaginas - 1}
        onClick={() => aoMudar(pagina + 1)}
      >
        Próxima ›
      </button>
    </div>
  );
}
