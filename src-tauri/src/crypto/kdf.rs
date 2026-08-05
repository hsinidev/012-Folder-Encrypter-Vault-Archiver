use argon2::{Argon2, Algorithm, Version, Params};
use zeroize::{Zeroize, ZeroizeOnDrop};
use serde::{Deserialize, Serialize};

#[derive(Zeroize, ZeroizeOnDrop)]
pub struct DerivedKey {
    pub key: [u8; 32],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KdfParams {
    pub m_cost_kb: u32,
    pub t_cost: u32,
    pub p_cost: u32,
}

impl Default for KdfParams {
    fn default() -> Self {
        Self {
            m_cost_kb: 65536, // 64 MB
            t_cost: 3,        // 3 iterations
            p_cost: 4,        // 4 parallelism threads
        }
    }
}

pub fn derive_key(passphrase: &str, salt: &[u8], params: &KdfParams) -> Result<DerivedKey, String> {
    let mut key = [0u8; 32];
    
    let argon2_params = Params::new(
        params.m_cost_kb,
        params.t_cost,
        params.p_cost,
        Some(32),
    ).map_err(|e| format!("Argon2 params error: {}", e))?;

    let argon2 = Argon2::new(
        Algorithm::Argon2id,
        Version::V0x13,
        argon2_params,
    );

    argon2.hash_password_into(passphrase.as_bytes(), salt, &mut key)
        .map_err(|e| format!("Argon2 key derivation failed: {}", e))?;

    Ok(DerivedKey { key })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PassphraseAnalysis {
    pub score: u32,
    pub entropy_bits: f64,
    pub crack_time_display: String,
    pub feedback: Vec<String>,
}

pub fn analyze_passphrase(passphrase: &str) -> PassphraseAnalysis {
    let len = passphrase.len();
    if len == 0 {
        return PassphraseAnalysis {
            score: 0,
            entropy_bits: 0.0,
            crack_time_display: "Instant".to_string(),
            feedback: vec!["Passphrase cannot be empty".to_string()],
        };
    }

    let mut charset_size: f64 = 0.0;
    let mut has_lower = false;
    let mut has_upper = false;
    let mut has_digits = false;
    let mut has_special = false;

    for ch in passphrase.chars() {
        if ch.is_ascii_lowercase() { has_lower = true; }
        else if ch.is_ascii_uppercase() { has_upper = true; }
        else if ch.is_ascii_digit() { has_digits = true; }
        else { has_special = true; }
    }

    if has_lower { charset_size += 26.0; }
    if has_upper { charset_size += 26.0; }
    if has_digits { charset_size += 10.0; }
    if has_special { charset_size += 32.0; }

    if charset_size == 0.0 { charset_size = 26.0; }

    let entropy_bits = len as f64 * (charset_size.log2());

    // Score from 0 to 100
    let mut score = (entropy_bits / 1.2).min(100.0) as u32;
    if len < 8 { score = score.min(30); }

    let crack_time_display = if entropy_bits < 35.0 {
        "A few seconds".to_string()
    } else if entropy_bits < 50.0 {
        "A few hours / days".to_string()
    } else if entropy_bits < 75.0 {
        "Several months / years".to_string()
    } else if entropy_bits < 100.0 {
        "Centuries".to_string()
    } else {
        "Millions of years (Military Grade)".to_string()
    };

    let mut feedback = Vec::new();
    if len < 12 {
        feedback.push("Use at least 12+ characters for high security".to_string());
    }
    if !has_upper || !has_lower {
        feedback.push("Mix uppercase and lowercase letters".to_string());
    }
    if !has_digits {
        feedback.push("Include numbers".to_string());
    }
    if !has_special {
        feedback.push("Include special symbols (!@#$%^&*)".to_string());
    }
    if feedback.is_empty() {
        feedback.push("Excellent military-grade passphrase strength".to_string());
    }

    PassphraseAnalysis {
        score,
        entropy_bits,
        crack_time_display,
        feedback,
    }
}
