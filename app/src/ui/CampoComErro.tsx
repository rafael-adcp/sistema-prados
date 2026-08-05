import type { ReactNode } from "react";

interface Props {
  rotulo: string;
  erro?: string;
  children: ReactNode;
}

/** Rótulo + campo + erro no lugar onde se corrige (borda vermelha e mensagem). */
export function CampoComErro({ rotulo, erro, children }: Props) {
  return (
    <label className={erro === undefined ? undefined : "campo-invalido"}>
      {rotulo}
      {children}
      {erro !== undefined && <span className="erro-do-campo">{erro}</span>}
    </label>
  );
}
