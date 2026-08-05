# Sistema Prado 2.0 — Plano e Acompanhamento

> Substituto do "Sistema Prado" (Access .mdb) da Super Troca de Óleo Prado's.
> **Stack**: Tauri 2 + React/TypeScript + SQLite · **Custo**: R$ 0/mês · **Filosofia de código**: Sandi Metz (objetos pequenos, responsabilidade única, dependências injetadas).

---

## 📍 Onde estamos agora

**Status atual**: ✅ Pronto para instalar — `Sistema Prado_2.0.0_x64-setup.exe` gerado e testado (3 MB, em `app/src-tauri/target/release/bundle/nsis/`). Próximo passo: M10 (virada na máquina do pai — ver INSTALACAO.md).

| Milestone | Status |
|---|---|
| M0 — Análise do sistema antigo | ✅ Concluído |
| M1 — Fundação (scaffold Tauri + estrutura) | ✅ Concluído |
| M2 — Migração dos dados (.mdb → SQLite) | ✅ **140.840/140.840 registros, zero descartes** |
| M3 — Camada de dados do app (repositório + índices + testes) | ✅ 37 testes passando; performance medida (tabela abaixo) |
| M4 — Tela Consultas (busca única) | ✅ Concluído |
| M5 — Tela Novo Serviço (autocomplete de placa) | ✅ Concluído |
| M6 — Histórico do veículo | ✅ Concluído |
| M7 — Relatórios + impressão | ✅ Concluído |
| M8 — Backup automático | ✅ Concluído |
| M9 — Instalador + revisão final | ✅ Instalador de 3 MB gerado e testado |
| F1 — Migração 100% via tela (sem Node/scripts na máquina do pai) | ✅ Concluído |
| F2 — Editar/excluir serviço clicando na linha | ✅ Concluído |
| F3 — Validação com destaque no próprio campo | ✅ Concluído |
| F4 — Testes de ponta a ponta (SQL real + fluxos de UI) + cobertura | ✅ **109 testes TS + 4 Rust · 91% de linhas** |
| M10 — Fase 2 (auto-update, virada na máquina do pai) | ⏳ |

## F1–F4 — Feedback de 05/08 ✅

**F1 — Migração 100% via tela.** Backup → "Migrar do sistema antigo (.mdb)…": o app roda um
PowerShell embutido (via Rust, sem janela) que lê o Access com ACE 16/12 e cai para **Jet 4.0 em
32 bits — presente em todo Windows, funciona até sem Office**; converte com as regras do domínio
e importa em lotes com progresso na tela. Validado com o .mdb real: 140.840/140.840. Exportar já
existia ("Fazer backup agora"); a tela agora deixa isso explícito. Os scripts de `migracao/`
viraram alternativa de desenvolvedor — **nada roda manualmente na máquina do pai**.

**F2 — Edição/exclusão.** Clicar em qualquer linha (Consultas e Histórico) abre o diálogo de
edição com Salvar / Excluir (com confirmação) / Cancelar; a lista recarrega na hora. Registro
legado sem data pode ser editado sem forçar data; data absurda continua barrada.

**F3 — Validação no campo.** O erro aparece no próprio campo (borda vermelha + mensagem), no
formulário de novo serviço e no diálogo de edição.

**F4 — Pirâmide de testes.**
- Repositórios: o **SQL de produção roda contra SQLite real** (node:sqlite + schema das próprias
  migrations) — busca, fallback, escape de LIKE, paginação, flags de data, lotes, upsert.
- Telas: Testing Library com fluxos completos (autocomplete → salvar → foco; duplo-clique salva 1;
  badges; editar/excluir pela linha; abas sem perder estado; backup/migração com falhas em vermelho).
- Rust: helpers testados (validação de nomes/timestamp, cabeçalho SQLite, poda de backups).
- **Cobertura: 91% de linhas / 89% de statements** — o descoberto é a cola do runtime Tauri
  (abrir janela/banco de verdade), coberta pelo smoke manual e pelos testes Rust.

**Performance medida no banco real (140.840 registros)** — meta era < 100 ms:

| Consulta | Mediana |
|---|---|
| Placa exata / última troca / histórico | < 1 ms |
| Busca por data (mês inteiro) | < 1 ms |
| Autocomplete de placa (prefixo, 47 mil placas) | ~11 ms |
| Busca por texto (pior caso, varredura completa) | ~92 ms |

Conclusão: índices em `placa` e `data` bastam; FTS5 desnecessário. O banco migrado tem **16,3 MB** (o .mdb tinha 157 MB — era ~90% inchaço por falta de compactação).

---

## M0 — Análise do sistema antigo ✅

O que o sistema atual é (levantado do próprio .mdb + screenshots):

- **1 tabela** (`Produtos`): CódigoDoServiço, DescriçãodoCarro, Km (texto), Placa, DescriçãoDoProduto, Data.
- **140.840 serviços** (out/2006 → dez/2025), ritmo de ~8–9 mil/ano, **47.436 placas distintas**.
- **4 telas**: menu · cadastro (navegação registro-a-registro) · 3 consultas (data, carro, placa — `LIKE *x*`) · 3 relatórios (mesmos filtros, para impressão).
- **Qualidade dos dados**: ~1.020 sem data · ~991 sem placa · ~2.381 sem km · 30 datas impossíveis (1982/2042) · km em formatos mistos (`126.705`, `138139`, `4*`).
- **Limite do Access**: 2 GB/arquivo; estamos em 157 MB (~8%) — o risco real é corrupção/dependência do Office, não o limite.
- ⚠️ Este `.mdb` da pasta é uma **cópia** (produção roda na máquina do pai) — a virada final reimporta o arquivo de lá.

