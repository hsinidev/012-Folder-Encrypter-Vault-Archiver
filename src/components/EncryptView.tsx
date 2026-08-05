import React, { useState } from 'react';
import {
  FolderPlus,
  FilePlus,
  Trash2,
  Lock,
  Cpu,
  EyeOff,
  Flame,
  HardDrive,
  FolderDown,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import { PassphraseStrength } from './PassphraseStrength';
import {
  pickFilesOrFolders,
  pickSaveVaultPath,
  apiCreateVault,
  listenVaultProgress,
  apiShredFiles,
} from '../services/tauriIpc';
import { FileItem } from '../types/vault';

export const EncryptView: React.FC = () => {
  const {
    sourceItems,
    addSourceItems,
    removeSourceItem,
    clearSourceItems,
    outputVaultPath,
    setOutputVaultPath,
    passphrase,
    setPassphrase,
    confirmPassphrase,
    setConfirmPassphrase,
    kdfParams,
    setKdfParams,
    obfuscationLen,
    setObfuscationLen,
    shredSourceAfterEncrypt,
    setShredSourceAfterEncrypt,
    setIsOperationActive,
    setActiveProgress,
    addLog,
  } = useVaultStore();

  const [isDragOver, setIsDragOver] = useState(false);

  // File pickers
  const handleSelectFiles = async () => {
    const paths = await pickFilesOrFolders(false);
    if (paths) {
      const items: FileItem[] = paths.map((p) => ({
        id: p,
        path: p,
        name: p.split(/[/\\]/).pop() || p,
        size: Math.floor(Math.random() * 5000000) + 50000,
        isDirectory: false,
      }));
      addSourceItems(items);
      addLog('info', `Added ${items.length} source file(s) to vault builder`);
    }
  };

  const handleSelectFolder = async () => {
    const paths = await pickFilesOrFolders(true);
    if (paths) {
      const items: FileItem[] = paths.map((p) => ({
        id: p,
        path: p,
        name: p.split(/[/\\]/).pop() || p,
        size: Math.floor(Math.random() * 25000000) + 1000000,
        isDirectory: true,
      }));
      addSourceItems(items);
      addLog('info', `Added ${items.length} source directory/directories to vault builder`);
    }
  };

  const handleSelectOutputPath = async () => {
    const path = await pickSaveVaultPath('SecureVault_Archive.fva');
    if (path) {
      setOutputVaultPath(path);
      addLog('info', `Set destination vault output path: ${path}`);
    }
  };

  const calculateTotalSize = () => {
    return sourceItems.reduce((acc, curr) => acc + curr.size, 0);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleStartEncryption = async () => {
    if (sourceItems.length === 0) {
      alert('Please add at least one source file or folder to encrypt.');
      return;
    }
    if (!passphrase) {
      alert('Please enter a master passphrase.');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      alert('Passphrases do not match.');
      return;
    }
    if (!outputVaultPath) {
      alert('Please specify an output vault file path.');
      return;
    }

    const taskId = `task-enc-${Date.now()}`;
    setIsOperationActive(true);
    addLog('info', `Starting Vault Encryption task ${taskId}...`);

    let unlisten: (() => void) | null = null;
    try {
      unlisten = await listenVaultProgress((payload) => {
        if (payload.task_id === taskId) {
          setActiveProgress(payload);
        }
      });

      const resultPath = await apiCreateVault({
        sourcePaths: sourceItems.map((i) => i.path),
        outputVaultPath,
        passphrase,
        mCostMb: kdfParams.m_cost_kb / 1024,
        tCost: kdfParams.t_cost,
        pCost: kdfParams.p_cost,
        obfuscationLen,
        taskId,
      });

      addLog('success', `Vault created successfully at: ${resultPath}`);

      // Post-Encryption File Shredder Execution
      if (shredSourceAfterEncrypt) {
        addLog('warn', `Executing post-encryption DoD 5220.22-M source file destruction sweep...`);
        const shreddedBytes = await apiShredFiles({
          paths: sourceItems.map((i) => i.path),
          algorithm: 'dod_3pass',
          taskId: `task-shred-${Date.now()}`,
        });
        addLog('security', `Successfully shredded ${sourceItems.length} source file(s) (${formatBytes(shreddedBytes)})`);
        clearSourceItems();
      }
    } catch (err: any) {
      addLog('error', `Vault creation failed: ${err?.toString() || 'Unknown error'}`);
      alert(`Encryption Error: ${err?.toString() || 'Failed to create vault'}`);
    } finally {
      if (unlisten) unlisten();
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto max-h-[calc(100vh-4rem)]">
      {/* Header Banner */}
      <div className="flex items-center justify-between bg-[#0E1017] border border-[#252B3B] p-4 rounded-xl">
        <div>
          <h2 className="text-sm font-bold text-[#F8FAFC] flex items-center space-x-2">
            <Lock className="w-4 h-4 text-[#A855F7]" />
            <span>Interactive Vault Builder & Encrypter</span>
          </h2>
          <p className="text-xs text-[#94A3B8] font-mono mt-0.5">
            Pack folders into encrypted zero-knowledge vaults using Argon2id + AES-256-GCM
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleSelectFiles}
            className="px-3 py-1.5 bg-[#161924] hover:bg-[#252B3B] text-[#F8FAFC] rounded-lg text-xs font-mono border border-[#252B3B] flex items-center space-x-1.5 transition"
          >
            <FilePlus className="w-3.5 h-3.5 text-[#06B6D4]" />
            <span>Add Files</span>
          </button>
          <button
            onClick={handleSelectFolder}
            className="px-3 py-1.5 bg-[#161924] hover:bg-[#252B3B] text-[#F8FAFC] rounded-lg text-xs font-mono border border-[#252B3B] flex items-center space-x-1.5 transition"
          >
            <FolderPlus className="w-3.5 h-3.5 text-[#A855F7]" />
            <span>Add Folder</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Source Queue Dropzone & File List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Dropzone Container */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              handleSelectFiles();
            }}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition ${
              isDragOver
                ? 'border-[#A855F7] bg-[#A855F7]/10'
                : 'border-[#252B3B] hover:border-[#A855F7]/40 bg-[#0E1017]'
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-[#161924] mx-auto flex items-center justify-center border border-[#252B3B] mb-3">
              <FolderDown className="w-6 h-6 text-[#A855F7]" />
            </div>
            <p className="text-xs font-semibold text-[#F8FAFC]">
              Drag & Drop Source Folders or Files Here
            </p>
            <p className="text-[11px] text-[#94A3B8] font-mono mt-1">
              Supports unlimited folder depth, raw binaries, media, & document matrices
            </p>
          </div>

          {/* Queue Breakdown Panel */}
          <div className="bg-[#0E1017] border border-[#252B3B] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono border-b border-[#252B3B] pb-2">
              <span className="text-[#F8FAFC] font-semibold">
                Source Items Queue ({sourceItems.length})
              </span>
              <div className="flex items-center space-x-3">
                <span className="text-[#06B6D4]">
                  Total Size: <span className="font-bold">{formatBytes(calculateTotalSize())}</span>
                </span>
                {sourceItems.length > 0 && (
                  <button
                    onClick={clearSourceItems}
                    className="text-[#EF4444] hover:underline flex items-center space-x-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>

            {sourceItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#94A3B8] font-mono">
                No items added yet. Click 'Add Files' or 'Add Folder' to build your vault.
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {sourceItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between bg-[#161924] border border-[#252B3B] px-3 py-2 rounded-lg text-xs font-mono hover:border-[#A855F7]/30 transition"
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      {item.isDirectory ? (
                        <FolderPlus className="w-4 h-4 text-[#A855F7] shrink-0" />
                      ) : (
                        <HardDrive className="w-4 h-4 text-[#06B6D4] shrink-0" />
                      )}
                      <span className="text-[#F8FAFC] truncate">{item.name}</span>
                      <span className="text-[10px] text-[#94A3B8] truncate">({item.path})</span>
                    </div>
                    <div className="flex items-center space-x-3 shrink-0">
                      <span className="text-[#94A3B8] text-[11px]">{formatBytes(item.size)}</span>
                      <button
                        onClick={() => removeSourceItem(item.id)}
                        className="text-[#94A3B8] hover:text-[#EF4444]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Output Path Picker */}
          <div className="bg-[#0E1017] border border-[#252B3B] rounded-xl p-4 space-y-2">
            <label className="text-xs font-semibold text-[#F8FAFC] flex items-center space-x-1.5">
              <HardDrive className="w-3.5 h-3.5 text-[#06B6D4]" />
              <span>Target Vault File Destination (.fva)</span>
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={outputVaultPath}
                placeholder="Click 'Browse' to set destination file path..."
                className="w-full bg-[#161924] border border-[#252B3B] rounded-lg px-3 py-2 text-xs font-mono text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:outline-none"
              />
              <button
                onClick={handleSelectOutputPath}
                className="px-4 py-2 bg-[#161924] hover:bg-[#252B3B] text-[#F8FAFC] border border-[#252B3B] rounded-lg text-xs font-mono font-semibold shrink-0"
              >
                Browse...
              </button>
            </div>
          </div>
        </div>

        {/* Right Col: KDF & Obfuscation & Trigger Button */}
        <div className="space-y-5">
          {/* Passphrase Input */}
          <div className="bg-[#0E1017] border border-[#252B3B] rounded-xl p-4">
            <PassphraseStrength
              value={passphrase}
              onChange={setPassphrase}
              confirmValue={confirmPassphrase}
              onConfirmChange={setConfirmPassphrase}
            />
          </div>

          {/* KDF Argon2id Parameters Configurator */}
          <div className="bg-[#0E1017] border border-[#252B3B] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#252B3B] pb-2">
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-[#F8FAFC]">
                <Cpu className="w-3.5 h-3.5 text-[#06B6D4]" />
                <span>Argon2id Memory-Hard KDF Profile</span>
              </div>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div>
                <label className="text-[11px] text-[#94A3B8] flex justify-between">
                  <span>RAM Memory Cost:</span>
                  <span className="text-[#06B6D4] font-bold">{kdfParams.m_cost_kb / 1024} MB</span>
                </label>
                <input
                  type="range"
                  min="16"
                  max="256"
                  step="16"
                  value={kdfParams.m_cost_kb / 1024}
                  onChange={(e) => setKdfParams({ m_cost_kb: parseInt(e.target.value) * 1024 })}
                  className="w-full accent-[#06B6D4] h-1.5 bg-[#161924] rounded-lg"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#94A3B8] flex justify-between">
                  <span>Time Iterations:</span>
                  <span className="text-[#A855F7] font-bold">{kdfParams.t_cost} Passes</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={kdfParams.t_cost}
                  onChange={(e) => setKdfParams({ t_cost: parseInt(e.target.value) })}
                  className="w-full accent-[#A855F7] h-1.5 bg-[#161924] rounded-lg"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#94A3B8] flex justify-between">
                  <span>Parallel Threads:</span>
                  <span className="text-[#10B981] font-bold">{kdfParams.p_cost} Threads</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={kdfParams.p_cost}
                  onChange={(e) => setKdfParams({ p_cost: parseInt(e.target.value) })}
                  className="w-full accent-[#10B981] h-1.5 bg-[#161924] rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Header Obfuscation Selector */}
          <div className="bg-[#0E1017] border border-[#252B3B] rounded-xl p-4 space-y-2">
            <label className="text-xs font-semibold text-[#F8FAFC] flex items-center space-x-1.5">
              <EyeOff className="w-3.5 h-3.5 text-[#A855F7]" />
              <span>Header Obfuscation Entropy</span>
            </label>
            <div className="grid grid-cols-4 gap-1.5 text-[10px] font-mono">
              {[0, 64, 256, 1024].map((len) => (
                <button
                  key={len}
                  onClick={() => setObfuscationLen(len)}
                  className={`py-1.5 rounded border font-semibold transition ${
                    obfuscationLen === len
                      ? 'bg-[#A855F7]/20 border-[#A855F7] text-[#A855F7]'
                      : 'bg-[#161924] border-[#252B3B] text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  {len === 0 ? 'None' : `${len} B`}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-[#94A3B8] font-mono">
              Prepends pseudo-random bytes to mask binary file magic signatures.
            </p>
          </div>

          {/* Source Shredder Toggle */}
          <div className="bg-[#0E1017] border border-[#252B3B] rounded-xl p-4 space-y-2">
            <label className="flex items-center space-x-2 text-xs font-semibold text-[#F8FAFC] cursor-pointer">
              <input
                type="checkbox"
                checked={shredSourceAfterEncrypt}
                onChange={(e) => setShredSourceAfterEncrypt(e.target.checked)}
                className="rounded border-[#252B3B] text-[#EF4444] focus:ring-0 accent-[#EF4444]"
              />
              <Flame className="w-4 h-4 text-[#EF4444]" />
              <span>Shred Source Files Post-Encryption</span>
            </label>
            {shredSourceAfterEncrypt && (
              <div className="text-[10px] font-mono text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/30 p-2 rounded flex items-start space-x-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-[#EF4444] shrink-0 mt-0.5" />
                <span>
                  WARNING: Executes DoD 5220.22-M 3-pass overwrite on original source files after vault creation. Files will be permanently deleted!
                </span>
              </div>
            )}
          </div>

          {/* Engage Encryption Button */}
          <button
            onClick={handleStartEncryption}
            className="w-full py-3.5 rounded-xl text-xs font-bold btn-cyber-primary flex items-center justify-center space-x-2 uppercase tracking-wider"
          >
            <Lock className="w-4 h-4" />
            <span>Engage Vault Encryption</span>
          </button>
        </div>
      </div>
    </div>
  );
};
