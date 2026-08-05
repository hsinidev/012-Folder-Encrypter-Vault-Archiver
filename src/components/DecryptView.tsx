import React, { useState } from 'react';
import {
  Unlock,
  FolderOpen,
  FileCheck,
  ShieldCheck,
  AlertCircle,
  HardDrive,
  Cpu,
  KeyRound,
  Eye,
  EyeOff,
  Clock,
  Layers,
} from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import {
  pickFilesOrFolders,
  pickExtractDirectory,
  apiInspectVault,
  apiUnlockVault,
  listenVaultProgress,
} from '../services/tauriIpc';

export const DecryptView: React.FC = () => {
  const {
    inputVaultPath,
    setInputVaultPath,
    extractDestinationDir,
    setExtractDestinationDir,
    decryptPassphrase,
    setDecryptPassphrase,
    inspectedHeader,
    setInspectedHeader,
    setIsOperationActive,
    setActiveProgress,
    addLog,
  } = useVaultStore();

  const [showPassword, setShowPassword] = useState(false);
  const [inspectLoading, setInspectLoading] = useState(false);

  const handleSelectVaultFile = async () => {
    const paths = await pickFilesOrFolders(false);
    if (paths && paths.length > 0) {
      const vaultPath = paths[0];
      setInputVaultPath(vaultPath);
      addLog('info', `Selected vault file: ${vaultPath}`);

      setInspectLoading(true);
      try {
        const res = await apiInspectVault(vaultPath);
        setInspectedHeader(res);
        addLog('success', `Vault header inspected: ${res.header.total_files} files, ${res.header.obfuscation_len}B obfuscation header`);
      } catch (err: any) {
        addLog('error', `Failed to inspect vault header: ${err?.toString()}`);
        setInspectedHeader(null);
      } finally {
        setInspectLoading(false);
      }
    }
  };

  const handleSelectDestination = async () => {
    const dir = await pickExtractDirectory();
    if (dir) {
      setExtractDestinationDir(dir);
      addLog('info', `Set extraction output folder: ${dir}`);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleStartDecryption = async () => {
    if (!inputVaultPath) {
      alert('Please select a .fva or .vault archive file.');
      return;
    }
    if (!extractDestinationDir) {
      alert('Please select an extraction destination directory.');
      return;
    }
    if (!decryptPassphrase) {
      alert('Please enter the vault master passphrase.');
      return;
    }

    const taskId = `task-dec-${Date.now()}`;
    setIsOperationActive(true);
    addLog('info', `Starting Vault Unlocking task ${taskId}...`);

    let unlisten: (() => void) | null = null;
    try {
      unlisten = await listenVaultProgress((payload) => {
        if (payload.task_id === taskId) {
          setActiveProgress(payload);
        }
      });

      const extractedDir = await apiUnlockVault({
        vaultPath: inputVaultPath,
        destinationDir: extractDestinationDir,
        passphrase: decryptPassphrase,
        taskId,
      });

      addLog('success', `Vault unlocked successfully into: ${extractedDir}`);
    } catch (err: any) {
      addLog('error', `Vault unlock failed: ${err?.toString() || 'Incorrect passphrase'}`);
      alert(`Unlock Error: ${err?.toString() || 'Passphrase incorrect or vault corrupted'}`);
    } finally {
      if (unlisten) unlisten();
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto overflow-y-auto max-h-[calc(100vh-4rem)]">
      {/* Header Banner */}
      <div className="flex items-center justify-between bg-[#0E1017] border border-[#252B3B] p-4 rounded-xl">
        <div>
          <h2 className="text-sm font-bold text-[#F8FAFC] flex items-center space-x-2">
            <Unlock className="w-4 h-4 text-[#06B6D4]" />
            <span>Vault Inspection & Extraction Workstation</span>
          </h2>
          <p className="text-xs text-[#94A3B8] font-mono mt-0.5">
            Zero-knowledge decryption engine with magic signature verification & Argon2id key derivation
          </p>
        </div>
        <button
          onClick={handleSelectVaultFile}
          className="px-4 py-2 bg-[#161924] hover:bg-[#252B3B] text-[#F8FAFC] rounded-lg text-xs font-mono font-semibold border border-[#252B3B] flex items-center space-x-2 transition"
        >
          <FileCheck className="w-4 h-4 text-[#06B6D4]" />
          <span>Select Vault File (.fva)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Vault File Selection & Inspection Drawer */}
        <div className="space-y-4">
          <div className="bg-[#0E1017] border border-[#252B3B] rounded-xl p-4 space-y-3">
            <label className="text-xs font-semibold text-[#F8FAFC] flex items-center space-x-1.5">
              <HardDrive className="w-3.5 h-3.5 text-[#06B6D4]" />
              <span>Target Vault Archive File</span>
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={inputVaultPath}
                placeholder="Click 'Browse' to select vault file..."
                className="w-full bg-[#161924] border border-[#252B3B] rounded-lg px-3 py-2 text-xs font-mono text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:outline-none"
              />
              <button
                onClick={handleSelectVaultFile}
                className="px-3.5 py-2 bg-[#161924] hover:bg-[#252B3B] text-[#F8FAFC] border border-[#252B3B] rounded-lg text-xs font-mono font-semibold shrink-0"
              >
                Browse...
              </button>
            </div>
          </div>

          {/* Inspected Vault Header Metadata Card */}
          {inspectLoading ? (
            <div className="bg-[#0E1017] border border-[#252B3B] rounded-xl p-8 text-center text-xs text-[#94A3B8] font-mono animate-pulse">
              Parsing vault obfuscation header and reading Argon2id parameters...
            </div>
          ) : inspectedHeader ? (
            <div className="bg-[#0E1017] border border-[#252B3B] rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-[#252B3B] pb-2">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                  <span className="text-xs font-bold text-[#F8FAFC]">Vault Header Metadata</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30">
                  {inspectedHeader.header.magic} Valid Signature
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-[#161924] p-2.5 rounded border border-[#252B3B]">
                  <span className="text-[10px] text-[#94A3B8] block">Vault Version</span>
                  <span className="text-[#F8FAFC] font-semibold">{inspectedHeader.header.version}</span>
                </div>
                <div className="bg-[#161924] p-2.5 rounded border border-[#252B3B]">
                  <span className="text-[10px] text-[#94A3B8] block">Obfuscation Header</span>
                  <span className="text-[#A855F7] font-semibold">{inspectedHeader.header.obfuscation_len} Bytes</span>
                </div>
                <div className="bg-[#161924] p-2.5 rounded border border-[#252B3B]">
                  <span className="text-[10px] text-[#94A3B8] block">Total Items Packed</span>
                  <span className="text-[#06B6D4] font-semibold">{inspectedHeader.header.total_files} Files</span>
                </div>
                <div className="bg-[#161924] p-2.5 rounded border border-[#252B3B]">
                  <span className="text-[10px] text-[#94A3B8] block">Original Uncompressed Size</span>
                  <span className="text-[#10B981] font-semibold">
                    {formatBytes(inspectedHeader.header.total_uncompressed_bytes)}
                  </span>
                </div>
              </div>

              {/* KDF Configuration */}
              <div className="bg-[#161924] p-3 rounded-lg border border-[#252B3B] space-y-1.5 text-xs font-mono">
                <div className="text-[11px] text-[#94A3B8] font-bold flex items-center space-x-1.5">
                  <Cpu className="w-3.5 h-3.5 text-[#06B6D4]" />
                  <span>Argon2id Requirements</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px] text-[#F8FAFC]">
                  <div>Memory: <span className="text-[#06B6D4]">{inspectedHeader.header.kdf_params.m_cost_kb / 1024} MB</span></div>
                  <div>Passes: <span className="text-[#A855F7]">{inspectedHeader.header.kdf_params.t_cost}</span></div>
                  <div>Threads: <span className="text-[#10B981]">{inspectedHeader.header.kdf_params.p_cost}</span></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#0E1017] border border-[#252B3B] rounded-xl p-8 text-center text-xs text-[#94A3B8] font-mono space-y-2">
              <AlertCircle className="w-6 h-6 text-[#94A3B8] mx-auto opacity-50" />
              <p>No vault archive selected. Choose a .fva file to inspect cryptographic header specifications.</p>
            </div>
          )}
        </div>

        {/* Right Column: Destination Folder & Passphrase */}
        <div className="space-y-5">
          {/* Destination Folder Picker */}
          <div className="bg-[#0E1017] border border-[#252B3B] rounded-xl p-4 space-y-2">
            <label className="text-xs font-semibold text-[#F8FAFC] flex items-center space-x-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-[#A855F7]" />
              <span>Extraction Target Directory</span>
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={extractDestinationDir}
                placeholder="Click 'Browse' to set extraction destination folder..."
                className="w-full bg-[#161924] border border-[#252B3B] rounded-lg px-3 py-2 text-xs font-mono text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:outline-none"
              />
              <button
                onClick={handleSelectDestination}
                className="px-4 py-2 bg-[#161924] hover:bg-[#252B3B] text-[#F8FAFC] border border-[#252B3B] rounded-lg text-xs font-mono font-semibold shrink-0"
              >
                Browse...
              </button>
            </div>
          </div>

          {/* Passphrase Input Box */}
          <div className="bg-[#0E1017] border border-[#252B3B] rounded-xl p-4 space-y-3">
            <label className="text-xs font-semibold text-[#F8FAFC] flex items-center space-x-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#06B6D4]" />
              <span>Vault Master Passphrase</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={decryptPassphrase}
                onChange={(e) => setDecryptPassphrase(e.target.value)}
                placeholder="Enter Vault Master Passphrase..."
                className="w-full bg-[#161924] border border-[#252B3B] focus:border-[#06B6D4] rounded-lg px-3.5 py-2.5 text-xs text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:outline-none focus:ring-1 focus:ring-[#06B6D4] font-mono pr-10 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#F8FAFC]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Trigger Decryption Button */}
          <button
            onClick={handleStartDecryption}
            className="w-full py-3.5 rounded-xl text-xs font-bold btn-cyber-cyan flex items-center justify-center space-x-2 uppercase tracking-wider"
          >
            <Unlock className="w-4 h-4" />
            <span>Unlock & Extract Vault</span>
          </button>
        </div>
      </div>
    </div>
  );
};
