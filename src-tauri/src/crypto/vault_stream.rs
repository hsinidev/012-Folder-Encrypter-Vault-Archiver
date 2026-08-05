use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::Instant;
use rand::RngCore;
use tauri::Emitter;
use walkdir::WalkDir;

use super::kdf::{derive_key, KdfParams};
use super::header::{VaultHeaderMeta, generate_obfuscation_bytes, VAULT_MAGIC};
use super::aes_gcm::{encrypt_chunk, decrypt_chunk};
use crate::telemetry::ProgressPayload;

const CHUNK_SIZE: usize = 64 * 1024; // 64 KB chunks

pub struct CreateVaultOptions {
    pub source_paths: Vec<String>,
    pub output_vault_path: String,
    pub passphrase: String,
    pub kdf_params: KdfParams,
    pub obfuscation_len: u32,
    pub task_id: String,
}

pub struct UnlockVaultOptions {
    pub vault_path: String,
    pub destination_dir: String,
    pub passphrase: String,
    pub task_id: String,
}

pub fn create_vault_stream<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    opts: CreateVaultOptions,
) -> Result<String, String> {
    let start_time = Instant::now();

    // 1. Gather all files and calculate total size
    let mut files_to_pack: Vec<(PathBuf, String)> = Vec::new();
    let mut total_uncompressed_bytes: u64 = 0;

    for path_str in &opts.source_paths {
        let p = Path::new(path_str);
        if !p.exists() {
            return Err(format!("Source path does not exist: {}", path_str));
        }

        let base_parent = p.parent().unwrap_or(p);

        if p.is_file() {
            let rel = p.strip_prefix(base_parent).unwrap_or(p).to_string_lossy().to_string();
            let metadata = p.metadata().map_err(|e| e.to_string())?;
            total_uncompressed_bytes += metadata.len();
            files_to_pack.push((p.to_path_buf(), rel));
        } else if p.is_dir() {
            for entry in WalkDir::new(p).into_iter().filter_map(|e| e.ok()) {
                let ep = entry.path();
                if ep.is_file() {
                    let rel = ep.strip_prefix(base_parent).unwrap_or(ep).to_string_lossy().to_string();
                    if let Ok(meta) = ep.metadata() {
                        total_uncompressed_bytes += meta.len();
                        files_to_pack.push((ep.to_path_buf(), rel));
                    }
                }
            }
        }
    }

    if files_to_pack.is_empty() {
        return Err("No valid files found to encrypt into vault".to_string());
    }

    // Emit initial progress
    let _ = app.emit("vault-progress", ProgressPayload::new(
        opts.task_id.clone(),
        "DerivingKey".to_string(),
        0,
        total_uncompressed_bytes,
        "Deriving Argon2id Key...".to_string(),
        start_time.elapsed().as_millis() as u64,
    ));

    // 2. Generate Salt & Nonce
    let mut rng = rand::thread_rng();
    let mut salt = [0u8; 16];
    let mut nonce = [0u8; 12];
    rng.fill_bytes(&mut salt);
    rng.fill_bytes(&mut nonce);

    // 3. Derive Key
    let derived_key = derive_key(&opts.passphrase, &salt, &opts.kdf_params)?;

    // 4. Create TAR buffer in temporary location or memory stream
    let temp_tar_path = format!("{}.tmp_tar", opts.output_vault_path);
    {
        let tar_file = File::create(&temp_tar_path).map_err(|e| format!("Failed to create temp tar: {}", e))?;
        let mut tar_builder = tar::Builder::new(tar_file);

        for (idx, (abs_path, rel_path)) in files_to_pack.iter().enumerate() {
            let elapsed_ms = start_time.elapsed().as_millis() as u64;
            let _ = app.emit("vault-progress", ProgressPayload::new(
                opts.task_id.clone(),
                "PackingTar".to_string(),
                idx as u64,
                files_to_pack.len() as u64,
                format!("Packing {}", rel_path),
                elapsed_ms,
            ));

            tar_builder.append_path_with_name(abs_path, rel_path)
                .map_err(|e| format!("Failed to add file {} to tar: {}", rel_path, e))?;
        }

        tar_builder.finish().map_err(|e| format!("Failed to finalize tar archive: {}", e))?;
    }

    // 5. Build Header & Obfuscation
    let header_meta = VaultHeaderMeta::new(
        &salt,
        &nonce,
        opts.kdf_params.clone(),
        CHUNK_SIZE as u32,
        files_to_pack.len() as u64,
        total_uncompressed_bytes,
        opts.obfuscation_len,
    );

    let header_json = serde_json::to_vec(&header_meta).map_err(|e| format!("Header serialization error: {}", e))?;
    let header_len_bytes = (header_json.len() as u32).to_be_bytes();

    let mut out_file = File::create(&opts.output_vault_path)
        .map_err(|e| format!("Failed to create output vault file: {}", e))?;

    // Write Obfuscation Entropy
    if opts.obfuscation_len > 0 {
        let obf_bytes = generate_obfuscation_bytes(opts.obfuscation_len);
        out_file.write_all(&obf_bytes).map_err(|e| e.to_string())?;
    }

    // Write Magic + Header Length + Header Metadata JSON
    out_file.write_all(VAULT_MAGIC).map_err(|e| e.to_string())?;
    out_file.write_all(&header_len_bytes).map_err(|e| e.to_string())?;
    out_file.write_all(&header_json).map_err(|e| e.to_string())?;

    // 6. Encrypt TAR file in 64KB Chunks
    let mut tar_file = File::open(&temp_tar_path).map_err(|e| format!("Failed to open temp tar: {}", e))?;
    let total_tar_size = tar_file.metadata().map_err(|e| e.to_string())?.len();

    let mut buffer = vec![0u8; CHUNK_SIZE];
    let mut chunk_index: u64 = 0;
    let mut processed_bytes: u64 = 0;

    loop {
        let read_count = tar_file.read(&mut buffer).map_err(|e| format!("Read error: {}", e))?;
        if read_count == 0 {
            break;
        }

        let encrypted_chunk = encrypt_chunk(
            &derived_key.key,
            &nonce,
            chunk_index,
            &buffer[..read_count],
        )?;

        let chunk_len_bytes = (encrypted_chunk.len() as u32).to_be_bytes();
        out_file.write_all(&chunk_len_bytes).map_err(|e| e.to_string())?;
        out_file.write_all(&encrypted_chunk).map_err(|e| e.to_string())?;

        processed_bytes += read_count as u64;
        chunk_index += 1;

        let elapsed_ms = start_time.elapsed().as_millis() as u64;
        let _ = app.emit("vault-progress", ProgressPayload::new(
            opts.task_id.clone(),
            "Encrypting".to_string(),
            processed_bytes,
            total_tar_size,
            format!("Encrypting chunk #{} ({} MB)", chunk_index, processed_bytes / (1024 * 1024)),
            elapsed_ms,
        ));
    }

    // Clean up temporary tar file
    let _ = std::fs::remove_file(&temp_tar_path);

    // Final Completion Telemetry
    let elapsed_ms = start_time.elapsed().as_millis() as u64;
    let mut final_payload = ProgressPayload::new(
        opts.task_id.clone(),
        "Complete".to_string(),
        total_uncompressed_bytes,
        total_uncompressed_bytes,
        "Vault Created Successfully".to_string(),
        elapsed_ms,
    );
    final_payload.is_complete = true;
    let _ = app.emit("vault-progress", final_payload);

    Ok(opts.output_vault_path)
}

