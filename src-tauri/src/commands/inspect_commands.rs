use serde::Serialize;
use std::time::Instant;
use crate::crypto::{read_vault_header, analyze_passphrase, derive_key, VaultHeaderMeta, PassphraseAnalysis, KdfParams};

#[derive(Debug, Serialize)]
pub struct VaultInspectionResult {
    pub header: VaultHeaderMeta,
    pub vault_path: String,
    pub total_vault_file_size: u64,
    pub is_valid_signature: bool,
}

#[derive(Debug, Serialize)]
pub struct KdfBenchmarkResult {
    pub m_cost_mb: u32,
    pub t_cost: u32,
    pub p_cost: u32,
    pub duration_ms: u64,
    pub memory_allocated_mb: f64,
}

#[tauri::command]
pub fn inspect_vault(vault_path: String) -> Result<VaultInspectionResult, String> {
    let file = std::fs::File::open(&vault_path)
        .map_err(|e| format!("Failed to open file: {}", e))?;
    let total_vault_file_size = file.metadata().map(|m| m.len()).unwrap_or(0);

    let header = read_vault_header(&vault_path)?;

    Ok(VaultInspectionResult {
        header,
        vault_path,
        total_vault_file_size,
        is_valid_signature: true,
    })
}

#[tauri::command]
pub fn analyze_passphrase_cmd(passphrase: String) -> PassphraseAnalysis {
    analyze_passphrase(&passphrase)
}

#[tauri::command]
pub async fn benchmark_kdf(m_cost_mb: u32, t_cost: u32, p_cost: u32) -> Result<KdfBenchmarkResult, String> {
    tokio::task::spawn_blocking(move || {
        let params = KdfParams {
            m_cost_kb: m_cost_mb * 1024,
            t_cost,
            p_cost,
        };

        let start = Instant::now();
        let salt = [0x55u8; 16];
        let _key = derive_key("BenchmarkPassword123!", &salt, &params)?;
        let duration_ms = start.elapsed().as_millis() as u64;

        Ok(KdfBenchmarkResult {
            m_cost_mb,
            t_cost,
            p_cost,
            duration_ms,
            memory_allocated_mb: m_cost_mb as f64,
        })
    })
    .await
    .map_err(|e| format!("Join error: {}", e))?
}
