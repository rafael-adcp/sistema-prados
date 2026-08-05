import { dataEhSuspeita } from "./datas";
import { normalizarKm } from "./km";
import { normalizarPlaca } from "./placa";

/** Linha pronta para entrar no banco, com o código original do Access preservado. */
export interface ServicoImportado {
  id: number;
  carro: string;
  km: number | null;
  kmRaw: string;
  placa: string;
  produto: string;
  data: string | null;
  dataSuspeita: boolean;
}

export interface ResultadoDaConversao {
  servicos: ServicoImportado[];
  semData: number;
  semPlaca: number;
  datasSuspeitas: number;
}

const CABECALHO_ESPERADO = "codigo,carro,km,placa,produto,data";

/** Parser CSV (RFC 4180): aspas, vírgulas e quebras de linha dentro de campos. */
export function parseCsv(texto: string): string[][] {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let entreAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const caractere = texto[i];
    if (entreAspas) {
      if (caractere === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          entreAspas = false;
        }
      } else {
        campo += caractere;
      }
    } else if (caractere === '"') {
      entreAspas = true;
    } else if (caractere === ",") {
      linha.push(campo);
      campo = "";
    } else if (caractere === "\n" || caractere === "\r") {
      if (caractere === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      campo = "";
      linha = [];
    } else {
      campo += caractere;
    }
  }
  if (campo !== "" || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas;
}

/**
 * Converte o CSV exportado do Access nos serviços do sistema novo, aplicando
 * as mesmas regras do dia a dia (km numérico, placa canônica, flag de data)
 * e sem descartar nenhum registro.
 */
export function converterCsvDoAccess(texto: string, hoje: string): ResultadoDaConversao {
  const linhas = parseCsv(texto.replace(/^﻿/, ""));
  const cabecalho = linhas.shift();
  if (cabecalho === undefined || cabecalho.join(",") !== CABECALHO_ESPERADO) {
    throw new Error("O arquivo exportado não tem o formato esperado do Sistema Prado.");
  }

  const resultado: ResultadoDaConversao = {
    servicos: [],
    semData: 0,
    semPlaca: 0,
    datasSuspeitas: 0,
  };
  for (const [codigo, carro, kmRaw, placaRaw, produto, dataCsv] of linhas) {
    const placa = normalizarPlaca(placaRaw);
    const data = dataCsv === "" ? null : dataCsv;
    const suspeita = dataEhSuspeita(data, hoje);
    resultado.servicos.push({
      id: Number(codigo),
      carro: carro.trim(),
      km: normalizarKm(kmRaw),
      kmRaw: kmRaw.trim(),
      placa,
      produto: produto.trim(),
      data,
      dataSuspeita: suspeita,
    });
    if (data === null) resultado.semData++;
    if (placa === "") resultado.semPlaca++;
    if (suspeita) resultado.datasSuspeitas++;
  }
  return resultado;
}
