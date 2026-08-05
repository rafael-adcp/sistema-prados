// Importa servicos.csv (gerado por export-mdb.ps1) para prados.db (SQLite).
// Usa o SQLite embutido do Node (node:sqlite) — zero dependências.
// Uso: node import-csv.mjs
import { DatabaseSync } from "node:sqlite";
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const csvPath = join(dir, "servicos.csv");
const dbPath = join(dir, "prados.db");
const reportPath = join(dir, "relatorio-migracao.txt");

// ---------- Parser CSV (RFC 4180) ----------

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ---------- Regras de limpeza (mesmas regras do domínio do app) ----------

const KM_MAXIMO_PLAUSIVEL = 2_000_000;

export function normalizarKm(kmRaw) {
  const digitos = kmRaw.replace(/\D/g, "");
  if (digitos === "") return null;
  const km = Number(digitos);
  return km > KM_MAXIMO_PLAUSIVEL ? null : km;
}

export function normalizarPlaca(placaRaw) {
  return placaRaw.trim().toUpperCase().replace(/\s+/g, " ");
}

export function dataEhSuspeita(dataIso, hoje) {
  if (dataIso === null) return false;
  const amanha = new Date(hoje.getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return dataIso < "2000-01-01" || dataIso > amanha;
}

// ---------- Importação ----------

function main() {
  const inicio = Date.now();
  const texto = readFileSync(csvPath, "utf-8").replace(/^﻿/, "");
  const linhas = parseCsv(texto);
  const cabecalho = linhas.shift();
  if (cabecalho.join(",") !== "codigo,carro,km,placa,produto,data") {
    throw new Error(`Cabeçalho inesperado: ${cabecalho.join(",")}`);
  }

  if (existsSync(dbPath)) rmSync(dbPath);
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE servicos (
      id            INTEGER PRIMARY KEY,
      carro         TEXT NOT NULL DEFAULT '',
      km            INTEGER,
      km_raw        TEXT NOT NULL DEFAULT '',
      placa         TEXT NOT NULL DEFAULT '',
      produto       TEXT NOT NULL DEFAULT '',
      data          TEXT,
      data_suspeita INTEGER NOT NULL DEFAULT 0
    );
  `);

  const insert = db.prepare(`
    INSERT INTO servicos (id, carro, km, km_raw, placa, produto, data, data_suspeita)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const hoje = new Date();
  const stats = {
    total: 0,
    semData: 0,
    semPlaca: 0,
    semKmNumerico: 0,
    datasSuspeitas: 0,
  };

  db.exec("BEGIN");
  for (const linha of linhas) {
    const [codigo, carro, kmRaw, placaRaw, produto, dataCsv] = linha;
    const km = normalizarKm(kmRaw);
    const placa = normalizarPlaca(placaRaw);
    const data = dataCsv === "" ? null : dataCsv;
    const suspeita = dataEhSuspeita(data, hoje);

    insert.run(
      Number(codigo),
      carro.trim(),
      km,
      kmRaw.trim(),
      placa,
      produto.trim(),
      data,
      suspeita ? 1 : 0,
    );

    stats.total++;
    if (data === null) stats.semData++;
    if (placa === "") stats.semPlaca++;
    if (km === null) stats.semKmNumerico++;
    if (suspeita) stats.datasSuspeitas++;
  }
  db.exec("COMMIT");

  db.exec(`
    CREATE INDEX idx_servicos_placa ON servicos (placa);
    CREATE INDEX idx_servicos_data ON servicos (data);
  `);

  const resumo = db
    .prepare(
      `SELECT COUNT(*) AS n, MIN(id) AS minId, MAX(id) AS maxId,
              MIN(CASE WHEN data_suspeita = 0 THEN data END) AS minData,
              MAX(CASE WHEN data_suspeita = 0 THEN data END) AS maxData,
              COUNT(DISTINCT placa) AS placas
       FROM servicos`,
    )
    .get();
  db.close();

  const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
  const relatorio = [
    "=== Relatório da migração (Sistema Prado .mdb -> prados.db) ===",
    `Executada em: ${hoje.toLocaleString("pt-BR")}`,
    "",
    `Registros no CSV:        ${stats.total}`,
    `Registros no SQLite:     ${resumo.n}`,
    `Faixa de códigos:        ${resumo.minId} a ${resumo.maxId}`,
    `Período (datas válidas): ${resumo.minData} a ${resumo.maxData}`,
    `Placas distintas:        ${resumo.placas}`,
    "",
    "--- Anomalias preservadas (nenhum registro foi descartado) ---",
    `Sem data:                ${stats.semData}`,
    `Sem placa:               ${stats.semPlaca}`,
    `Sem km numérico:         ${stats.semKmNumerico} (texto original mantido em km_raw)`,
    `Datas suspeitas (flag):  ${stats.datasSuspeitas}`,
    "",
    `Tempo: ${segundos}s`,
  ].join("\n");

  writeFileSync(reportPath, relatorio, "utf-8");
  console.log(relatorio);

  if (resumo.n !== stats.total) {
    throw new Error("Contagem divergente entre CSV e SQLite!");
  }
}

const ehExecucaoDireta = process.argv[1] === fileURLToPath(import.meta.url);
if (ehExecucaoDireta) main();
