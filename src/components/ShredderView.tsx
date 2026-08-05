import React, { useState } from 'react';
import {
  Flame,
  FilePlus,
  FolderPlus,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import { FileItem } from '../types/vault';
import {
  pickFilesOrFolders,
  apiShredFiles,
  listenVaultProgress,
} from '../services/tauriIpc';

export const ShredderView: React.FC = () => {
  const {
    shredTargetItems,
    addShredTargetItems,
    removeShredTargetItem,
    clearShredTargetItems,
    shredAlgorithm,
    setShredAlgorithm,
    shredConfirmUnlocked,
    setShredConfirmUnlocked,
    setIsOperationActive,
    setActiveProgress,
    addLog,
  } = useVaultStore();

  const handleAddFiles = async () => {
    const paths = await pickFilesOrFolders(false);
    if (paths) {
      const items: FileItem[] = paths.map((p) => ({
        id: p,
        path: p,
        name: p.split(/[/\\]/).pop() || p,
        size: Math.floor(Math.random() * 10000000) + 100000,
        isDirectory: false,
      }));
      addShredTargetItems(items);
      addLog('warn', `Added ${items.length} file(s) to secure shredder queue`);
    }
  };

  const handleAddFolders = async () => {
    const paths = await pickFilesOrFolders(true);
    if (paths) {
      const items: FileItem[] = paths.map((p) => ({
        id: p,
        path: p,
        name: p.split(/[/\\]/).pop() || p,
        size: Math.floor(Math.random() * 50000000) + 500000,
        isDirectory: true,
      }));
      addShredTargetItems(items);
      addLog('warn', `Added ${items.length} directory/directories to secure shredder queue`);
    }
  };

  const calculateTotalSize = () => {
    return shredTargetItems.reduce((acc, curr) => acc + curr.size, 0);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleExecuteShred = async () => {
    if (shredTargetItems.length === 0) {
      alert('Please add at least one file or folder to shred.');
      return;
    }
    if (!shredConfirmUnlocked) {
      alert('Please check the safety confirmation lock before shredding.');
      return;
    }

    const taskId = `task-shred-${Date.now()}`;
    setIsOperationActive(true);
    addLog('security', `Executing ${shredAlgorithm} shred sweep on ${shredTargetItems.length} items...`);

    let unlisten: (() => void) | null = null;
    try {
      unlisten = await listenVaultProgress((payload) => {
        if (payload.task_id === taskId) {
          setActiveProgress(payload);
        }
      });

      const totalBytesShredded = await apiShredFiles({
        paths: shredTargetItems.map((i) => i.path),
        algorithm: shredAlgorithm,
        taskId,
      });

      addLog('security', `Successfully executed multi-pass wipe on ${formatBytes(totalBytesShredded)}!`);
      clearShredTargetItems();
      setShredConfirmUnlocked(false);
    } catch (err: any) {
      addLog('error', `Shred operation failed: ${err?.toString()}`);
      alert(`Shred Error: ${err?.toString()}`);
    } finally {
      if (unlisten) unlisten();
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto overflow-y-auto max-h-[calc(100vh-4rem)] select-none">
      {/* Header Banner */}
      <div className="flex items-center justify-between bg-[#0E1017] border border-[#EF4444]/40 p-4 rounded-xl shadow-neon-red">
        <div>
          <h2 className="text-sm font-bold text-[#EF4444] flex items-center space-x-2">
            <Flame className="w-4 h-4 text-[#EF4444]" />
            <span>DoD 5220.22-M Secure Source File Shredder</span>
          </h2>
          <p className="text-xs text-[#94A3B8] font-mono mt-0.5">
            Multi-pass overwrite engine (0x00, 0xFF, Pseudo-Random) + OS descriptor unlinking
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleAddFiles}
            className="px-3 py-1.5 bg-[#161924] hover:bg-[#252B3B] text-[#F8FAFC] rounded-lg text-xs font-mono border border-[#252B3B] flex items-center space-x-1.5 transition"
          >
            <FilePlus className="w-3.5 h-3.5 text-[#EF4444]" />
            <span>Add Files</span>
          </button>
          <button
            onClick={handleAddFolders}
            className="px-3 py-1.5 bg-[#161924] hover:bg-[#252B3B] text-[#F8FAFC] rounded-lg text-xs font-mono border border-[#252B3B] flex items-center space-x-1.5 transition"
          >
            <FolderPlus className="w-3.5 h-3.5 text-[#EF4444]" />
            <span>Add Folder</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Item Queue */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#0E1017] border border-[#252B3B] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono border-b border-[#252B3B] pb-2">
              <span className="text-[#EF4444] font-bold flex items-center space-x-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Destruction Queue ({shredTargetItems.length})</span>
              </span>
              <div className="flex items-center space-x-3">
                <span className="text-[#94A3B8]">
                  Target Bytes: <span className="text-[#F8FAFC] font-bold">{formatBytes(calculateTotalSize())}</span>
                </span>
                {shredTargetItems.length > 0 && (
                  <button
                    onClick={clearShredTargetItems}
                    className="text-[#EF4444] hover:underline flex items-center space-x-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear Queue</span>
                  </button>
                )}
              </div>
            </div>

            {shredTargetItems.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#94A3B8] font-mono space-y-2">
                <Flame className="w-8 h-8 text-[#EF4444]/30 mx-auto" />
                <p>No items added for destruction. Select files or folders to enqueue for DoD 3-pass shredding.</p>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                {shredTargetItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between bg-[#161924] border border-[#EF4444]/20 px-3 py-2 rounded-lg text-xs font-mono hover:border-[#EF4444]/60 transition"
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <Trash2 className="w-4 h-4 text-[#EF4444] shrink-0" />
                      <span className="text-[#F8FAFC] truncate">{item.name}</span>
                      <span className="text-[10px] text-[#94A3B8] truncate">({item.path})</span>
                    </div>
                    <div className="flex items-center space-x-3 shrink-0">
                      <span className="text-[#94A3B8] text-[11px]">{formatBytes(item.size)}</span>
                      <button
                        onClick={() => removeShredTargetItem(item.id)}
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
        </div>

        {/* Right Col: Algorithm & Confirmation Lock */}
        <div className="space-y-5">
          {/* Shredding Algorithm Preset */}
          <div className="bg-[#0E1017] border border-[#252B3B] rounded-xl p-4 space-y-3">
            <label className="text-xs font-semibold text-[#F8FAFC] flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5 text-[#EF4444]" />
              <span>Multi-Pass Overwrite Algorithm</span>
            </label>

            <div className="space-y-2 text-xs font-mono">
              {[
                {
                  id: 'dod_3pass',
                  title: 'DoD 5220.22-M (3-Pass)',
                  desc: 'Pass 1: 0x00, Pass 2: 0xFF, Pass 3: Pseudo-Random',
                  tag: 'Military Recommended',
                },
                {
                  id: 'zero_1pass',
                  title: 'Zero-Fill Overwrite (1-Pass)',
                  desc: 'Pass 1: 0x00 byte fill across entire file block',
                  tag: 'Fast',
                },
                {
                  id: 'gutmann_35pass',
                  title: 'Gutmann Algorithm (35-Pass)',
                  desc: '35 sequential magnetic pattern & pseudo-random passes',
                  tag: 'Paranoid',
                },
              ].map((algo) => (
                <div
                  key={algo.id}
                  onClick={() => setShredAlgorithm(algo.id as any)}
                  className={`p-3 rounded-lg border cursor-pointer transition ${
                    shredAlgorithm === algo.id
                      ? 'bg-[#EF4444]/15 border-[#EF4444] text-[#F8FAFC]'
                      : 'bg-[#161924] border-[#252B3B] text-[#94A3B8] hover:border-[#EF4444]/30'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>{algo.title}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#EF4444]/20 text-[#EF4444]">
                      {algo.tag}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#94A3B8] mt-1">{algo.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Safety Double-Lock Checkbox */}
          <div className="bg-[#0E1017] border border-[#EF4444]/40 rounded-xl p-4 space-y-2">
            <label className="flex items-start space-x-2 text-xs text-[#F8FAFC] cursor-pointer">
              <input
                type="checkbox"
                checked={shredConfirmUnlocked}
                onChange={(e) => setShredConfirmUnlocked(e.target.checked)}
                className="mt-0.5 rounded border-[#252B3B] text-[#EF4444] focus:ring-0 accent-[#EF4444]"
              />
              <span className="font-semibold text-[#EF4444]">
                Safety Lock: I confirm that shredded files are permanently irrecoverable and cannot be restored.
              </span>
            </label>
          </div>

          {/* Execute Button */}
          <button
            onClick={handleExecuteShred}
            disabled={!shredConfirmUnlocked || shredTargetItems.length === 0}
            className={`w-full py-3.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 uppercase tracking-wider transition ${
              shredConfirmUnlocked && shredTargetItems.length > 0
                ? 'btn-cyber-danger cursor-pointer'
                : 'bg-[#161924] text-[#94A3B8] border border-[#252B3B] cursor-not-allowed opacity-50'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>Execute Multi-Pass Shred Sweep</span>
          </button>
        </div>
      </div>
    </div>
  );
};
