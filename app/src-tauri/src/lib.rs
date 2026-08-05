mod arquivos;

use tauri_plugin_sql::{Migration, MigrationKind};

fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "schema_inicial",
        sql: include_str!("../migrations/001_schema_inicial.sql"),
        kind: MigrationKind::Up,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:prados.db", migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            arquivos::podar_backups,
            arquivos::substituir_banco
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Sistema Prado");
}
