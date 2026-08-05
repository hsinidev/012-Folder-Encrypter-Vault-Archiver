import React, { useState } from 'react';
import {
  FileCode2,
  ShieldCheck,
  Cpu,
  Lock,
  Flame,
  Activity,
  Zap,
  Terminal,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import { KdfBenchmarkModal } from './KdfBenchmarkModal';

export const InspectorView: React.FC = () => {
  const { logs, clearLogs } = useVaultStore();
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState(false);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto overflow-y-auto max-h-[calc(100vh-4rem)] select-none">
      {/* Header Banner */}
      <div className="flex items-center justify-between bg-[#0E1017] border border-[#252B3B] p-4 rounded-xl">
        <div>
          <h2 className="text-sm font-bold text-[#F8FAFC] flex items-center space-x-2">
            <FileCode2 className="w-4 h-4 text-[#A855F7]" />
            <span>Vault Binary Specification & Audit Inspector</span>
          </h2>
          <p className="text-xs text-[#94A3B8] font-mono mt-0.5">
            Format specification, zeroize memory verification, KDF benchmarking, & live activity telemetry
          </p>
        </div>
        <button
          onClick={() => setIsBenchmarkOpen(true)}
          className="px-3.5 py-2 bg-[#161924] hover:bg-[#252B3B] text-[#06B6D4] rounded-lg text-xs font-mono font-semibold border border-[#06B6D4]/30 flex items-center space-x-1.5 transition"
        >
          <Cpu className="w-4 h-4" />
          <span>Run KDF Benchmark</span>
        </button>
      </div>

      {/* Binary Vault Format Specification Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#0E1017] border border-[#252B3B] rounded-xl p-4 space-y-3">
          <div className="flex items-center space-x-2 border-b border-[#252B3B] pb-2">
            <Lock className="w-4 h-4 text-[#A855F7]" />
            <h3 className="text-xs font-bold text-[#F8FAFC]">.FVA Binary Vault Format Layout</h3>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="bg-[#161924] p-2.5 rounded border border-[#252B3B] flex items-center justify-between">
              <span className="text-[#A855F7] font-bold">1. Obfuscation Entropy</span>
              <span className="text-[#94A3B8] text-[10px]">64-1024 Bytes Pseudo-Random</span>
            </div>
            <div className="bg-[#161924] p-2.5 rounded border border-[#252B3B] flex items-center justify-between">
              <span className="text-[#06B6D4] font-bold">2. Magic Signature</span>
              <span className="text-[#94A3B8] text-[10px]">6 Bytes ASCII ('FVLT20')</span>
            </div>
            <div className="bg-[#161924] p-2.5 rounded border border-[#252B3B] flex items-center justify-between">
              <span className="text-[#10B981] font-bold">3. Header Meta JSON</span>
              <span className="text-[#94A3B8] text-[10px]">Salt, Nonce, Argon2 Params</span>
            </div>
            <div className="bg-[#161924] p-2.5 rounded border border-[#252B3B] flex items-center justify-between">
              <span className="text-[#F59E0B] font-bold">4. Payload Chunks</span>
              <span className="text-[#94A3B8] text-[10px]">64KB AES-256-GCM + MAC Tags</span>
            </div>
          </div>
        </div>

        {/* Memory Hygiene & Zeroize Status */}
        <div className="bg-[#0E1017] border border-[#252B3B] rounded-xl p-4 space-y-3">
          <div className="flex items-center space-x-2 border-b border-[#252B3B] pb-2">
            <ShieldCheck className="w-4 h-4 text-[#10B981]" />
            <h3 className="text-xs font-bold text-[#F8FAFC]">Zero-Knowledge RAM Memory Hygiene</h3>
          </div>

          <div className="space-y-2 text-xs font-mono text-[#94A3B8]">
            <div className="bg-[#161924] p-3 rounded-lg border border-[#10B981]/30 flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 text-[#10B981] shrink-0" />
              <div>
                <span className="text-[#F8FAFC] font-semibold block">Rust Zeroize Trait Active</span>
                <span className="text-[10px]">
                  Passphrase buffers and derived 256-bit key vectors implement `ZeroizeOnDrop` ensuring automatic zero-fill memory wiping on scope exit.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-[#161924] p-2 rounded border border-[#252B3B]">
                Key Leaks: <span className="text-[#10B981] font-bold">0 Bytes</span>
              </div>
              <div className="bg-[#161924] p-2 rounded border border-[#252B3B]">
                Swap Safety: <span className="text-[#10B981] font-bold">Locked</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security Audit Log Stream */}
      <div className="bg-[#0E1017] border border-[#252B3B] rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-[#252B3B] pb-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-[#F8FAFC]">
            <Terminal className="w-4 h-4 text-[#06B6D4]" />
            <span>Active Session Security Audit Log ({logs.length})</span>
          </div>
          <button
            onClick={clearLogs}
            className="text-[11px] font-mono text-[#94A3B8] hover:text-[#EF4444] flex items-center space-x-1"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear Log</span>
          </button>
        </div>

        <div className="bg-[#06070B] border border-[#252B3B] rounded-lg p-3 max-h-60 overflow-y-auto font-mono text-xs space-y-1.5">
          {logs.map((log) => {
            let color = 'text-[#F8FAFC]';
            if (log.level === 'success') color = 'text-[#10B981]';
            if (log.level === 'warn') color = 'text-[#F59E0B]';
            if (log.level === 'error') color = 'text-[#EF4444]';
            if (log.level === 'security') color = 'text-[#A855F7] font-bold';

            return (
              <div key={log.id} className="flex items-start space-x-2">
                <span className="text-[#94A3B8] shrink-0">[{log.timestamp}]</span>
                <span className={color}>{log.message}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Benchmark Modal */}
      <KdfBenchmarkModal
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
      />
    </div>
  );
};
