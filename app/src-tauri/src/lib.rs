mod arquivos;

use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "schema_inicial",
            sql: include_str!("../migrations/001_schema_inicial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "compactar_placas",
            sql: include_str!("../migrations/002_compactar_placas.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg(test)]
mod testes_das_migrations {
    use super::migrations;

    /// O sqlx guarda o SHA-384 do conteúdo da migration no banco e recusa abrir
    /// se ele mudar. Com CRLF o hash é outro: um app compilado no runner Windows
    /// (que faz checkout com CRLF) não abria banco criado por build local (LF),
    /// com "migration 1 was previously applied but has been modified".
    ///
    /// Isto olha os bytes que o include_str! realmente colocou no binário, então
    /// falha na CI antes de gerar um instalador quebrado. O .gitattributes é
    /// quem previne; este teste é quem avisa se a prevenção sair do lugar.
    #[test]
    fn migrations_nao_podem_ter_cr() {
        for migration in migrations() {
            assert!(
                !migration.sql.contains('\r'),
                "migration {} ({}) tem CR — o checksum do sqlx muda e o app deixa de abrir \
                 bancos criados com a versão LF. Confira o .gitattributes.",
                migration.version,
                migration.description
            );
        }
    }

    /// Ambas são reaplicáveis (IF NOT EXISTS / UPDATE que não recasa). Isso é o
    /// que permite recuperar um banco com checksum divergente sem perder dados.
    #[test]
    fn migrations_sao_idempotentes() {
        for migration in migrations() {
            let sql = migration.sql.to_uppercase();
            let segura = sql.contains("IF NOT EXISTS") || sql.trim_start().starts_with("--");
            assert!(
                segura || !sql.contains("CREATE TABLE"),
                "migration {} cria tabela sem IF NOT EXISTS",
                migration.version
            );
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(janela) = app.get_webview_window("main") {
                let _ = janela.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:prados.db", migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            arquivos::validar_banco,
            arquivos::substituir_banco,
            arquivos::concluir_backup,
            arquivos::podar_backups,
            arquivos::exportar_access,
            arquivos::ler_arquivo_texto
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Sistema Prado");
}