pub fn unlock_vault_stream<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    opts: UnlockVaultOptions,
) -> Result<String, String> {
    let start_time = Instant::now();

    let mut vault_file = File::open(&opts.vault_path)
        .map_err(|e| format!("Failed to open vault file: {}", e))?;

    // 1. Locate Magic and Header
    let mut file_buf = Vec::new();
    vault_file.read_to_end(&mut file_buf).map_err(|e| format!("Read error: {}", e))?;

    let magic_pos = file_buf.windows(6).position(|w| w == VAULT_MAGIC)
        .ok_or_else(|| "Invalid vault format: Vault Magic Signature 'FVLT20' not found".to_string())?;

    let meta_start = magic_pos + 6;
    if file_buf.len() < meta_start + 4 {
        return Err("Corrupted vault: Missing header metadata length".to_string());
    }

    let header_len = u32::from_be_bytes(file_buf[meta_start..meta_start + 4].try_into().unwrap()) as usize;
    let json_start = meta_start + 4;
    let json_end = json_start + header_len;

    if file_buf.len() < json_end {
        return Err("Corrupted vault: Truncated header metadata".to_string());
    }

    let header_meta: VaultHeaderMeta = serde_json::from_slice(&file_buf[json_start..json_end])
        .map_err(|e| format!("Failed to parse vault metadata: {}", e))?;

    let salt = header_meta.get_salt()?;
    let nonce = header_meta.get_nonce()?;

    // Derive Key
    let _ = app.emit("vault-progress", ProgressPayload::new(
        opts.task_id.clone(),
        "DerivingKey".to_string(),
        0,
        header_meta.total_uncompressed_bytes,
        "Verifying Passphrase & KDF...".to_string(),
        start_time.elapsed().as_millis() as u64,
    ));

    let derived_key = derive_key(&opts.passphrase, &salt, &header_meta.kdf_params)?;

    // 2. Decrypt Chunks into temporary TAR
    let temp_tar_path = format!("{}/unlocked_temp.tar", opts.destination_dir);
    {
        let mut temp_tar_file = File::create(&temp_tar_path)
            .map_err(|e| format!("Failed to create temp tar for extraction: {}", e))?;

        let mut payload_cursor = json_end;
        let mut chunk_index: u64 = 0;
        let mut processed_bytes: u64 = 0;

        while payload_cursor < file_buf.len() {
            if payload_cursor + 4 > file_buf.len() {
                break;
            }
            let chunk_len = u32::from_be_bytes(file_buf[payload_cursor..payload_cursor + 4].try_into().unwrap()) as usize;
            payload_cursor += 4;

            if payload_cursor + chunk_len > file_buf.len() {
                return Err("Corrupted chunk payload length".to_string());
            }

            let encrypted_chunk = &file_buf[payload_cursor..payload_cursor + chunk_len];
            payload_cursor += chunk_len;

            let decrypted_bytes = decrypt_chunk(
                &derived_key.key,
                &nonce,
                chunk_index,
                encrypted_chunk,
            ).map_err(|_| "Passphrase incorrect or vault corrupted (MAC tag verification failed)".to_string())?;

            temp_tar_file.write_all(&decrypted_bytes).map_err(|e| e.to_string())?;

            processed_bytes += decrypted_bytes.len() as u64;
            chunk_index += 1;

            let elapsed_ms = start_time.elapsed().as_millis() as u64;
            let _ = app.emit("vault-progress", ProgressPayload::new(
                opts.task_id.clone(),
                "Decrypting".to_string(),
                processed_bytes,
                header_meta.total_uncompressed_bytes,
                format!("Decrypting payload chunk #{}", chunk_index),
                elapsed_ms,
            ));
        }
    }

    // 3. Extract TAR Archive to destination
    let _ = app.emit("vault-progress", ProgressPayload::new(
        opts.task_id.clone(),
        "Extracting".to_string(),
        header_meta.total_uncompressed_bytes,
        header_meta.total_uncompressed_bytes,
        "Extracting files to destination...".to_string(),
        start_time.elapsed().as_millis() as u64,
    ));

    let tar_file = File::open(&temp_tar_path).map_err(|e| format!("Failed to open temp decrypted tar: {}", e))?;
    let mut archive = tar::Archive::new(tar_file);

    archive.unpack(&opts.destination_dir)
        .map_err(|e| format!("Failed to unpack files from vault: {}", e))?;

    // Cleanup temp tar
    let _ = std::fs::remove_file(&temp_tar_path);

    let elapsed_ms = start_time.elapsed().as_millis() as u64;
    let mut final_payload = ProgressPayload::new(
        opts.task_id.clone(),
        "Complete".to_string(),
        header_meta.total_uncompressed_bytes,
        header_meta.total_uncompressed_bytes,
        "Vault Unlocked Successfully".to_string(),
        elapsed_ms,
    );
    final_payload.is_complete = true;
    let _ = app.emit("vault-progress", final_payload);

    Ok(opts.destination_dir)
}

pub fn read_vault_header(vault_path: &str) -> Result<VaultHeaderMeta, String> {
    let mut vault_file = File::open(vault_path)
        .map_err(|e| format!("Failed to open vault file: {}", e))?;

    let mut file_buf = Vec::new();
    vault_file.read_to_end(&mut file_buf).map_err(|e| format!("Read error: {}", e))?;

    let magic_pos = file_buf.windows(6).position(|w| w == VAULT_MAGIC)
        .ok_or_else(|| "Invalid vault format: Magic signature 'FVLT20' not found".to_string())?;

    let meta_start = magic_pos + 6;
    if file_buf.len() < meta_start + 4 {
        return Err("Corrupted vault header".to_string());
    }

    let header_len = u32::from_be_bytes(file_buf[meta_start..meta_start + 4].try_into().unwrap()) as usize;
    let json_start = meta_start + 4;
    let json_end = json_start + header_len;

    if file_buf.len() < json_end {
        return Err("Truncated vault header metadata".to_string());
    }

    let header_meta: VaultHeaderMeta = serde_json::from_slice(&file_buf[json_start..json_end])
        .map_err(|e| format!("Header parse error: {}", e))?;

    Ok(header_meta)
}
