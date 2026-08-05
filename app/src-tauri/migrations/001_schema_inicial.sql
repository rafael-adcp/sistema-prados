-- Schema do Sistema Prado 2.0.
-- Idempotente (IF NOT EXISTS): o banco pode nascer vazio aqui ou chegar pronto
-- da migração do Access (migracao/import-csv.mjs), que cria exatamente este schema.

CREATE TABLE IF NOT EXISTS servicos (
  id            INTEGER PRIMARY KEY,
  carro         TEXT NOT NULL DEFAULT '',
  km            INTEGER,
  km_raw        TEXT NOT NULL DEFAULT '',
  placa         TEXT NOT NULL DEFAULT '',
  produto       TEXT NOT NULL DEFAULT '',
  data          TEXT,
  data_suspeita INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_servicos_placa ON servicos (placa);
CREATE INDEX IF NOT EXISTS idx_servicos_data ON servicos (data);

CREATE TABLE IF NOT EXISTS config (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
