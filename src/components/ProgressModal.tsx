import React from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Gauge,
  X,
  Lock,
  Unlock,
  Flame,
  Cpu,
} from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';

export const ProgressModal: React.FC = () => {
  const { activeProgress, isOperationActive, setIsOperationActive, setActiveProgress } = useVaultStore();

  if (!isOperationActive || !activeProgress) return null;

  const isComplete = activeProgress.is_complete;
  const isError = !!activeProgress.error;

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleClose = () => {
    setIsOperationActive(false);
    setActiveProgress(null);
  };

  // Icon & Stage Badge
  let Icon = Lock;
  let stageColor = 'text-[#A855F7] border-[#A855F7]/30 bg-[#A855F7]/10';

  if (activeProgress.stage === 'Decrypting' || activeProgress.stage === 'Extracting') {
    Icon = Unlock;
    stageColor = 'text-[#06B6D4] border-[#06B6D4]/30 bg-[#06B6D4]/10';
  } else if (activeProgress.stage === 'Shredding') {
    Icon = Flame;
    stageColor = 'text-[#EF4444] border-[#EF4444]/30 bg-[#EF4444]/10';
  } else if (activeProgress.stage === 'DerivingKey') {
    Icon = Cpu;
    stageColor = 'text-[#F59E0B] border-[#F59E0B]/30 bg-[#F59E0B]/10';
  }

  return (
    <div className="fixed inset-0 bg-[#06070B]/85 backdrop-blur-md flex items-center justify-center z-50 p-4 select-none">
      <div className="bg-[#0E1017] border border-[#252B3B] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-5 p-6 relative">
        {/* Close Button when Complete */}
        {isComplete && (
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 text-[#94A3B8] hover:text-[#F8FAFC]"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Modal Header */}
        <div className="flex items-center space-x-3 border-b border-[#252B3B] pb-4">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${stageColor}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-[#F8FAFC]">Real-Time IPC Telemetry Stream</h3>
              <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${stageColor}`}>
                {activeProgress.stage}
              </span>
            </div>
            <p className="text-xs text-[#94A3B8] font-mono mt-0.5 truncate max-w-sm">
              {activeProgress.current_file}
            </p>
          </div>
        </div>

        {/* Big Percentage & Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between font-mono">
            <span className="text-3xl font-extrabold text-[#F8FAFC]">
              {Math.round(activeProgress.percentage)}%
            </span>
            <span className="text-xs text-[#94A3B8]">
              {formatBytes(activeProgress.processed_bytes)} / {formatBytes(activeProgress.total_bytes)}
            </span>
          </div>

          <div className="w-full bg-[#161924] h-3 rounded-full overflow-hidden border border-[#252B3B] relative">
            <div
              className={`h-full transition-all duration-200 rounded-full ${
                isComplete
                  ? 'bg-[#10B981]'
                  : isError
                  ? 'bg-[#EF4444]'
                  : 'bg-gradient-to-r from-[#A855F7] to-[#06B6D4]'
              }`}
              style={{ width: `${Math.max(2, activeProgress.percentage)}%` }}
            ></div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 font-mono text-xs">
          <div className="bg-[#161924] border border-[#252B3B] p-2.5 rounded-xl">
            <div className="text-[10px] text-[#94A3B8] flex items-center space-x-1">
              <Gauge className="w-3 h-3 text-[#06B6D4]" />
              <span>Speedometer</span>
            </div>
            <div className="text-[#06B6D4] font-bold mt-1 text-sm">
              {activeProgress.throughput_mbps.toFixed(1)} <span className="text-[10px]">MB/s</span>
            </div>
          </div>

          <div className="bg-[#161924] border border-[#252B3B] p-2.5 rounded-xl">
            <div className="text-[10px] text-[#94A3B8] flex items-center space-x-1">
              <Clock className="w-3 h-3 text-[#A855F7]" />
              <span>Elapsed</span>
            </div>
            <div className="text-[#A855F7] font-bold mt-1 text-sm">
              {(activeProgress.elapsed_ms / 1000).toFixed(1)} <span className="text-[10px]">s</span>
            </div>
          </div>

          <div className="bg-[#161924] border border-[#252B3B] p-2.5 rounded-xl">
            <div className="text-[10px] text-[#94A3B8] flex items-center space-x-1">
              <Activity className="w-3 h-3 text-[#10B981]" />
              <span>ETA</span>
            </div>
            <div className="text-[#10B981] font-bold mt-1 text-sm">
              {isComplete ? '0s' : `${activeProgress.eta_seconds}s`}
            </div>
          </div>
        </div>

        {/* Completion Action */}
        {isComplete && (
          <button
            onClick={handleClose}
            className="w-full py-3 rounded-xl text-xs font-bold btn-cyber-primary flex items-center justify-center space-x-2 uppercase"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Operation Complete - Dismiss</span>
          </button>
        )}
      </div>
    </div>
  );
};
