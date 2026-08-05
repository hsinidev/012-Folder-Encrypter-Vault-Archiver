pub mod kdf;
pub mod header;
pub mod aes_gcm;
pub mod vault_stream;

pub use kdf::{derive_key, analyze_passphrase, KdfParams, PassphraseAnalysis};
pub use header::{VaultHeaderMeta, generate_obfuscation_bytes};
pub use vault_stream::{create_vault_stream, unlock_vault_stream, read_vault_header, CreateVaultOptions, UnlockVaultOptions};
