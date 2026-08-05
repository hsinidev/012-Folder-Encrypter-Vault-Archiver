use serde::{Deserialize, Serialize};
use rand::RngCore;
use super::kdf::KdfParams;

pub const VAULT_MAGIC: &[u8; 6] = b"FVLT20";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultHeaderMeta {
    pub magic: String,
    pub version: String,
    pub salt_base64: String,
    pub nonce_base64: String,
    pub kdf_params: KdfParams,
    pub chunk_size: u32,
    pub total_files: u64,
    pub total_uncompressed_bytes: u64,
    pub obfuscation_len: u32,
    pub created_at: String,
}

impl VaultHeaderMeta {
    pub fn new(
        salt: &[u8; 16],
        nonce: &[u8; 12],
        kdf_params: KdfParams,
        chunk_size: u32,
        total_files: u64,
        total_bytes: u64,
        obfuscation_len: u32,
    ) -> Self {
        use base64::{Engine as _, engine::general_purpose::STANDARD};
        Self {
            magic: "FVLT20".to_string(),
            version: "2.0.0-PROD".to_string(),
            salt_base64: STANDARD.encode(salt),
            nonce_base64: STANDARD.encode(nonce),
            kdf_params,
            chunk_size,
            total_files,
            total_uncompressed_bytes: total_bytes,
            obfuscation_len,
            created_at: chrono::Utc::now().to_rfc3339(),
        }
    }

    pub fn get_salt(&self) -> Result<[u8; 16], String> {
        use base64::{Engine as _, engine::general_purpose::STANDARD};
        let bytes = STANDARD.decode(&self.salt_base64)
            .map_err(|e| format!("Invalid salt base64: {}", e))?;
        if bytes.len() != 16 {
            return Err("Invalid salt length".to_string());
        }
        let mut salt = [0u8; 16];
        salt.copy_from_slice(&bytes);
        Ok(salt)
    }

    pub fn get_nonce(&self) -> Result<[u8; 12], String> {
        use base64::{Engine as _, engine::general_purpose::STANDARD};
        let bytes = STANDARD.decode(&self.nonce_base64)
            .map_err(|e| format!("Invalid nonce base64: {}", e))?;
        if bytes.len() != 12 {
            return Err("Invalid nonce length".to_string());
        }
        let mut nonce = [0u8; 12];
        nonce.copy_from_slice(&bytes);
        Ok(nonce)
    }
}

pub fn generate_obfuscation_bytes(len: u32) -> Vec<u8> {
    let mut rng = rand::thread_rng();
    let mut bytes = vec![0u8; len as usize];
    rng.fill_bytes(&mut bytes);
    bytes
}
