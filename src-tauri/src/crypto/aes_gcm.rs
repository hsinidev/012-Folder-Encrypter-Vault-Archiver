use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce, Key
};

pub fn derive_chunk_nonce(base_nonce: &[u8; 12], chunk_index: u64) -> Nonce<aes_gcm::aead::consts::U12> {
    let mut nonce_bytes = *base_nonce;
    // Mix chunk index into the last 8 bytes of the nonce
    let idx_bytes = chunk_index.to_be_bytes();
    for i in 0..8 {
        nonce_bytes[4 + i] ^= idx_bytes[i];
    }
    *Nonce::from_slice(&nonce_bytes)
}

pub fn encrypt_chunk(key_bytes: &[u8; 32], base_nonce: &[u8; 12], chunk_index: u64, chunk_data: &[u8]) -> Result<Vec<u8>, String> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key_bytes));
    let nonce = derive_chunk_nonce(base_nonce, chunk_index);
    cipher.encrypt(&nonce, chunk_data)
        .map_err(|e| format!("Encryption error on chunk {}: {}", chunk_index, e))
}

pub fn decrypt_chunk(key_bytes: &[u8; 32], base_nonce: &[u8; 12], chunk_index: u64, ciphertext: &[u8]) -> Result<Vec<u8>, String> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key_bytes));
    let nonce = derive_chunk_nonce(base_nonce, chunk_index);
    cipher.decrypt(&nonce, ciphertext)
        .map_err(|e| format!("Decryption/Authentication failed on chunk {}: {}", chunk_index, e))
}
