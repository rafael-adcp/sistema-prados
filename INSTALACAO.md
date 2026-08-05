# Instalação e virada — Sistema Prado 2.0

Guia do dia da virada: tirar o Access de cena e colocar o sistema novo na máquina do pai.
**Tudo acontece pela tela do sistema — nada de scripts, Node ou linha de comando.**

## O que levar para a máquina do pai

1. `Sistema Prado_2.0.0_x64-setup.exe` — o instalador (gerado por `npm run tauri build`, sai em
   `app/src-tauri/target/release/bundle/nsis/`)

Só isso. O `.mdb` já está lá.

> O app não precisa de Node, Rust, Office ou internet. O WebView2 (única dependência) já vem no
> Windows 10/11. A leitura do Access usa o leitor que existe em todo Windows (Jet/ACE via
> PowerShell embutido) — funciona até em máquina sem Office.

## Passo a passo na máquina do pai

1. **Instalar**: rode o `Sistema Prado_2.0.0_x64-setup.exe` (instala só para o usuário, sem admin).
2. **Migrar**: abra o Sistema Prado → aba **Backup** → **"Migrar do sistema antigo (.mdb)…"** →
   escolha o `Sistema Prado.mdb` → confirme. A tela mostra o progresso e termina com o resumo
   (ex.: "140.840 serviços importados"). Confira se o total bate com o Access.
3. **Backup**: ainda na aba Backup → **"Escolher pasta de backup…"** → uma pasta do OneDrive ou um
   pendrive que fica na loja. A partir daí o backup é automático (semanal, guarda os 30 últimos).
4. Pronto. Ícone na área de trabalho, dois cliques, usar.

## Transição segura

- **Não desinstale o Access** por enquanto: ele fica como plano B, parado.
- Sugestão: 1–2 semanas usando só o sistema novo; qualquer coisa estranha, o Access está lá.
- Se precisar refazer a migração (ex.: usou o Access nesse meio tempo), é só repetir o passo 2 —
  ele substitui tudo pelos dados atuais do .mdb, e o banco anterior fica guardado como cópia.

## Manutenção futura (para o Rafael)

- Código: `app/` — TypeScript + SQL no `servicoRepository`; Rust é só bootstrap + operações de arquivo.
- Dev: `cd app && npm run tauri dev` · testes: `npm test` · cobertura: `npx vitest run --coverage`.
- Novo instalador: `cd app && npm run tauri build`.
- Atualizar o sistema do pai: rodar o instalador novo por cima (os dados ficam em
  `%APPDATA%\com.prados.sistema\`, intocados). Fase 2 no PLANO.md: auto-update via GitHub Releases.
- Alternativa de migração na sua máquina (opcional, para testes): `migracao/export-mdb.ps1` +
  `node import-csv.mjs` geram um `prados.db` que a tela "Restaurar banco de dados…" aceita.
