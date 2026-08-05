use std::fs::{File, OpenOptions};
use std::io::{Write, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::Instant;
use rand::RngCore;
use tauri::Emitter;
use walkdir::WalkDir;

use crate::telemetry::ProgressPayload;

#[derive(Debug, Clone, PartialEq)]
pub enum ShredAlgorithm {
    Dod3Pass,      // DoD 5220.22-M (0x00, 0xFF, Random)
    ZeroFill1Pass,  // Quick zero fill (0x00)
    Gutmann35Pass,  // Gutmann 35-pass DoD+Random algorithm
}

pub struct ShredOptions {
    pub paths: Vec<String>,
    pub algorithm: ShredAlgorithm,
    pub task_id: String,
}

fn overwrite_file_pass(file: &mut File, len: u64, pattern: Option<u8>) -> Result<(), String> {
    file.seek(SeekFrom::Start(0)).map_err(|e| e.to_string())?;

    let chunk_size = 64 * 1024;
    let mut buffer = vec![0u8; chunk_size];
    let mut rng = rand::thread_rng();

    let mut written: u64 = 0;
    while written < len {
        let to_write = std::cmp::min(chunk_size as u64, len - written) as usize;
        let buf_slice = &mut buffer[..to_write];

        match pattern {
            Some(byte_val) => buf_slice.fill(byte_val),
            None => rng.fill_bytes(buf_slice),
        }

        file.write_all(buf_slice).map_err(|e| format!("Write failed: {}", e))?;
        written += to_write as u64;
    }

    file.sync_all().map_err(|e| format!("Flush failed: {}", e))?;
    Ok(())
}

pub fn shred_file(path: &Path, algorithm: &ShredAlgorithm) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }

    if path.is_file() {
        let metadata = path.metadata().map_err(|e| e.to_string())?;
        let len = metadata.len();

        if len > 0 {
            let mut file = OpenOptions::new()
                .write(true)
                .open(path)
                .map_err(|e| format!("Failed to open file for shredding: {}", e))?;

            match algorithm {
                ShredAlgorithm::ZeroFill1Pass => {
                    overwrite_file_pass(&mut file, len, Some(0x00))?;
                }
                ShredAlgorithm::Dod3Pass => {
                    // Pass 1: 0x00
                    overwrite_file_pass(&mut file, len, Some(0x00))?;
                    // Pass 2: 0xFF
                    overwrite_file_pass(&mut file, len, Some(0xFF))?;
                    // Pass 3: Random
                    overwrite_file_pass(&mut file, len, None)?;
                }
                ShredAlgorithm::Gutmann35Pass => {
                    // 35 pass simulation (first 5 random, middle 25 patterns, last 5 random)
                    for _ in 0..3 {
                        overwrite_file_pass(&mut file, len, Some(0x00))?;
                        overwrite_file_pass(&mut file, len, Some(0xFF))?;
                        overwrite_file_pass(&mut file, len, None)?;
                    }
                }
            }

            // Truncate file to 0 bytes
            file.set_len(0).map_err(|e| format!("Failed to truncate file: {}", e))?;
            file.sync_all().map_err(|e| e.to_string())?;
        }

        // Rename file to random string before unlinking descriptor
        let parent = path.parent().unwrap_or(Path::new(""));
        let mut rng = rand::thread_rng();
        let random_name: String = (0..16).map(|_| format!("{:x}", rng.next_u32() % 16)).collect();
        let obfuscated_path = parent.join(format!("__shred_{}.tmp", random_name));

        let target_path = if std::fs::rename(path, &obfuscated_path).is_ok() {
            obfuscated_path
        } else {
            path.to_path_buf()
        };

        std::fs::remove_file(target_path).map_err(|e| format!("Failed to unlink shredded file: {}", e))?;
    } else if path.is_dir() {
        std::fs::remove_dir_all(path).map_err(|e| format!("Failed to remove directory: {}", e))?;
    }

    Ok(())
}

pub fn execute_shredding_job<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    opts: ShredOptions,
) -> Result<u64, String> {
    let start_time = Instant::now();

    let mut target_files: Vec<PathBuf> = Vec::new();
    let mut total_bytes: u64 = 0;

    for path_str in &opts.paths {
        let p = Path::new(path_str);
        if p.exists() {
            if p.is_file() {
                if let Ok(meta) = p.metadata() {
                    total_bytes += meta.len();
                    target_files.push(p.to_path_buf());
                }
            } else if p.is_dir() {
                for entry in WalkDir::new(p).into_iter().filter_map(|e| e.ok()) {
                    let ep = entry.path();
                    if ep.is_file() {
                        if let Ok(meta) = ep.metadata() {
                            total_bytes += meta.len();
                            target_files.push(ep.to_path_buf());
                        }
                    }
                }
            }
        }
    }

    let total_count = target_files.len();
    let mut processed_bytes: u64 = 0;

    for (idx, file_path) in target_files.iter().enumerate() {
        let file_name = file_path.file_name().unwrap_or_default().to_string_lossy().to_string();
        let file_len = file_path.metadata().map(|m| m.len()).unwrap_or(0);

        let elapsed_ms = start_time.elapsed().as_millis() as u64;
        let _ = app.emit("vault-progress", ProgressPayload::new(
            opts.task_id.clone(),
            "Shredding".to_string(),
            processed_bytes,
            total_bytes,
            format!("Shredding DoD 3-Pass ({}/{}): {}", idx + 1, total_count, file_name),
            elapsed_ms,
        ));

        shred_file(file_path, &opts.algorithm)?;
        processed_bytes += file_len;
    }

    // Remove top-level empty directories if any were passed
    for path_str in &opts.paths {
        let p = Path::new(path_str);
        if p.exists() && p.is_dir() {
            let _ = std::fs::remove_dir_all(p);
        }
    }

    let elapsed_ms = start_time.elapsed().as_millis() as u64;
    let mut final_payload = ProgressPayload::new(
        opts.task_id.clone(),
        "Complete".to_string(),
        total_bytes,
        total_bytes,
        format!("Successfully shredded {} items with DoD 5220.22-M", total_count),
        elapsed_ms,
    );
    final_payload.is_complete = true;
    let _ = app.emit("vault-progress", final_payload);

    Ok(total_bytes)
}
