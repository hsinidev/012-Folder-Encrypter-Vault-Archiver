import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { open, save } from '@tauri-apps/plugin-dialog';

import {
  ProgressPayload,
  PassphraseAnalysis,
  VaultInspectionResult,
  KdfBenchmarkResult,
} from '../types/vault';

// Check if running inside Tauri window context
export const isTauriAvailable = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

export interface CreateVaultParams {
  sourcePaths: string[];
  outputVaultPath: string;
  passphrase: string;
  mCostMb: number;
  tCost: number;
  pCost: number;
  obfuscationLen: number;
  taskId: string;
}

export interface UnlockVaultParams {
  vaultPath: string;
  destinationDir: string;
  passphrase: string;
  taskId: string;
}

export interface ShredFilesParams {
  paths: string[];
  algorithm: 'dod_3pass' | 'zero_1pass' | 'gutmann_35pass';
  taskId: string;
}

// IPC Invocation Wrappers
export const apiCreateVault = async (params: CreateVaultParams): Promise<string> => {
  if (!isTauriAvailable()) {
    return mockCreateVault(params);
  }
  return await invoke<string>('create_vault', {
    req: {
      source_paths: params.sourcePaths,
      output_vault_path: params.outputVaultPath,
      passphrase: params.passphrase,
      m_cost_mb: params.mCostMb,
      t_cost: params.tCost,
      p_cost: params.pCost,
      obfuscation_len: params.obfuscationLen,
      task_id: params.taskId,
    },
  });
};

export const apiUnlockVault = async (params: UnlockVaultParams): Promise<string> => {
  if (!isTauriAvailable()) {
    return mockUnlockVault(params);
  }
  return await invoke<string>('unlock_vault', {
    req: {
      vault_path: params.vaultPath,
      destination_dir: params.destinationDir,
      passphrase: params.passphrase,
      task_id: params.taskId,
    },
  });
};

export const apiShredFiles = async (params: ShredFilesParams): Promise<number> => {
  if (!isTauriAvailable()) {
    return mockShredFiles(params);
  }
  return await invoke<number>('shred_files', {
    req: {
      paths: params.paths,
      algorithm: params.algorithm,
      task_id: params.taskId,
    },
  });
};

export const apiInspectVault = async (vaultPath: string): Promise<VaultInspectionResult> => {
  if (!isTauriAvailable()) {
    return mockInspectVault(vaultPath);
  }
  return await invoke<VaultInspectionResult>('inspect_vault', { vaultPath });
};

export const apiAnalyzePassphrase = async (passphrase: string): Promise<PassphraseAnalysis> => {
  if (!isTauriAvailable()) {
    return mockAnalyzePassphrase(passphrase);
  }
  return await invoke<PassphraseAnalysis>('analyze_passphrase_cmd', { passphrase });
};

export const apiBenchmarkKdf = async (
  mCostMb: number,
  tCost: number,
  pCost: number
): Promise<KdfBenchmarkResult> => {
  if (!isTauriAvailable()) {
    return mockBenchmarkKdf(mCostMb, tCost, pCost);
  }
  return await invoke<KdfBenchmarkResult>('benchmark_kdf', {
    mCostMb,
    tCost,
    pCost,
  });
};

// Event listener wrapper
export const listenVaultProgress = async (
  callback: (payload: ProgressPayload) => void
): Promise<UnlistenFn> => {
  if (!isTauriAvailable()) {
    mockProgressListeners.push(callback);
    return () => {
      const idx = mockProgressListeners.indexOf(callback);
      if (idx !== -1) mockProgressListeners.splice(idx, 1);
    };
  }
  return await listen<ProgressPayload>('vault-progress', (event) => {
    callback(event.payload);
  });
};

// Dialog Pickers
export const pickFilesOrFolders = async (directoryOnly = false): Promise<string[] | null> => {
  if (!isTauriAvailable()) {
    const mockPath = directoryOnly ? 'C:\\User\\Documents\\ProtectedFolder' : 'C:\\User\\Documents\\SensitiveData.docx';
    return [mockPath];
  }
  const selected = await open({
    multiple: true,
    directory: directoryOnly,
  });

  if (!selected) return null;
  return Array.isArray(selected) ? selected : [selected];
};

