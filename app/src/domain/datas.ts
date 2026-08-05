export interface PeriodoIso {
  de: string;
  ate: string;
}

/** Data local no formato ISO (yyyy-mm-dd). Nunca usar toISOString: converte p/ UTC. */
export function paraIsoLocal(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function hojeIso(): string {
  return paraIsoLocal(new Date());
}

export function formatarDataBr(dataIso: string | null): string {
  if (dataIso === null || dataIso === "") return "—";
  const [ano, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Nome de arquivo de backup ordenável cronologicamente. */
export function timestampParaArquivo(agora: Date): string {
  const data = paraIsoLocal(agora).replace(/-/g, "");
  const horas = String(agora.getHours()).padStart(2, "0");
  const minutos = String(agora.getMinutes()).padStart(2, "0");
  const segundos = String(agora.getSeconds()).padStart(2, "0");
  return `${data}-${horas}${minutos}${segundos}`;
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

/**
 * Interpreta datas digitadas como no dia a dia: "25/12/2024" (dia exato)
 * ou "12/2024" (mês inteiro). Qualquer outra coisa não é data.
 */
export function interpretarTermoDeData(termo: string): PeriodoIso | null {
  const diaExato = termo.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (diaExato) {
    const [, dia, mes, ano] = diaExato;
    if (Number(mes) < 1 || Number(mes) > 12 || Number(dia) < 1 || Number(dia) > 31) return null;
    const iso = `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
    return { de: iso, ate: iso };
  }
  const mesInteiro = termo.match(/^(\d{1,2})\/(\d{4})$/);
  if (mesInteiro) {
    const [, mes, ano] = mesInteiro;
    if (Number(mes) < 1 || Number(mes) > 12) return null;
    const mesIso = mes.padStart(2, "0");
    const fim = ultimoDiaDoMes(Number(ano), Number(mes));
    return { de: `${ano}-${mesIso}-01`, ate: `${ano}-${mesIso}-${String(fim).padStart(2, "0")}` };
  }
  return null;
}

/** Datas impossíveis (antes do plausível ou no futuro) ganham flag, nunca são descartadas. */
export function dataEhSuspeita(dataIso: string | null, hoje: string): boolean {
  if (dataIso === null) return false;
  return dataIso < "2000-01-01" || dataIso > hoje;
}
