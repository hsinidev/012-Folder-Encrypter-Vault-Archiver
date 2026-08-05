use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressPayload {
    pub task_id: String,
    pub stage: String,
    pub processed_bytes: u64,
    pub total_bytes: u64,
    pub percentage: f64,
    pub current_file: String,
    pub throughput_mbps: f64,
    pub elapsed_ms: u64,
    pub eta_seconds: u64,
    pub is_complete: bool,
    pub error: Option<String>,
}

impl ProgressPayload {
    pub fn new(task_id: String, stage: String, processed: u64, total: u64, file: String, elapsed_ms: u64) -> Self {
        let percentage = if total > 0 {
            ((processed as f64 / total as f64) * 100.0).min(100.0)
        } else {
            0.0
        };

        let elapsed_sec = elapsed_ms as f64 / 1000.0;
        let throughput_mbps = if elapsed_sec > 0.001 {
            (processed as f64 / (1024.0 * 1024.0)) / elapsed_sec
        } else {
            0.0
        };

        let eta_seconds = if throughput_mbps > 0.0 && processed < total {
            let remaining_mb = (total - processed) as f64 / (1024.0 * 1024.0);
            (remaining_mb / throughput_mbps) as u64
        } else {
            0
        };

        Self {
            task_id,
            stage,
            processed_bytes: processed,
            total_bytes: total,
            percentage,
            current_file: file,
            throughput_mbps,
            elapsed_ms,
            eta_seconds,
            is_complete: false,
            error: None,
        }
    }
}
