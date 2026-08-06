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
