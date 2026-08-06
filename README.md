# Sistema Prado 2.0

Substituto do "Sistema Prado" (Access `.mdb`) da Super Troca de Óleo Prado's.

**Stack**: Tauri 2 + React/TypeScript + SQLite · **Custo**: R$ 0/mês · **Filosofia de código**:
Sandi Metz (objetos pequenos, responsabilidade única, dependências injetadas).

**Estado**: pronto para instalar. `Sistema Prado_2.0.0_x64-setup.exe` (3 MB) gerado e testado, em
`app/src-tauri/target/release/bundle/nsis/`. Falta só a virada na máquina do cliente.

---

## Instalação e virada

Tudo acontece pela tela do sistema — nada de scripts, Node ou linha de comando.

**O que levar**: só o `Sistema Prado_2.0.0_x64-setup.exe`. O `.mdb` já está lá.

> O app não precisa de Node, Rust, Office ou internet. O WebView2 (única dependência) já vem no
> Windows 10/11. A leitura do Access usa o leitor que existe em todo Windows (Jet/ACE via
> PowerShell embutido) — funciona até em máquina sem Office.

1. **Instalar**: rode o `.exe` (instala só para o usuário, sem admin).
2. **Migrar**: Sistema Prado → aba **Backup** → **"Migrar do sistema antigo (.mdb)…"** → escolha o
   `Sistema Prado.mdb` → confirme. A tela mostra o progresso e termina com o resumo (ex.: "140.840
   serviços importados"). Confira se o total bate com o Access.
3. **Backup**: aba Backup → **"Escolher pasta de backup…"** → uma pasta do OneDrive ou um pendrive
   que fica na loja. A partir daí o backup é automático (diário, na abertura, guarda os 10 últimos).
4. Pronto. Ícone na área de trabalho, dois cliques, usar.

### Transição segura

- **Não desinstale o Access** por enquanto: ele fica como plano B, parado.
- Sugestão: 1–2 semanas usando só o sistema novo; qualquer coisa estranha, o Access está lá.
- Refazer a migração (ex.: usou o Access nesse meio tempo): é só repetir o passo 2 — ele substitui
  tudo pelos dados atuais do `.mdb`, e o banco anterior fica guardado como cópia.

---

## O sistema antigo (referência)

Levantado do próprio `.mdb` (os screenshots do sistema antigo saíram do repositório
junto com os demais dados do cliente):

- **1 tabela** (`Produtos`): CódigoDoServiço, DescriçãodoCarro, Km (texto), Placa,
  DescriçãoDoProduto, Data.
- **140.840 serviços** (out/2006 → dez/2025), ~8–9 mil/ano, **47.436 placas distintas**.
- **4 telas**: menu · cadastro (navegação registro-a-registro) · 3 consultas (data, carro, placa —
  `LIKE *x*`) · 3 relatórios (mesmos filtros, para impressão).
- **Qualidade dos dados**: ~1.020 sem data · ~991 sem placa · ~2.381 sem km · 30 datas impossíveis
  (1982/2042) · km em formatos mistos (`126.705`, `138139`, `4*`).
- O `.mdb` desta pasta é uma **cópia** — produção roda na máquina do cliente, e a virada reimporta o
  arquivo de lá.

### Como a migração trata os dados

Nada é descartado. O original é sempre preservado:

- `id` = CódigoDoServiço original (1 a 140.908)
- `km_raw` (texto original) + `km` numérico (2.382 sem km numérico, texto preservado)
- `placa` em forma canônica única (compacta, maiúsculas) na escrita e na leitura
- `carro` e `produto` em maiúsculas — a mesma convenção da digitação do dia a dia (no `.mdb` há
  40 registros em caixa mista; misturar as duas convenções duplicava linhas em "Produtos mais
  usados" e gerava falso "mesma placa com carros diferentes")
- `data` em ISO; 22 datas impossíveis mantidas com flag `data_suspeita`

O `.ps1` resolve as colunas do Access **pelo nome** (sem acento, sem caixa), não pela posição: o
`.mdb` roda desde 2006 e um campo acrescentado no meio faria a migração gravar dados trocados.

Validado com o `.mdb` real: **140.840 = 140.840**, 47.436 placas. O banco resultante tem **16,3 MB**
— o `.mdb` tinha 157 MB, era ~90% inchaço por falta de compactação.

---

## O que o app faz

| Tela | Resumo |
|---|---|
| **Consultas** | Uma caixa que entende placa, texto (carro/produto) ou data. Fallback: termo com cara de placa sem resultado refaz como texto. Paginação (50/pág.), debounce 250 ms. |
| **Novo Serviço** | Placa com autocomplete sobre as 47 mil placas → preenche carro + cartão da última troca. Data padrão hoje, campos grandes, Enter salva. |
| **Histórico** | Todas as visitas da placa (data, km, produto) + "cliente desde…" + imprimir. |
| **Relatórios** | Os mesmos 3 do sistema antigo (período, carro, placa), com layout de impressão. |
| **Análises** | Recria o BI de 2016 sobre os dados atuais: cartões (mês atual × mesmo mês do ano passado × média histórica), 5 gráficos (billboard.js, fork do C3 usado no BI original), KPIs mín/média/máx, sazonalidade, retorno de clientes, top produtos + **Qualidade dos dados** (11 relatórios de inconsistência com correção direto da tela). Só calcula com a aba aberta; seletor de ano (padrão: ano atual — gráficos por ano e sazonalidade seguem multi-anos); imprime. |
| **Backup** | Diário automático na abertura + "Fazer backup agora" (`VACUUM INTO`, mantém os 10 últimos) · migração do `.mdb` · restaurar `prados.db`. |

Editar/excluir: clicar em qualquer linha (Consultas ou Histórico) — ou no botão **Editar** da linha,
que é o caminho pelo teclado — abre o diálogo com Salvar / Excluir / Cancelar (Escape fecha).
Registro legado sem data pode ser editado sem forçar data; data absurda continua barrada. Erros de
validação aparecem no próprio campo.

> **"Carros diferentes atendidos por ano" não bate com o BI de 2016.** A procedure antiga
> (`pr_qtde_placas_distintasXano`) fazia `distinct placa, data`, ou seja contava placa-**dia**: um
> carro que voltou em março contava 2. Aqui conta carros distintos de verdade
> (`COUNT(DISTINCT placa)`), então o número é **menor** que o do dashboard antigo — e é o que o
> título sempre prometeu.

### Performance no banco real (140.840 registros)

Meta era < 100 ms:

| Consulta | Mediana |
|---|---|
| Placa exata / última troca / histórico | < 1 ms |
| Busca por data (mês inteiro) | < 1 ms |
| Autocomplete de placa (prefixo, 47 mil placas) | ~11 ms |
| Busca por texto (pior caso, varredura completa) | ~92 ms |

Índices em `placa` e `data` bastam; FTS5 desnecessário.

---

## Arquitetura

```
prados/
├── README.md                 ← este arquivo
├── Sistema Prado.mdb         ← cópia do original (intocado, só leitura)
└── app/
    ├── src/                  ← React/TS
    │   ├── domain/           ← entidades + regras puras (sem I/O): Servico,
    │   │                        parse de km, interpretação de busca, datas, análises
    │   ├── data/             ← ServicoRepository · AnaliseRepository (números) ·
    │   │                        QualidadeRepository (inconsistências) — todo SQL vive aqui
    │   ├── features/         ← uma pasta por tela; componentes pequenos
    │   │   ├── consultas/ · novo-servico/ · historico/ · relatorios/ · analises/ · backup/
    │   └── ui/               ← componentes visuais burros e reutilizáveis (inclui Grafico,
    │                            wrapper do billboard.js)
    └── src-tauri/            ← Rust mínimo (bootstrap, plugins, operações de arquivo)
        ├── migrations/       ← schema idempotente (tauri-plugin-sql)
        └── scripts/          ← exportar-access.ps1, embutido no binário
```

**Regras** (o "jeito Sandi Metz" traduzido para este projeto):

1. Cada componente/classe/função tem **uma responsabilidade** e cabe na tela.
2. SQL **só** dentro do repositório; UI nunca monta query.
3. Repositório chega às telas por **injeção** (React context) — testável com fake.
4. Regras de negócio são **funções puras** em `domain/` — 100% testáveis sem banco.
5. Duplicação só é abstraída quando o padrão fica óbvio ("prefira duplicação a abstração errada").

### Decisões técnicas

| Decisão | Escolha | Por quê |
|---|---|---|
| Banco | SQLite (arquivo único em `%APPDATA%\com.prados.sistema\`) | Zero manutenção, backup = copiar arquivo, décadas de folga |
| Acesso ao banco | `tauri-plugin-sql` | Manutenção fica em TS + SQL; nada de Rust no dia a dia |
| Leitura do Access | PowerShell embutido, ACE 16 → ACE 12 → Jet 4.0 (32 bits) | Funciona em qualquer Windows, mesmo sem Office |
| Busca por placa | Coluna normalizada + índice (prefixo) | Instantânea |
| Busca texto livre | Full scan medido (140k é pouco p/ SQLite) | Simplicidade primeiro; FTS5 só se a medição pedir |
| Gráficos | billboard.js (fork mantido do C3.js do BI de 2016) | Bundle local sem CDN/eval (CSP ok), API conhecida, imprime em vetor |
| Base das análises | `data IS NOT NULL AND data_suspeita = 0` | Mesmo corte "base sem lixo" do BI antigo, sem hardcode de anos |
| Instalador | NSIS via `tauri build` | Um `.exe`, clique-e-usa |
| Ambiente validado | Node 26 · Rust 1.97 · VS Build Tools 2022 · WebView2 | Nada a instalar |

### Endurecimentos que explicam escolhas do código

Achados de uma revisão adversarial multi-agente, todos corrigidos — vale saber que existem antes de
"simplificar" algo:

- **Migração do `.mdb` recusa arquivo sem nenhum serviço** e **tira cópia do banco
  (`prados-antes-da-migracao-*.db`) antes do `DELETE`**. Importação que encolheria a base pede
  segunda confirmação com os dois números — é o cenário "refiz a migração depois de duas semanas
  usando o sistema novo". Antes, um `.mdb` errado apagava tudo e a tela dizia "✓ concluída: 0".
- **Restaurar banco confere o schema**, não só os 16 bytes mágicos do SQLite (qualquer `.db` de
  outro programa passava e o app abria zerado), e a confirmação mostra quantos serviços há no
  arquivo escolhido × quantos há agora.
- **`substituir_banco` desfaz tudo se o rename final falhar** — antes a pasta ficava sem
  `prados.db` e o app subia com um banco novo e vazio, parecendo perda de dados.
- Carro autopreenchido é substituído quando a placa muda; o que a pessoa digitou, nunca. O cartão
  de última troca só aparece para a placa que está no campo.
- O formulário de Novo Serviço ressincroniza a data quando o app passa a virada do dia aberto
  (a loja não fecha o app; o primeiro serviço de cada manhã ia com a data de ontem).
- Autocomplete de placa e edição de serviço funcionam **pelo teclado** (setas/Enter/Escape,
  botão "Editar" na linha); o diálogo prende o foco e fecha no Escape.
- Busca sobe o termo para maiúsculas: o `LIKE` do SQLite só ignora caixa em ASCII, e sem isso
  procurar "camarão" não achava "CAMARÃO".
- Salvar tem guard `salvando` + botão desabilitado (duplo clique gravava 2x).
- Importar banco é **substituição atômica** (copia → renomeia o antigo como cópia → rename), com
  validação antes de fechar a conexão e recuperação se falhar no meio.
- Placa é canonizada na escrita **e** na leitura (com hífen/espaço ela sumia da busca).
- Data futura: validação de faixa no formulário + flag `data_suspeita` + ordenação que ignora
  suspeitas + badge "?" no cartão.
- Abas ficam montadas (navegar destruía o formulário digitado); foco volta à Placa após salvar.
  Consultas refaz a busca ao voltar a ficar ativa (um serviço recém-salvo aparece na lista).
- Backup escreve `.part` e só promove quando completo; falha automática vira banner no app.
- CSP ativa, instância única, comandos async (janela nunca congela), curingas de LIKE escapados.

---

## Desenvolvimento

```bash
cd app
npm install
npm run tauri dev              # app em modo desenvolvimento
npm test                       # 205 testes TS (Vitest)
npx vitest run --coverage      # cobertura
npm run tauri build            # gera o instalador NSIS
```

Rust: `cargo test` em `app/src-tauri` (9 testes).

**Testes** — 205 TS + 9 Rust, **94% de linhas / 92% de statements**:

- Repositórios: o **SQL de produção roda contra SQLite real** (`node:sqlite` + o schema das próprias
  migrations) — busca, fallback, escape de LIKE, paginação, flags de data, lotes, upsert.
- Telas: Testing Library com fluxos completos (autocomplete → salvar → foco; duplo-clique salva 1;
  editar/excluir pela linha; abas sem perder estado; backup/migração com falhas em vermelho).
- Rust: validação de nomes/timestamp, cabeçalho SQLite, poda de backups.
- O descoberto é a cola do runtime Tauri (abrir janela/banco de verdade), coberta por smoke manual.

---

## Publicar uma versão nova

O app se atualiza sozinho a partir dos **GitHub Releases**. Do lado do cliente não há
nada a fazer: ao abrir, o sistema procura versão nova e, se houver, mostra um aviso com
"Atualizar agora". **Nunca instala sozinho** — a loja atende com o app aberto, e reiniciar
no meio de um lançamento seria pior que ficar uma semana desatualizado. Sem internet, o
aviso simplesmente não aparece e nada muda.

Para publicar:

```bash
# 1. suba a versão nos DOIS arquivos (precisam bater)
#    app/package.json  →  "version"
#    app/src-tauri/tauri.conf.json  →  "version"
# 2. commit, tag e push
git tag v2.1.0 && git push origin v2.1.0
```

O workflow `.github/workflows/release.yml` roda a suíte (TS + Rust), gera o instalador
NSIS assinado e publica o release com o `latest.json` que o app consulta.

### Segredos do repositório (uma vez só)

Em *Settings → Secrets and variables → Actions*:

| Segredo | Valor |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | conteúdo de `~/.tauri/sistema-prados.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | vazio (a chave foi gerada sem senha) |

> **A chave privada não está no repositório e não pode estar.** Ela vive em
> `%USERPROFILE%\.tauri\sistema-prados.key`. **Guarde uma cópia num lugar seguro**: perdê-la
> significa que nenhuma instalação existente aceitará mais nenhuma atualização — a única
> saída seria reinstalar na mão em cada máquina. A pública correspondente está no
> `tauri.conf.json` e pode ser versionada à vontade.

Instalação manual continua valendo como plano B: rodar o instalador novo por cima. Os dados
em `%APPDATA%\com.prados.sistema\` ficam intocados nos dois caminhos.

---

## Próximos passos

- [ ] Virada oficial na máquina do cliente (reimportar o `.mdb` de lá, Access vira fallback)
- [ ] Primeiro release pelo workflow (`v2.0.1`) para validar o ciclo de atualização ponta a ponta
- [x] Repo no GitHub + auto-update (`tauri-plugin-updater` via GitHub Releases)
- [x] Estatísticas mensais → virou a aba **Análises**