## M1 — Fundação ✅

- [x] Scaffold Tauri 2 + React + TS + Vite em `app/`
- [x] Plugin SQLite (`tauri-plugin-sql`) configurado + migrations idempotentes
- [x] Estrutura de pastas em camadas (ver "Arquitetura" abaixo)
- [x] Vitest configurado para testes de domínio
- [x] `git init` + primeiro commit (`730809b`)

## M2 — Migração dos dados ✅

- [x] `migracao/export-mdb.ps1` — lê o .mdb via ACE OLEDB → CSV UTF-8
- [x] `migracao/import-csv.mjs` — Node (`node:sqlite`, zero deps nativas) → `prados.db`
- [x] Regras de limpeza (preservando SEMPRE o dado original):
  - `id` = CódigoDoServiço original (1 a 140.908)
  - `km_raw` (texto original) + `km` numérico (2.382 sem km numérico, texto preservado)
  - `placa` trim + maiúsculas
  - `data` em ISO; 22 datas impossíveis mantidas com flag `data_suspeita`
- [x] Validação: **140.840 = 140.840** ✓ · 47.436 placas ✓ · relatório em `migracao/relatorio-migracao.txt`

## M3 — Camada de dados do app ✅

- [x] Schema + índices (`placa`, `data`) via migrations do plugin
- [x] `ServicoRepository` — única porta de acesso ao SQL (injetado via context)
- [x] Testes de domínio: **37 passando** (km, placa, datas, busca, backup)
- [x] **Meta < 100 ms atingida** (medição no banco real, tabela no topo) — FTS5 desnecessário

## M4 — Tela Consultas ✅

- [x] Busca única: uma caixa que entende placa, texto (carro/produto) ou data
- [x] Fallback esperto: termo com cara de placa sem resultado (ex.: código `PSL560`) refaz como texto
- [x] Resultados com paginação (50/pág.), debounce 250 ms e contagem
- [x] Clique na placa → histórico do veículo

## M5 — Tela Novo Serviço ✅

- [x] Digitar placa → autocomplete (sobre as 47 mil placas) + preenche carro + cartão da **última troca**
- [x] Data padrão hoje, campos grandes (uso no balcão), Enter salva
- [x] Salvar limpa o formulário e mostra "Serviço nº X salvo" — pronto para o próximo

## M6 — Histórico do veículo ✅

- [x] Todas as visitas da placa (data, km, produto) + "cliente desde…" + botão imprimir

## M7 — Relatórios + impressão ✅

- [x] Mesmos 3 relatórios do sistema antigo (por período, por carro, por placa)
- [x] Layout de impressão via CSS print (cabeçalho com nome da loja e data de emissão)

## M8 — Backup automático ✅

- [x] Backup semanal automático na abertura + botão "Fazer backup agora"
- [x] `VACUUM INTO` (cópia íntegra e compacta, segura com o banco aberto), mantém os 30 últimos
- [x] Pasta configurável (ex.: OneDrive/pendrive) + "Importar dados" (primeira instalação)

## M9 — Instalador + revisão final 🔄

- [x] Revisão multi-agente (15 agentes: 5 lentes independentes + verificação adversarial de cada achado)
  - 43 achados brutos → 10 confirmados como reais (0 falsos) + 33 menores — **todos os relevantes corrigidos**:
  - 🔴 Duplo clique em "Salvar" gravava o serviço 2x → guard `salvando` + botão desabilitado
  - 🔴 Importar banco podia destruir o histórico em falha parcial → substituição atômica (copia → renomeia o antigo como cópia de segurança → rename atômico); validação ANTES de fechar a conexão; app se recupera se falhar
  - 🔴 Placa com hífen/espaço ficava invisível na busca → forma canônica única (compacta) na escrita e leitura + migration que corrige bancos existentes
  - 🟡 Data futura digitada errada virava "última troca" eterna → validação de faixa no formulário + flag `data_suspeita` no insert + ordenação que ignora suspeitas + badge "?" no cartão
  - 🟡 Navegar para o histórico destruía o formulário/busca digitados → abas ficam montadas; "Voltar" retorna à tela de origem
  - 🟡 Foco não voltava à Placa após salvar → foco gerenciado (salvar → Placa; escolher sugestão → Km)
  - 🟡 Backup interrompido podia passar por válido → escreve `.part` e promove só quando completo
  - 🟡 Backup automático falhando em silêncio → banner de aviso no app
  - 🟡 Endurecimento: CSP ativa, instância única, comandos async (janela nunca congela), plugin opener removido, curingas de LIKE escapados, erros visíveis em todas as telas (não mais em verde!), maxLength nos campos, datas de relatório invertidas corrigem sozinhas, cursor não pula mais ao digitar minúsculas
- [x] Refinos Sandi Metz: `ConfigRepository` extraído, importação encapsulada no `BackupService`, tipo `Busca` movido para o domínio, `resumirHistorico` como função pura testada
- [x] Testes: 46 passando (eram 37) · tsc limpo · cargo check limpo
- [x] `tauri build` → `Sistema Prado_2.0.0_x64-setup.exe` (NSIS, 3 MB)
- [x] Binário de release verificado rodando com a CSP estrita e o banco migrado

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
