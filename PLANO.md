# Sistema Prado 2.0 — Plano e Acompanhamento

> Substituto do "Sistema Prado" (Access .mdb) da Super Troca de Óleo Prado's.
> **Stack**: Tauri 2 + React/TypeScript + SQLite · **Custo**: R$ 0/mês · **Filosofia de código**: Sandi Metz (objetos pequenos, responsabilidade única, dependências injetadas).

---

## 📍 Onde estamos agora

**Status atual**: M1 — Fundação (scaffold do projeto)

| Milestone | Status |
|---|---|
| M0 — Análise do sistema antigo | ✅ Concluído |
| M1 — Fundação (scaffold Tauri + estrutura) | 🔄 Em andamento |
| M2 — Migração dos dados (.mdb → SQLite) | ⏳ |
| M3 — Camada de dados do app (repositório + índices + testes) | ⏳ |
| M4 — Tela Consultas (busca única) | ⏳ |
| M5 — Tela Novo Serviço (autocomplete de placa) | ⏳ |
| M6 — Histórico do veículo | ⏳ |
| M7 — Relatórios + impressão | ⏳ |
| M8 — Backup automático | ⏳ |
| M9 — Instalador + revisão final | ⏳ |
| M10 — Fase 2 (auto-update, virada na máquina do pai) | ⏳ |

---

## M0 — Análise do sistema antigo ✅

O que o sistema atual é (levantado do próprio .mdb + screenshots):

- **1 tabela** (`Produtos`): CódigoDoServiço, DescriçãodoCarro, Km (texto), Placa, DescriçãoDoProduto, Data.
- **140.840 serviços** (out/2006 → dez/2025), ritmo de ~8–9 mil/ano, **47.436 placas distintas**.
- **4 telas**: menu · cadastro (navegação registro-a-registro) · 3 consultas (data, carro, placa — `LIKE *x*`) · 3 relatórios (mesmos filtros, para impressão).
- **Qualidade dos dados**: ~1.020 sem data · ~991 sem placa · ~2.381 sem km · 30 datas impossíveis (1982/2042) · km em formatos mistos (`126.705`, `138139`, `4*`).
- **Limite do Access**: 2 GB/arquivo; estamos em 157 MB (~8%) — o risco real é corrupção/dependência do Office, não o limite.
- ⚠️ Este `.mdb` da pasta é uma **cópia** (produção roda na máquina do pai) — a virada final reimporta o arquivo de lá.

## M1 — Fundação 🔄

- [ ] Scaffold Tauri 2 + React + TS + Vite em `app/`
- [ ] Plugin SQLite (`tauri-plugin-sql`) configurado
- [ ] Estrutura de pastas em camadas (ver "Arquitetura" abaixo)
- [ ] Vitest configurado para testes de domínio
- [ ] `git init` + primeiro commit

## M2 — Migração dos dados ⏳

- [ ] `migracao/export-mdb.ps1` — lê o .mdb via ACE OLEDB → CSV UTF-8
- [ ] `migracao/import-csv.mjs` — Node (`node:sqlite`, zero deps nativas) → `prados.db`
- [ ] Regras de limpeza (preservando SEMPRE o dado original):
  - `id` = CódigoDoServiço original
  - `km_raw` (texto original) + `km` numérico (só dígitos; vazio/absurdo → NULL)
  - `placa` trim + maiúsculas
  - `data` em ISO (`yyyy-mm-dd`); impossíveis (< 2000 ou futuro) mantidas com flag `data_suspeita`
- [ ] Validação: contagem 140.840 registros migrados + relatório de anomalias

## M3 — Camada de dados do app ⏳

- [ ] Schema + índices (`placa`, `data`) via migrations do plugin
- [ ] `ServicoRepository` — única porta de acesso ao SQL (injetado via context, trocável por fake em teste)
- [ ] Testes de domínio (parse de km, detecção do tipo de busca, formatação de datas)
- [ ] **Meta de performance: toda consulta < 100 ms** (busca por placa/data via índice; texto livre em full scan medido — plano B: FTS5)

## M4 — Tela Consultas ⏳

- [ ] Busca única: uma caixa que entende placa, texto (carro/produto) ou data
- [ ] Resultados com paginação, debounce e contagem
- [ ] Clique na linha → histórico do veículo

## M5 — Tela Novo Serviço ⏳

