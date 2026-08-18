#[cfg(not(mobile))]
mod db;
#[cfg(not(mobile))]
mod mcp;
#[cfg(not(mobile))]
mod models;

#[cfg(not(mobile))]
use std::{net::SocketAddr, path::PathBuf, sync::Arc};

#[cfg(not(mobile))]
use db::Database;

#[cfg(not(mobile))]
pub fn default_database_path() -> PathBuf {
    if let Ok(directory) = std::env::var("CAIRN_DATA_DIR") {
        return PathBuf::from(directory).join("cairn.db");
    }
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("cairn")
        .join("cairn.db")
}

#[cfg(not(mobile))]
pub async fn run_standalone_mcp() -> anyhow::Result<()> {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .try_init();
    let db = Arc::new(Database::open(&default_database_path())?);
    let address: SocketAddr = std::env::var("CAIRN_MCP_BIND")
        .unwrap_or_else(|_| "127.0.0.1:37777".into())
        .parse()?;
    mcp::serve(db, address).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("erreur pendant l’exécution de TodoAI");
}
