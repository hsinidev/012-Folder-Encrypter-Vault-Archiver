use serde::Deserialize;
use crate::shredder::{execute_shredding_job, ShredOptions, ShredAlgorithm};

#[derive(Debug, Deserialize)]
pub struct ShredFilesRequest {
    pub paths: Vec<String>,
    pub algorithm: String, // "dod_3pass", "zero_1pass", "gutmann_35pass"
    pub task_id: String,
}

#[tauri::command]
pub async fn shred_files<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    req: ShredFilesRequest,
) -> Result<u64, String> {
    tokio::task::spawn_blocking(move || {
        let algo = match req.algorithm.as_str() {
            "zero_1pass" => ShredAlgorithm::ZeroFill1Pass,
            "gutmann_35pass" => ShredAlgorithm::Gutmann35Pass,
            _ => ShredAlgorithm::Dod3Pass,
        };

        let opts = ShredOptions {
            paths: req.paths,
            algorithm: algo,
            task_id: req.task_id,
        };

        execute_shredding_job(&app, opts)
    })
    .await
    .map_err(|e| format!("Join error: {}", e))?
}
