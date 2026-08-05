//! Operações de arquivo que o frontend não consegue fazer sozinho.
//! Comandos async: rodam fora da thread principal, a janela nunca congela.

use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::Manager;

const MAGIC_SQLITE: &[u8; 16] = b"SQLite format 3\0";
const BACKUPS_MANTIDOS: usize = 30;

fn pasta_dados(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let pasta = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&pasta).map_err(|e| e.to_string())?;
    Ok(pasta)
}

fn eh_sqlite(caminho: &Path) -> Result<bool, String> {
    let mut arquivo = File::open(caminho).map_err(|e| e.to_string())?;
    let mut cabecalho = [0u8; 16];
    match arquivo.read_exact(&mut cabecalho) {
        Ok(()) => Ok(&cabecalho == MAGIC_SQLITE),
        Err(_) => Ok(false), // menor que 16 bytes não é um banco
    }
}

fn valida_nome_simples(nome: &str) -> Result<(), String> {
    if nome.is_empty() || nome.contains(['/', '\\', ':']) {
        return Err(format!("Nome de arquivo inválido: {nome}"));
    }
    Ok(())
}

fn valida_timestamp(timestamp: &str) -> Result<(), String> {
    let valido = !timestamp.is_empty()
        && timestamp.chars().all(|c| c.is_ascii_digit() || c == '-');
    if valido { Ok(()) } else { Err("Timestamp inválido".into()) }
}

fn nomes_de_backup(pasta: &Path) -> Result<Vec<PathBuf>, String> {
    let mut backups: Vec<PathBuf> = fs::read_dir(pasta)
        .map_err(|e| e.to_string())?
        .filter_map(|entrada| entrada.ok())
        .map(|entrada| entrada.path())
        .filter(|caminho| {
            caminho
                .file_name()
                .and_then(|nome| nome.to_str())
                .map(|nome| nome.starts_with("prados-backup-") && nome.ends_with(".db"))
                .unwrap_or(false)
        })
        .collect();
    backups.sort(); // nomes datados (yyyyMMdd-HHmmss) ordenam cronologicamente
    Ok(backups)
}

/// Confere se o arquivo escolhido é um banco SQLite. Chamado ANTES de fechar a
/// conexão atual, para que o erro comum (arquivo errado) não derrube o app.
#[tauri::command]
pub async fn validar_banco(caminho: String) -> Result<(), String> {
    if !eh_sqlite(Path::new(&caminho))? {
        return Err("O arquivo escolhido não é um banco SQLite válido".into());
    }
    Ok(())
}

/// Substitui o banco atual pelo arquivo escolhido, sem nunca destruir nada
/// antes de garantir o novo: (1) copia para prados.db.novo — falha aqui não
/// toca em nada; (2) renomeia -wal/-shm e depois o banco atual para
/// prados-substituido-<timestamp> (a ordem garante que um prados.db
/// sobrevivente nunca fica pareado com um WAL órfão); (3) rename atômico do
/// novo para prados.db. O banco anterior fica guardado como cópia de retorno.
#[tauri::command]
pub async fn substituir_banco(
    app: tauri::AppHandle,
    caminho_origem: String,
    timestamp: String,
) -> Result<(), String> {
    valida_timestamp(&timestamp)?;
    let origem = PathBuf::from(&caminho_origem);
    if !eh_sqlite(&origem)? {
        return Err("O arquivo escolhido não é um banco SQLite válido".into());
    }
    let pasta = pasta_dados(&app)?;
    let destino = pasta.join("prados.db");
    if let (Ok(a), Ok(b)) = (fs::canonicalize(&origem), fs::canonicalize(&destino)) {
        if a == b {
            return Err("O arquivo escolhido já é o banco atual".into());
        }
    }

    let novo = pasta.join("prados.db.novo");
    fs::copy(&origem, &novo).map_err(|e| format!("Falha ao copiar o novo banco: {e}"))?;

    for sufixo in ["-wal", "-shm"] {
        let residuo = pasta.join(format!("prados.db{sufixo}"));
        if residuo.exists() {
            let guardado = pasta.join(format!("prados-substituido-{timestamp}.db{sufixo}"));
            fs::rename(&residuo, &guardado).map_err(|e| e.to_string())?;
        }
    }
    if destino.exists() {
        let guardado = pasta.join(format!("prados-substituido-{timestamp}.db"));
        fs::rename(&destino, &guardado).map_err(|e| e.to_string())?;
    }
    fs::rename(&novo, &destino).map_err(|e| e.to_string())?;
    Ok(())
}

/// Promove um backup recém-escrito de <nome>.part para <nome> — só backups
/// completos ganham o nome final que a poda e a restauração reconhecem.
#[tauri::command]
pub async fn concluir_backup(pasta: String, nome: String) -> Result<(), String> {
    valida_nome_simples(&nome)?;
    let parcial = Path::new(&pasta).join(format!("{nome}.part"));
    let definitivo = Path::new(&pasta).join(&nome);
    fs::rename(&parcial, &definitivo).map_err(|e| e.to_string())?;
    Ok(())
}

