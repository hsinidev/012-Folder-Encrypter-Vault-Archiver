import React, { useState } from 'react';
import { Cpu, X, Play, Zap, Clock, ShieldCheck } from 'lucide-react';
import { apiBenchmarkKdf } from '../services/tauriIpc';
import { KdfBenchmarkResult } from '../types/vault';

interface KdfBenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KdfBenchmarkModal: React.FC<KdfBenchmarkModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const [mCostMb, setMCostMb] = useState(64);
  const [tCost, setTCost] = useState(3);
  const [pCost, setPCost] = useState(4);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<KdfBenchmarkResult | null>(null);

  const handleRunBenchmark = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await apiBenchmarkKdf(mCostMb, tCost, pCost);
      setResult(res);
    } catch (err: any) {
      alert(`Benchmark Error: ${err?.toString()}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#06070B]/80 backdrop-blur-md flex items-center justify-center z-50 p-4 select-none">
      <div className="bg-[#0E1017] border border-[#252B3B] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-4 p-6 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-[#94A3B8] hover:text-[#F8FAFC]"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 border-b border-[#252B3B] pb-3">
          <div className="w-9 h-9 rounded-lg bg-[#06B6D4]/10 border border-[#06B6D4]/30 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-[#06B6D4]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#F8FAFC]">Argon2id KDF Benchmark Tester</h3>
            <p className="text-xs text-[#94A3B8] font-mono">Measure CPU/Memory key derivation latency on host system</p>
          </div>
        </div>

        {/* Sliders */}
        <div className="space-y-3 text-xs font-mono">
          <div>
            <label className="text-[#94A3B8] flex justify-between">
              <span>RAM Allocation:</span>
              <span className="text-[#06B6D4] font-bold">{mCostMb} MB</span>
            </label>
            <input
              type="range"
              min="16"
              max="256"
              step="16"
              value={mCostMb}
              onChange={(e) => setMCostMb(parseInt(e.target.value))}
              className="w-full accent-[#06B6D4] h-1.5 bg-[#161924] rounded-lg mt-1"
            />
          </div>

          <div>
            <label className="text-[#94A3B8] flex justify-between">
              <span>Time Iterations:</span>
              <span className="text-[#A855F7] font-bold">{tCost} Passes</span>
            </label>
            <input
              type="range"
              min="1"
              max="8"
              value={tCost}
              onChange={(e) => setTCost(parseInt(e.target.value))}
              className="w-full accent-[#A855F7] h-1.5 bg-[#161924] rounded-lg mt-1"
            />
          </div>

          <div>
            <label className="text-[#94A3B8] flex justify-between">
              <span>Worker Threads:</span>
              <span className="text-[#10B981] font-bold">{pCost} Threads</span>
            </label>
            <input
              type="range"
              min="1"
              max="8"
              value={pCost}
              onChange={(e) => setPCost(parseInt(e.target.value))}
              className="w-full accent-[#10B981] h-1.5 bg-[#161924] rounded-lg mt-1"
            />
          </div>
        </div>

        {/* Result Card */}
        {loading ? (
          <div className="bg-[#161924] border border-[#252B3B] p-4 rounded-xl text-center text-xs font-mono text-[#06B6D4] animate-pulse">
            Executing Argon2id memory-hard key derivation benchmark...
          </div>
        ) : result ? (
          <div className="bg-[#161924] border border-[#06B6D4]/40 p-4 rounded-xl space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between text-[#10B981] font-bold">
              <span className="flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Benchmark Complete</span>
              </span>
              <span>{result.duration_ms} ms</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-[#94A3B8]">
              <div>Memory Peak: <span className="text-[#F8FAFC]">{result.memory_allocated_mb} MB</span></div>
              <div>Thread Count: <span className="text-[#F8FAFC]">{result.p_cost} Workers</span></div>
            </div>
          </div>
        ) : null}

        <button
          onClick={handleRunBenchmark}
          disabled={loading}
          className="w-full py-2.5 rounded-xl text-xs font-bold btn-cyber-cyan flex items-center justify-center space-x-2 uppercase"
        >
          <Play className="w-4 h-4" />
          <span>{loading ? 'Running...' : 'Execute Argon2id Benchmark'}</span>
        </button>
      </div>
    </div>
  );
};
