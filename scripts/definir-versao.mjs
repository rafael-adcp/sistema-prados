// Sobe a versão nos três arquivos que precisam concordar. Rodar:
//   node scripts/definir-versao.mjs 2.1.0
//
// Existe porque a versão morava em package.json, tauri.conf.json e Cargo.toml, e
// era editada à mão: elas já tinham divergido uma vez (0.1.0 x 2.0.0 x 2.0.0).
import { readFileSync, writeFileSync } from "node:fs";

const versao = process.argv[2];
if (versao === undefined || !/^\d+\.\d+\.\d+$/.test(versao)) {
  console.error(`Versão inválida: ${versao ?? "(nenhuma)"}. Use o formato 2.1.0.`);
  process.exit(1);
}

/** Troca só a primeira ocorrência, que é sempre a versão do próprio pacote. */
function trocar(caminho, regex, substituto) {
  const antes = readFileSync(caminho, "utf-8");
  const depois = antes.replace(regex, substituto);
  if (antes === depois) {
    console.error(`Não achei a versão em ${caminho} — formato mudou?`);
    process.exit(1);
  }
  writeFileSync(caminho, depois);
  console.log(`  ${caminho}`);
}

console.log(`Versão ${versao}:`);
trocar("app/package.json", /"version": "\d+\.\d+\.\d+"/, `"version": "${versao}"`);
trocar("app/src-tauri/tauri.conf.json", /"version": "\d+\.\d+\.\d+"/, `"version": "${versao}"`);
trocar("app/src-tauri/Cargo.toml", /^version = "\d+\.\d+\.\d+"/m, `version = "${versao}"`);
