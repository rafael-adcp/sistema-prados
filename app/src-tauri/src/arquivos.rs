//! Operações de arquivo que o frontend não consegue fazer sozinho.
//! Comandos async: rodam fora da thread principal, a janela nunca congela.

use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::Manager;

const MAGIC_SQLITE: &[u8; 16] = b"SQLite format 3\0";
/// Com backup diário, são os últimos 10 dias de histórico (~160 MB na pasta).
const BACKUPS_MANTIDOS: usize = 10;

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

/// Confere que o arquivo escolhido é um banco DO SISTEMA PRADO e devolve quantos
/// serviços ele tem. Chamado ANTES de fechar a conexão atual, para que o erro
/// comum (arquivo errado) não derrube o app.
///
/// Os 16 bytes mágicos sozinhos deixavam passar qualquer SQLite — o `History` do
/// Chrome, por exemplo: as migrations criavam `servicos`/`config` vazias e o app
/// abria zerado, parecendo perda de dados. Aqui o schema é conferido de verdade,
/// em somente leitura, e a contagem volta para a tela poder mostrá-la na
/// confirmação ("este arquivo tem N serviços, o atual tem M").
#[tauri::command]
pub async fn validar_banco(caminho: String) -> Result<i64, String> {
    if !eh_sqlite(Path::new(&caminho))? {
        return Err("O arquivo escolhido não é um banco SQLite válido".into());
    }
    contar_servicos_do_arquivo(&caminho).await
}

async fn contar_servicos_do_arquivo(caminho: &str) -> Result<i64, String> {
    use sqlx::sqlite::SqliteConnectOptions;
    use sqlx::{ConnectOptions, Connection};

    let opcoes = SqliteConnectOptions::new()
        .filename(caminho)
        .read_only(true)
        .create_if_missing(false);
    let mut conexao = opcoes
        .connect()
        .await
        .map_err(|e| format!("Não foi possível abrir o arquivo escolhido: {e}"))?;

    let tabelas: Vec<String> = sqlx::query_scalar(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('servicos', 'config')",
    )
    .fetch_all(&mut conexao)
    .await
    .map_err(|e| format!("Não foi possível ler o conteúdo do arquivo: {e}"))?;

    if !tabelas.iter().any(|t| t == "servicos") {
        let _ = conexao.close().await;
        return Err(
            "O arquivo escolhido é um banco SQLite, mas não é do Sistema Prado \
             (não tem a tabela de serviços)."
                .into(),
        );
    }

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM servicos")
        .fetch_one(&mut conexao)
        .await
        .map_err(|e| format!("Não foi possível contar os serviços do arquivo: {e}"))?;
    let _ = conexao.close().await;
    Ok(total)
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

    ativar_banco_novo(&pasta, &novo, &destino, &timestamp)
}

/// Um rótulo `prados-substituido-<timestamp>` que ainda não existe na pasta.
/// Duas restaurações no mesmo segundo geravam o mesmo nome e o rename do Windows
/// sobrescrevia — a primeira cópia de segurança sumia calada.
fn rotulo_livre(pasta: &Path, timestamp: &str) -> String {
    let mut rotulo = format!("prados-substituido-{timestamp}");
    let mut n = 2;
    while pasta.join(format!("{rotulo}.db")).exists() {
        rotulo = format!("prados-substituido-{timestamp}-{n}");
        n += 1;
    }
    rotulo
}