export const pickSaveVaultPath = async (defaultName = 'Vault_Archive.fva'): Promise<string | null> => {
  if (!isTauriAvailable()) {
    return `C:\\User\\Desktop\\${defaultName}`;
  }
  const savePath = await save({
    defaultPath: defaultName,
    filters: [
      { name: 'Encrypted Vault (*.fva, *.vault)', extensions: ['fva', 'vault'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  return savePath;
};

export const pickExtractDirectory = async (): Promise<string | null> => {
  if (!isTauriAvailable()) {
    return 'C:\\User\\Desktop\\ExtractedVaultContent';
  }
  const dir = await open({
    directory: true,
    multiple: false,
  });
  return typeof dir === 'string' ? dir : null;
};

// Web Mock Engine for Dev / Web Preview
const mockProgressListeners: Array<(payload: ProgressPayload) => void> = [];

const emitMockProgress = (payload: ProgressPayload) => {
  mockProgressListeners.forEach((fn) => fn(payload));
};

const mockCreateVault = async (params: CreateVaultParams): Promise<string> => {
  const total = 50 * 1024 * 1024; // 50MB
  const steps = [
    { stage: 'Preparing', msg: 'Scanning file headers & building directory tree' },
    { stage: 'DerivingKey', msg: 'Executing Argon2id KDF key derivation...' },
    { stage: 'PackingTar', msg: 'Serializing tar archive stream' },
    { stage: 'Encrypting', msg: 'Streaming 64KB AES-256-GCM chunked encryption' },
  ];

  let current = 0;
  const startTime = Date.now();

  for (const step of steps) {
    emitMockProgress({
      task_id: params.taskId,
      stage: step.stage as any,
      processed_bytes: current,
      total_bytes: total,
      percentage: (current / total) * 100,
      current_file: step.msg,
      throughput_mbps: 34.5,
      elapsed_ms: Date.now() - startTime,
      eta_seconds: Math.ceil((total - current) / (34.5 * 1024 * 1024)),
      is_complete: false,
    });
    await new Promise((r) => setTimeout(r, 400));
    current += 12.5 * 1024 * 1024;
  }

  emitMockProgress({
    task_id: params.taskId,
    stage: 'Complete',
    processed_bytes: total,
    total_bytes: total,
    percentage: 100,
    current_file: 'Vault Encrypted Successfully',
    throughput_mbps: 45.2,
    elapsed_ms: Date.now() - startTime,
    eta_seconds: 0,
    is_complete: true,
  });

  return params.outputVaultPath;
};

const mockUnlockVault = async (params: UnlockVaultParams): Promise<string> => {
  const total = 50 * 1024 * 1024;
  const startTime = Date.now();

  emitMockProgress({
    task_id: params.taskId,
    stage: 'DerivingKey',
    processed_bytes: 0,
    total_bytes: total,
    percentage: 10,
    current_file: 'Verifying passphrase & deriving key via Argon2id',
    throughput_mbps: 0,
    elapsed_ms: 200,
    eta_seconds: 2,
    is_complete: false,
  });
  await new Promise((r) => setTimeout(r, 500));

  emitMockProgress({
    task_id: params.taskId,
    stage: 'Decrypting',
    processed_bytes: total / 2,
    total_bytes: total,
    percentage: 60,
    current_file: 'Decrypting AES-256-GCM authenticated payload chunks',
    throughput_mbps: 62.4,
    elapsed_ms: Date.now() - startTime,
    eta_seconds: 1,
    is_complete: false,
  });
  await new Promise((r) => setTimeout(r, 600));

  emitMockProgress({
    task_id: params.taskId,
    stage: 'Complete',
    processed_bytes: total,
    total_bytes: total,
    percentage: 100,
    current_file: 'Vault Unlocked & Extracted',
    throughput_mbps: 78.1,
    elapsed_ms: Date.now() - startTime,
    eta_seconds: 0,
    is_complete: true,
  });

  return params.destinationDir;
};

const mockShredFiles = async (params: ShredFilesParams): Promise<number> => {
  const total = 10 * 1024 * 1024;
  const startTime = Date.now();

  emitMockProgress({
    task_id: params.taskId,
    stage: 'Shredding',
    processed_bytes: total / 2,
    total_bytes: total,
    percentage: 50,
    current_file: 'Executing DoD 5220.22-M Pass 2 (0xFF Overwrite)',
    throughput_mbps: 28.4,
    elapsed_ms: Date.now() - startTime,
    eta_seconds: 1,
    is_complete: false,
  });
  await new Promise((r) => setTimeout(r, 600));

  emitMockProgress({
    task_id: params.taskId,
    stage: 'Complete',
    processed_bytes: total,
    total_bytes: total,
    percentage: 100,
    current_file: 'DoD 3-Pass Destruction Complete',
    throughput_mbps: 32.1,
    elapsed_ms: Date.now() - startTime,
    eta_seconds: 0,
    is_complete: true,
  });

  return total;
};

const mockInspectVault = async (vaultPath: string): Promise<VaultInspectionResult> => {
  return {
    vault_path: vaultPath,
    total_vault_file_size: 52428800,
    is_valid_signature: true,
    header: {
      magic: 'FVLT20',
      version: '2.0.0-PROD',
      salt_base64: 'k8X+0bZ2F4M8x7v1a/9w==',
      nonce_base64: '9v8c7b6a5s4d3f2e1w0q',
      kdf_params: {
        m_cost_kb: 65536,
        t_cost: 3,
        p_cost: 4,
      },
      chunk_size: 65536,
      total_files: 42,
      total_uncompressed_bytes: 52428800,
      obfuscation_len: 256,
      created_at: new Date().toISOString(),
    },
  };
};

const mockAnalyzePassphrase = async (passphrase: string): Promise<PassphraseAnalysis> => {
  const len = passphrase.length;
  if (!passphrase) {
    return { score: 0, entropy_bits: 0, crack_time_display: 'Instant', feedback: ['Enter a passphrase'] };
  }
  const entropy = len * 4.7;
  const score = Math.min(100, Math.round(entropy));
  return {
    score,
    entropy_bits: Math.round(entropy * 10) / 10,
    crack_time_display: score > 70 ? 'Centuries' : '3 Hours',
    feedback: score > 70 ? ['Military grade passphrase!'] : ['Add numbers and symbols'],
  };
};

const mockBenchmarkKdf = async (mCostMb: number, tCost: number, pCost: number): Promise<KdfBenchmarkResult> => {
  await new Promise((r) => setTimeout(r, 450));
  return {
    m_cost_mb: mCostMb,
    t_cost: tCost,
    p_cost: pCost,
    duration_ms: Math.round(mCostMb * 1.5 + tCost * 40),
    memory_allocated_mb: mCostMb,
  };
};
