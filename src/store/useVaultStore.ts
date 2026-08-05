import { create } from 'zustand';
import {
  FileItem,
  ProgressPayload,
  KdfParams,
  LogEntry,
  VaultInspectionResult,
} from '../types/vault';

export type ActiveTab = 'encrypt' | 'decrypt' | 'shredder' | 'inspector';

interface VaultStoreState {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;

  // Encrypt Form State
  sourceItems: FileItem[];
  outputVaultPath: string;
  passphrase: string;
  confirmPassphrase: string;
  kdfParams: KdfParams;
  obfuscationLen: number; // 0, 64, 256, 1024 bytes
  shredSourceAfterEncrypt: boolean;

  // Actions for Encrypt Form
  addSourceItems: (items: FileItem[]) => void;
  removeSourceItem: (id: string) => void;
  clearSourceItems: () => void;
  setOutputVaultPath: (path: string) => void;
  setPassphrase: (pass: string) => void;
  setConfirmPassphrase: (pass: string) => void;
  setKdfParams: (params: Partial<KdfParams>) => void;
  setObfuscationLen: (len: number) => void;
  setShredSourceAfterEncrypt: (val: boolean) => void;

  // Decrypt Form State
  inputVaultPath: string;
  extractDestinationDir: string;
  decryptPassphrase: string;
  inspectedHeader: VaultInspectionResult | null;
  setInputVaultPath: (path: string) => void;
  setExtractDestinationDir: (dir: string) => void;
  setDecryptPassphrase: (pass: string) => void;
  setInspectedHeader: (res: VaultInspectionResult | null) => void;

  // Shredder State
  shredTargetItems: FileItem[];
  shredAlgorithm: 'dod_3pass' | 'zero_1pass' | 'gutmann_35pass';
  shredConfirmUnlocked: boolean;
  addShredTargetItems: (items: FileItem[]) => void;
  removeShredTargetItem: (id: string) => void;
  clearShredTargetItems: () => void;
  setShredAlgorithm: (algo: 'dod_3pass' | 'zero_1pass' | 'gutmann_35pass') => void;
  setShredConfirmUnlocked: (val: boolean) => void;

  // Telemetry & Active Task Modal
  activeProgress: ProgressPayload | null;
  isOperationActive: boolean;
  setActiveProgress: (progress: ProgressPayload | null) => void;
  setIsOperationActive: (val: boolean) => void;

  // Audit Logs
  logs: LogEntry[];
  addLog: (level: LogEntry['level'], message: string) => void;
  clearLogs: () => void;
}

export const useVaultStore = create<VaultStoreState>((set) => ({
  activeTab: 'encrypt',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Encrypt Form
  sourceItems: [],
  outputVaultPath: '',
  passphrase: '',
  confirmPassphrase: '',
  kdfParams: {
    m_cost_kb: 65536, // 64MB default
    t_cost: 3,        // 3 iterations
    p_cost: 4,        // 4 parallel threads
  },
  obfuscationLen: 256, // 256 random bytes header obfuscation
  shredSourceAfterEncrypt: false,

  addSourceItems: (newItems) =>
    set((state) => {
      const existingIds = new Set(state.sourceItems.map((i) => i.path));
      const filtered = newItems.filter((i) => !existingIds.has(i.path));
      return { sourceItems: [...state.sourceItems, ...filtered] };
    }),

  removeSourceItem: (id) =>
    set((state) => ({
      sourceItems: state.sourceItems.filter((i) => i.id !== id),
    })),

  clearSourceItems: () => set({ sourceItems: [] }),
  setOutputVaultPath: (path) => set({ outputVaultPath: path }),
  setPassphrase: (passphrase) => set({ passphrase }),
  setConfirmPassphrase: (confirmPassphrase) => set({ confirmPassphrase }),
  setKdfParams: (params) =>
    set((state) => ({
      kdfParams: { ...state.kdfParams, ...params },
    })),
  setObfuscationLen: (len) => set({ obfuscationLen: len }),
  setShredSourceAfterEncrypt: (val) => set({ shredSourceAfterEncrypt: val }),

  // Decrypt Form
  inputVaultPath: '',
  extractDestinationDir: '',
  decryptPassphrase: '',
  inspectedHeader: null,
  setInputVaultPath: (inputVaultPath) => set({ inputVaultPath }),
  setExtractDestinationDir: (extractDestinationDir) => set({ extractDestinationDir }),
  setDecryptPassphrase: (decryptPassphrase) => set({ decryptPassphrase }),
  setInspectedHeader: (inspectedHeader) => set({ inspectedHeader }),

  // Shredder
  shredTargetItems: [],
  shredAlgorithm: 'dod_3pass',
  shredConfirmUnlocked: false,
  addShredTargetItems: (newItems) =>
    set((state) => {
      const existingIds = new Set(state.shredTargetItems.map((i) => i.path));
      const filtered = newItems.filter((i) => !existingIds.has(i.path));
      return { shredTargetItems: [...state.shredTargetItems, ...filtered] };
    }),
  removeShredTargetItem: (id) =>
    set((state) => ({
      shredTargetItems: state.shredTargetItems.filter((i) => i.id !== id),
    })),
  clearShredTargetItems: () => set({ shredTargetItems: [] }),
  setShredAlgorithm: (algo) => set({ shredAlgorithm: algo }),
  setShredConfirmUnlocked: (val) => set({ shredConfirmUnlocked: val }),

  // Progress Modal
  activeProgress: null,
  isOperationActive: false,
  setActiveProgress: (activeProgress) => set({ activeProgress }),
  setIsOperationActive: (isOperationActive) => set({ isOperationActive }),

  // Audit Logs
  logs: [
    {
      id: 'init-log-1',
      timestamp: new Date().toLocaleTimeString(),
      level: 'info',
      message: 'Vault Engine Initialized: Argon2id KDF + AES-256-GCM + Zeroize RAM Hygiene Active',
    },
  ],
  addLog: (level, message) =>
    set((state) => ({
      logs: [
        ...state.logs,
        {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: new Date().toLocaleTimeString(),
          level,
          message,
        },
      ],
    })),
  clearLogs: () => set({ logs: [] }),
}));
