use serde::Deserialize;
use crate::crypto::{create_vault_stream, unlock_vault_stream, CreateVaultOptions, UnlockVaultOptions, KdfParams};

#[derive(Debug, Deserialize)]
pub struct CreateVaultRequest {
    pub source_paths: Vec<String>,
    pub output_vault_path: String,
    pub passphrase: String,
    pub m_cost_mb: u32,
    pub t_cost: u32,
    pub p_cost: u32,
    pub obfuscation_len: u32,
    pub task_id: String,
}

#[derive(Debug, Deserialize)]
pub struct UnlockVaultRequest {
    pub vault_path: String,
    pub destination_dir: String,
    pub passphrase: String,
    pub task_id: String,
}

#[tauri::command]
pub async fn create_vault<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    req: CreateVaultRequest,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let kdf_params = KdfParams {
            m_cost_kb: req.m_cost_mb * 1024,
            t_cost: req.t_cost,
            p_cost: req.p_cost,
        };

        let opts = CreateVaultOptions {
            source_paths: req.source_paths,
            output_vault_path: req.output_vault_path,
            passphrase: req.passphrase,
            kdf_params,
            obfuscation_len: req.obfuscation_len,
            task_id: req.task_id,
        };

        create_vault_stream(&app, opts)
    })
    .await
    .map_err(|e| format!("Join error: {}", e))?
}

#[tauri::command]
pub async fn unlock_vault<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    req: UnlockVaultRequest,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let opts = UnlockVaultOptions {
            vault_path: req.vault_path,
            destination_dir: req.destination_dir,
            passphrase: req.passphrase,
            task_id: req.task_id,
        };

        unlock_vault_stream(&app, opts)
    })
    .await
    .map_err(|e| format!("Join error: {}", e))?
}
