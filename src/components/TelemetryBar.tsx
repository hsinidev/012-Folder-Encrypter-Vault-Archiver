import React from 'react';
import { Gauge, Clock, HardDrive, Activity } from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';

export const TelemetryBar: React.FC = () => {
  const { activeProgress, isOperationActive } = useVaultStore();

  const status = activeProgress?.stage || (isOperationActive ? 'PROCESSING' : 'IDLE');
  const percentage = activeProgress?.percentage || 0;
  const speed_mb_s = activeProgress?.throughput_mbps || 0;
  const processed_bytes = activeProgress?.processed_bytes || 0;
  const total_bytes = activeProgress?.total_bytes || 0;
  const eta_seconds = activeProgress?.eta_seconds || 0;

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSeconds = (seconds: number) => {
    if (!seconds || seconds <= 0 || seconds === Infinity) return '--:--';
    const sec = Math.floor(seconds);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-bg_secondary border-t border-border_color px-5 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
      {/* Progress & Status */}
      <div className="flex-1 flex items-center gap-3 w-full">
        <div className="flex items-center gap-1.5 min-w-[120px]">
          <Activity className={`w-4 h-4 ${isOperationActive ? 'text-accent_primary animate-spin' : 'text-text_secondary'}`} />
          <span className="font-bold text-text_primary text-[11px] uppercase tracking-wide">
            {status}
          </span>
        </div>

        <div className="flex-1 bg-surface_card border border-border_color h-3 rounded-full overflow-hidden relative">
          <div
            className="bg-gradient-to-r from-accent_primary to-accent_secondary h-full transition-all duration-200"
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>

        <span className="font-mono font-bold text-accent_primary text-xs min-w-[45px] text-right">
          {percentage.toFixed(1)}%
        </span>
      </div>

      {/* Real-time Telemetry Metrics */}
      <div className="flex items-center gap-5 text-text_secondary font-mono text-[11px] shrink-0">
        <div className="flex items-center gap-1.5" title="Active Throughput">
          <Gauge className="w-3.5 h-3.5 text-accent_secondary" />
          <span className="text-text_primary font-bold">
            {speed_mb_s > 0 ? `${speed_mb_s.toFixed(2)} MB/s` : '0.00 MB/s'}
          </span>
        </div>

        <div className="flex items-center gap-1.5" title="Processed Bytes">
          <HardDrive className="w-3.5 h-3.5 text-warning_amber" />
          <span>
            {formatBytes(processed_bytes)} / {formatBytes(total_bytes)}
          </span>
        </div>

        <div className="flex items-center gap-1.5" title="Estimated Time Remaining">
          <Clock className="w-3.5 h-3.5 text-success_emerald" />
          <span>ETA: {formatSeconds(eta_seconds)}</span>
        </div>
      </div>
    </div>
  );
};