/// Guarda o banco atual (e seu WAL) e ativa o novo. Se a ativação falhar, TUDO
/// volta para o lugar: sem isso, um rename final malsucedido (antivírus segurando
/// o handle, disco cheio) deixava a pasta sem `prados.db` e o app subia com um
/// banco vazio recém-criado pelas migrations, parecendo que os dados sumiram.
fn ativar_banco_novo(
    pasta: &Path,
    novo: &Path,
    destino: &Path,
    timestamp: &str,
) -> Result<(), String> {
    let rotulo = rotulo_livre(pasta, timestamp);
    let mut movidos: Vec<(PathBuf, PathBuf)> = Vec::new(); // (lugar original, onde guardei)

    let desfazer = |movidos: &[(PathBuf, PathBuf)]| {
        for (original, guardado) in movidos.iter().rev() {
            let _ = fs::rename(guardado, original);
        }
    };

    for sufixo in ["-wal", "-shm", ""] {
        let atual = pasta.join(format!("prados.db{sufixo}"));
        if !atual.exists() {
            continue;
        }
        let guardado = pasta.join(format!("{rotulo}.db{sufixo}"));
        if let Err(e) = fs::rename(&atual, &guardado) {
            desfazer(&movidos);
            let _ = fs::remove_file(novo);
            return Err(format!("Falha ao guardar o banco atual: {e}"));
        }
        movidos.push((atual, guardado));
    }

    if let Err(e) = fs::rename(novo, destino) {
        desfazer(&movidos);
        let _ = fs::remove_file(novo);
        return Err(format!(
            "Falha ao ativar o novo banco: {e}. O banco anterior foi mantido no lugar."
        ));
    }
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
///
/// O CSV é apagado em seguida: ele carrega o cadastro inteiro (140 mil linhas com
/// placa, carro e data) e ficava para sempre no %TEMP%, com nome previsível.
#[tauri::command]
pub async fn ler_arquivo_texto(caminho: String) -> Result<String, String> {
    let texto = fs::read_to_string(&caminho).map_err(|e| e.to_string())?;
    let _ = fs::remove_file(&caminho);
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

    /// Pasta temporária isolada por teste (sem depender de crate externa).
    fn pasta_temporaria(nome: &str) -> PathBuf {
        let pasta = std::env::temp_dir().join(nome);
        let _ = fs::remove_dir_all(&pasta);
        fs::create_dir_all(&pasta).unwrap();
        pasta
    }

    #[test]
    fn falha_ao_ativar_devolve_o_banco_anterior_para_o_lugar() {
        let pasta = pasta_temporaria("teste-prados-rollback");
        fs::write(pasta.join("prados.db"), b"BANCO ANTIGO").unwrap();
        fs::write(pasta.join("prados.db-wal"), b"WAL ANTIGO").unwrap();
        // o "novo" não existe: é a falha que antes deixava a pasta sem prados.db
        let novo = pasta.join("prados.db.novo");
        let destino = pasta.join("prados.db");

        let erro = ativar_banco_novo(&pasta, &novo, &destino, "20260806-010203").unwrap_err();

        assert!(erro.contains("mantido no lugar"), "erro pouco claro: {erro}");
        assert_eq!(fs::read(&destino).unwrap(), b"BANCO ANTIGO");
        assert_eq!(fs::read(pasta.join("prados.db-wal")).unwrap(), b"WAL ANTIGO");
        assert!(!pasta.join("prados-substituido-20260806-010203.db").exists());
        fs::remove_dir_all(&pasta).unwrap();
    }

    #[test]
    fn ativacao_bem_sucedida_guarda_o_anterior_e_promove_o_novo() {
        let pasta = pasta_temporaria("teste-prados-ativar");
        fs::write(pasta.join("prados.db"), b"BANCO ANTIGO").unwrap();
        let novo = pasta.join("prados.db.novo");
        fs::write(&novo, b"BANCO NOVO").unwrap();
        let destino = pasta.join("prados.db");

        ativar_banco_novo(&pasta, &novo, &destino, "20260806-010203").unwrap();

        assert_eq!(fs::read(&destino).unwrap(), b"BANCO NOVO");
        assert_eq!(
            fs::read(pasta.join("prados-substituido-20260806-010203.db")).unwrap(),
            b"BANCO ANTIGO"
        );
        assert!(!novo.exists());
        fs::remove_dir_all(&pasta).unwrap();
    }

    /// Cria um SQLite de verdade no caminho pedido, com o schema informado.
    async fn criar_banco(caminho: &Path, schema: &str) {
        use sqlx::sqlite::SqliteConnectOptions;
        use sqlx::{ConnectOptions, Connection};
        let mut conexao = SqliteConnectOptions::new()
            .filename(caminho)
            .create_if_missing(true)
            .connect()
            .await
            .unwrap();
        sqlx::raw_sql(schema).execute(&mut conexao).await.unwrap();
        conexao.close().await.unwrap();
    }

    #[tokio::test]
    async fn conta_os_servicos_de_um_banco_do_prados() {
        let pasta = pasta_temporaria("teste-prados-validar-ok");
        let banco = pasta.join("prados.db");
        criar_banco(
            &banco,
            "CREATE TABLE servicos (id INTEGER PRIMARY KEY);
             CREATE TABLE config (chave TEXT PRIMARY KEY, valor TEXT);
             INSERT INTO servicos (id) VALUES (1), (2), (3);",
        )
        .await;

        let total = contar_servicos_do_arquivo(&banco.to_string_lossy())
            .await
            .unwrap();

        assert_eq!(total, 3);
        let _ = fs::remove_dir_all(&pasta);
    }

    /// O caso que motivou a mudança: escolher, no diálogo de restauração, um .db
    /// de outro programa. Antes ele passava (16 bytes mágicos) e o app abria zerado.
    #[tokio::test]
    async fn recusa_um_sqlite_que_nao_e_do_sistema_prado() {
        let pasta = pasta_temporaria("teste-prados-validar-alheio");
        let banco = pasta.join("historico-do-navegador.db");
        criar_banco(&banco, "CREATE TABLE downloads (id INTEGER PRIMARY KEY);").await;

        let erro = contar_servicos_do_arquivo(&banco.to_string_lossy())
            .await
            .unwrap_err();

        assert!(erro.contains("não é do Sistema Prado"), "erro inesperado: {erro}");
        let _ = fs::remove_dir_all(&pasta);
    }

    #[tokio::test]
    async fn poda_mantem_so_os_mais_recentes_e_limpa_part_orfao() {
        let pasta = pasta_temporaria("teste-prados-poda-limite");
        for dia in 1..=13 {
            fs::write(pasta.join(format!("prados-backup-202608{dia:02}-000000.db")), b"x").unwrap();
        }
        fs::write(pasta.join("prados-backup-20260814-000000.db.part"), b"x").unwrap();
        fs::write(pasta.join("nao-e-backup.db"), b"x").unwrap();

        let removidos = podar_backups(pasta.to_string_lossy().into_owned()).await.unwrap();

        let restantes = nomes_de_backup(&pasta).unwrap();
        assert_eq!(restantes.len(), BACKUPS_MANTIDOS);
        assert_eq!(removidos, 4); // 3 backups velhos + 1 .part órfão
        // sobraram os 10 mais NOVOS: 04 a 13
        let primeiro = restantes[0].file_name().unwrap().to_string_lossy().into_owned();
        assert_eq!(primeiro, "prados-backup-20260804-000000.db");
        assert!(pasta.join("nao-e-backup.db").exists()); // não é da nossa conta
        fs::remove_dir_all(&pasta).unwrap();
    }

    #[test]
    fn duas_restauracoes_no_mesmo_segundo_nao_sobrescrevem_a_copia() {
        let pasta = pasta_temporaria("teste-prados-rotulo");
        fs::write(pasta.join("prados-substituido-20260806-010203.db"), b"PRIMEIRA").unwrap();

        let rotulo = rotulo_livre(&pasta, "20260806-010203");

        assert_eq!(rotulo, "prados-substituido-20260806-010203-2");
        fs::remove_dir_all(&pasta).unwrap();
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
