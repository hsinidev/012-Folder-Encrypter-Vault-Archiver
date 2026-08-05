export interface ProgressPayload {
  task_id: string;
  stage: 'Preparing' | 'Compressing' | 'PackingTar' | 'DerivingKey' | 'Encrypting' | 'Decrypting' | 'Extracting' | 'Shredding' | 'Complete' | 'Error';
  processed_bytes: number;
  total_bytes: number;
  percentage: number;
  current_file: string;
  throughput_mbps: number;
  elapsed_ms: number;
  eta_seconds: number;
  is_complete: boolean;
  error?: string;
}

export interface KdfParams {
  m_cost_kb: number;
  t_cost: number;
  p_cost: number;
}

export interface PassphraseAnalysis {
  score: number;
  entropy_bits: number;
  crack_time_display: string;
  feedback: string[];
}

export interface VaultHeaderMeta {
  magic: string;
  version: string;
  salt_base64: string;
  nonce_base64: string;
  kdf_params: KdfParams;
  chunk_size: number;
  total_files: number;
  total_uncompressed_bytes: number;
  obfuscation_len: number;
  created_at: string;
}

export interface VaultInspectionResult {
  header: VaultHeaderMeta;
  vault_path: string;
  total_vault_file_size: number;
  is_valid_signature: boolean;
}

export interface KdfBenchmarkResult {
  m_cost_mb: number;
  t_cost: number;
  p_cost: number;
  duration_ms: number;
  memory_allocated_mb: number;
}

export interface FileItem {
  id: string;
  path: string;
  name: string;
  size: number;
  isDirectory: boolean;
  itemCount?: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success' | 'security';
  message: string;
}
