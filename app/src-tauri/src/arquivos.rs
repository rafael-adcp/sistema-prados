//! Operações de arquivo que o frontend não consegue fazer sozinho:
//! podar backups antigos e substituir o banco na importação inicial.

use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

const MAGIC_SQLITE: &[u8] = b"SQLite format 3\0";
const BACKUPS_MANTIDOS: usize = 30;

fn pasta_dados(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let pasta = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&pasta).map_err(|e| e.to_string())?;
    Ok(pasta)
}

fn eh_sqlite(caminho: &Path) -> Result<bool, String> {
    let bytes = fs::read(caminho).map_err(|e| e.to_string())?;
    Ok(bytes.starts_with(MAGIC_SQLITE))
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

/// Mantém só os N backups mais recentes na pasta escolhida.
#[tauri::command]
pub fn podar_backups(pasta: String) -> Result<u32, String> {
    let mut backups = nomes_de_backup(Path::new(&pasta))?;
    let mut removidos = 0;
    while backups.len() > BACKUPS_MANTIDOS {
        let antigo = backups.remove(0);
        fs::remove_file(antigo).map_err(|e| e.to_string())?;
        removidos += 1;
    }
    Ok(removidos)
}

/// Substitui o banco atual por um arquivo escolhido pelo usuário (importação
/// inicial). O frontend fecha a conexão antes de chamar e recarrega depois.
#[tauri::command]
pub fn substituir_banco(app: tauri::AppHandle, caminho_origem: String) -> Result<(), String> {
    let origem = PathBuf::from(&caminho_origem);
    if !eh_sqlite(&origem)? {
        return Err("O arquivo escolhido não é um banco SQLite válido".into());
    }
    let pasta = pasta_dados(&app)?;
    for sufixo in ["prados.db-wal", "prados.db-shm"] {
        let residuo = pasta.join(sufixo);
        if residuo.exists() {
            fs::remove_file(&residuo).map_err(|e| e.to_string())?;
        }
    }
    fs::copy(&origem, pasta.join("prados.db")).map_err(|e| e.to_string())?;
    Ok(())
}