/// Lê o Access (.mdb) e gera um CSV temporário, usando um script PowerShell
/// embutido. Tenta PowerShell 64 bits (ACE 16/12) e cai para 32 bits, onde o
/// Jet 4.0 — presente em todo Windows — lê .mdb mesmo sem Office instalado.
#[tauri::command]
pub async fn exportar_access(caminho_mdb: String) -> Result<String, String> {
    use std::os::windows::process::CommandExt;
    const SEM_JANELA: u32 = 0x0800_0000; // CREATE_NO_WINDOW

    if !Path::new(&caminho_mdb).exists() {
        return Err(format!("Arquivo não encontrado: {caminho_mdb}"));
    }
    let temp = std::env::temp_dir();
    let script = temp.join("prados-exportar-access.ps1");
    fs::write(&script, include_str!("../scripts/exportar-access.ps1"))
        .map_err(|e| e.to_string())?;
    let csv = temp.join("prados-servicos-exportados.csv");

    let shells = [
        "powershell.exe".to_string(),
        format!(
            "{}\\SysWOW64\\WindowsPowerShell\\v1.0\\powershell.exe",
            std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".into())
        ),
    ];
    let mut ultimo_erro = String::new();
    for shell in &shells {
        let saida = std::process::Command::new(shell)
            .args([
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                &script.to_string_lossy(),
                "-MdbPath",
                &caminho_mdb,
                "-CsvPath",
                &csv.to_string_lossy(),
            ])
            .creation_flags(SEM_JANELA)
            .output();
        match saida {
            Ok(resultado) if resultado.status.success() => {
                return Ok(csv.to_string_lossy().into_owned());
            }
            Ok(resultado) => {
                ultimo_erro = String::from_utf8_lossy(&resultado.stderr).into_owned();
            }
            Err(e) => ultimo_erro = e.to_string(),
        }
    }
    Err(format!(
        "Não foi possível ler o arquivo do Access nesta máquina. Detalhe: {}",
        ultimo_erro.trim()
    ))
}

/// Lê um arquivo de texto (o CSV exportado) para o frontend, removendo o BOM.
#[tauri::command]
pub async fn ler_arquivo_texto(caminho: String) -> Result<String, String> {
    let texto = fs::read_to_string(&caminho).map_err(|e| e.to_string())?;
    Ok(texto.trim_start_matches('\u{feff}').to_string())
}

/// Mantém só os N backups mais recentes e limpa .part órfãos de execuções
/// interrompidas.
#[tauri::command]
pub async fn podar_backups(pasta: String) -> Result<u32, String> {
    let pasta = PathBuf::from(&pasta);
    let mut removidos = 0;

    for entrada in fs::read_dir(&pasta).map_err(|e| e.to_string())?.flatten() {
        let caminho = entrada.path();
        let nome = caminho.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if nome.starts_with("prados-backup-") && nome.ends_with(".db.part") {
            fs::remove_file(&caminho).map_err(|e| e.to_string())?;
            removidos += 1;
        }
    }

    let mut backups = nomes_de_backup(&pasta)?;
    while backups.len() > BACKUPS_MANTIDOS {
        let antigo = backups.remove(0);
        fs::remove_file(antigo).map_err(|e| e.to_string())?;
        removidos += 1;
    }
    Ok(removidos)
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn nome_simples_rejeita_separadores_de_caminho() {
        assert!(valida_nome_simples("prados-backup-1.db").is_ok());
        assert!(valida_nome_simples("..\\..\\windows\\x.db").is_err());
        assert!(valida_nome_simples("a/b.db").is_err());
        assert!(valida_nome_simples("c:x.db").is_err());
        assert!(valida_nome_simples("").is_err());
    }

    #[test]
    fn timestamp_so_aceita_digitos_e_hifen() {
        assert!(valida_timestamp("20260805-181530").is_ok());
        assert!(valida_timestamp("2026'; DROP--").is_err());
        assert!(valida_timestamp("").is_err());
    }

    #[test]
    fn eh_sqlite_reconhece_o_cabecalho_e_rejeita_o_resto() {
        let pasta = std::env::temp_dir();
        let valido = pasta.join("teste-prados-valido.db");
        let invalido = pasta.join("teste-prados-invalido.db");
        let curto = pasta.join("teste-prados-curto.db");
        fs::write(&valido, b"SQLite format 3\0mais coisas".as_slice()).unwrap();
        fs::write(&invalido, b"Standard Jet DB o formato do Access").unwrap();
        fs::write(&curto, b"oi").unwrap();
        assert!(eh_sqlite(&valido).unwrap());
        assert!(!eh_sqlite(&invalido).unwrap());
        assert!(!eh_sqlite(&curto).unwrap());
        for arquivo in [valido, invalido, curto] {
            let _ = fs::remove_file(arquivo);
        }
    }

    #[test]
    fn nomes_de_backup_filtra_e_ordena_cronologicamente() {
        let pasta = std::env::temp_dir().join("teste-prados-poda");
        fs::create_dir_all(&pasta).unwrap();
        for nome in [
            "prados-backup-20260102-000000.db",
            "prados-backup-20260101-000000.db",
            "outro-arquivo.db",
            "prados-backup-20260103-000000.db.part",
        ] {
            fs::write(pasta.join(nome), b"x").unwrap();
        }
        let nomes = nomes_de_backup(&pasta).unwrap();
        let so_nomes: Vec<_> = nomes
            .iter()
            .filter_map(|caminho| caminho.file_name().and_then(|n| n.to_str()))
            .collect();
        assert_eq!(
            so_nomes,
            vec![
                "prados-backup-20260101-000000.db",
                "prados-backup-20260102-000000.db"
            ]
        );
        fs::remove_dir_all(&pasta).unwrap();
    }
}
