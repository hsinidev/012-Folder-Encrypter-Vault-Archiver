import React, { useState, useRef, useEffect } from 'react';
import { Terminal, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';

export const LogDrawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { logs, clearLogs } = useVaultStore();
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen]);

  return (
    <div className="bg-bg_secondary border-t border-border_color">
      {/* Toggle bar */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="px-5 py-1.5 flex items-center justify-between cursor-pointer hover:bg-surface_card/50 transition-colors select-none"
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-text_secondary">
          <Terminal className="w-3.5 h-3.5 text-accent_primary" />
          <span>Security Audit Log ({logs.length} events)</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearLogs();
            }}
            className="text-text_secondary hover:text-danger_red text-[11px] flex items-center gap-1 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
          {isOpen ? <ChevronDown className="w-4 h-4 text-text_secondary" /> : <ChevronUp className="w-4 h-4 text-text_secondary" />}
        </div>
      </div>

      {/* Drawer */}
      {isOpen && (
        <div className="h-32 bg-bg_primary p-3 font-mono text-[11px] text-text_secondary overflow-y-auto border-t border-border_color/40 space-y-1">
          {logs.map((log) => (
            <div key={log.id} className="leading-relaxed hover:text-text_primary transition-colors flex items-center gap-2">
              <span className="text-text_secondary/60 font-mono">[{log.timestamp}]</span>
              <span className={log.level === 'error' ? 'text-danger_red font-semibold' : log.level === 'warn' ? 'text-warning_amber font-semibold' : log.level === 'security' ? 'text-accent_primary font-bold' : log.level === 'success' ? 'text-success_emerald font-semibold' : 'text-accent_secondary font-semibold'}>[{log.level.toUpperCase()}]</span>
              <span className="truncate">{log.message}</span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
};