- [ ] Digitar placa → autocomplete + preenche carro + mostra **última troca** (data, km, produto)
- [ ] Data padrão hoje, campos grandes (uso no balcão)
- [ ] Salvar e já ficar pronto para o próximo (fluxo de 30+ serviços/dia)

## M6 — Histórico do veículo ⏳

- [ ] Linha do tempo de todas as visitas da placa (data, km, produto)

## M7 — Relatórios + impressão ⏳

- [ ] Mesmos 3 relatórios do sistema antigo (por data, por carro, por placa)
- [ ] Layout de impressão via CSS print

## M8 — Backup automático ⏳

- [ ] Cópia datada do `prados.db` ao fechar o app (mantém últimas N)
- [ ] Pasta de backup configurável (ex.: OneDrive/pendrive)
- [ ] Botão "Fazer backup agora" + "Importar dados" (primeira instalação)

## M9 — Instalador + revisão final ⏳

- [ ] Revisão de código multi-agente (bugs, performance, estilo Sandi Metz) + correções
- [ ] `tauri build` → instalador `.exe` (NSIS)
- [ ] Teste do instalador nesta máquina com os 140k registros

## M10 — Fase 2 (pós-aprovação) ⏳

- [ ] Repo no GitHub + auto-update (`tauri-plugin-updater` via GitHub Releases)
- [ ] Virada oficial: reimportar o .mdb atualizado da máquina do pai, instalar, Access vira fallback
- [ ] Ideias futuras: alerta de próxima troca, etiqueta imprimível, estatísticas mensais

---

## Arquitetura (Sandi Metz aplicada)

```
prados/
├── PLANO.md                  ← este arquivo
├── Sistema Prado.mdb         ← original (intocado, só leitura)
├── migracao/                 ← scripts de migração (rodam 1x, fora do app)
└── app/
    ├── src/                  ← React/TS
    │   ├── domain/           ← entidades + regras puras (sem I/O): Servico,
    │   │                        parse de km, interpretação de busca, datas
    │   ├── data/             ← ServicoRepository (todo SQL vive aqui, e só aqui)
    │   ├── features/         ← uma pasta por tela; componentes pequenos
    │   │   ├── consultas/
    │   │   ├── novo-servico/
    │   │   ├── historico/
    │   │   ├── relatorios/
    │   │   └── backup/
    │   └── ui/               ← componentes visuais burros e reutilizáveis
    └── src-tauri/            ← Rust mínimo (só bootstrap + plugins)
```

**Regras que vamos seguir** (o "jeito Sandi Metz" traduzido para este projeto):

1. Cada componente/classe/função tem **uma responsabilidade** e cabe na tela.
2. SQL **só** dentro do repositório; UI nunca monta query.
3. Repositório chega às telas por **injeção** (React context) — testável com fake.
4. Regras de negócio são **funções puras** em `domain/` — 100% testáveis sem banco.
5. Duplicação só é abstraída quando o padrão fica óbvio ("prefira duplicação a abstração errada").

## Decisões técnicas

| Decisão | Escolha | Por quê |
|---|---|---|
| Banco | SQLite (arquivo único em `%APPDATA%`) | Zero manutenção, backup = copiar arquivo, décadas de folga |
| Acesso ao banco | `tauri-plugin-sql` | Manutenção fica em TS + SQL; nada de Rust no dia a dia |
| Migração | PowerShell (ACE OLEDB → CSV) + Node `node:sqlite` | Ferramentas já presentes na máquina, zero deps nativas |
| Busca por placa | Coluna normalizada + índice (prefixo) | Instantânea |
| Busca texto livre | Full scan medido (140k é pouco p/ SQLite) | Simplicidade primeiro; FTS5 só se medição pedir |
| Instalador | NSIS via `tauri build` | Um .exe, clique-e-usa |
| Ambiente validado | Node 26 · Rust 1.97 · VS Build Tools 2022 · WebView2 ✅ | Nada a instalar |

## Como rodar (dev)

```bash
cd app
npm install
npm run tauri dev      # abre o app em modo desenvolvimento
npm test               # testes de domínio (Vitest)
```

Migração (gera `prados.db` a partir do .mdb):

```powershell
cd migracao
.\export-mdb.ps1       # .mdb → servicos.csv
node import-csv.mjs    # servicos.csv → prados.db + relatório
```

---

*Última atualização: 05/08/2026 — mantido pelo Claude Code a cada milestone.*
