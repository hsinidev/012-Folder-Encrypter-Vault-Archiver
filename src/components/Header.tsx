import React from 'react';
import { Shield, Cpu, Lock, CheckCircle2, Zap } from 'lucide-react';
import { isTauriAvailable } from '../services/tauriIpc';

export const Header: React.FC = () => {
  const tauriActive = isTauriAvailable();

  return (
    <header className="h-16 bg-[#0E1017] border-b border-[#252B3B] px-6 flex items-center justify-between select-none">
      {/* Brand Title */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#A855F7] to-[#06B6D4] p-0.5 shadow-neon-purple">
          <div className="w-full h-full bg-[#06070B] rounded-[7px] flex items-center justify-center">
            <Shield className="w-5 h-5 text-[#A855F7]" />
          </div>
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-bold text-[#F8FAFC] tracking-tight">
              Folder Encrypter & Vault Archiver <span className="text-[#A855F7] text-xs font-mono px-1.5 py-0.5 rounded bg-[#A855F7]/10 border border-[#A855F7]/30">PRO v2.0</span>
            </h1>
          </div>
          <p className="text-xs text-[#94A3B8] font-mono">
            Argon2id KDF • AES-256-GCM Stream • Zeroize RAM Hygiene
          </p>
        </div>
      </div>

      {/* System Status Badges */}
      <div className="flex items-center space-x-4">
        {/* Zeroize Memory Badge */}
        <div className="hidden md:flex items-center space-x-2 bg-[#161924] px-3 py-1.5 rounded-md border border-[#252B3B]">
          <Lock className="w-3.5 h-3.5 text-[#10B981]" />
          <span className="text-xs text-[#94A3B8] font-mono">
            RAM Hygiene: <span className="text-[#10B981] font-semibold">Zeroize Active</span>
          </span>
        </div>

        {/* Engine Profile */}
        <div className="hidden lg:flex items-center space-x-2 bg-[#161924] px-3 py-1.5 rounded-md border border-[#252B3B]">
          <Cpu className="w-3.5 h-3.5 text-[#06B6D4]" />
          <span className="text-xs text-[#94A3B8] font-mono">
            KDF: <span className="text-[#06B6D4] font-semibold">Argon2id (64MB)</span>
          </span>
        </div>

        {/* Tauri Core Native Status */}
        <div className={`flex items-center space-x-1.5 text-xs font-mono px-2.5 py-1 rounded-full border ${
          tauriActive 
            ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30' 
            : 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30'
        }`}>
          <span className={`w-2 h-2 rounded-full ${tauriActive ? 'bg-[#10B981] animate-pulse' : 'bg-[#F59E0B]'}`}></span>
          <span>{tauriActive ? 'Tauri Core Native' : 'Web Sandbox Mock'}</span>
        </div>
      </div>
    </header>
  );
};
