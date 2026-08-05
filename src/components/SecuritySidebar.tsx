import React, { useState } from 'react';
import { 
  KeyRound, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Cpu, 
  Flame, 
  Lock 
} from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';

export const SecuritySidebar: React.FC = () => {
  const {
    passphrase,
    setPassphrase,
    kdfParams,
    setKdfParams,
    obfuscationLen,
    setObfuscationLen,
    shredSourceAfterEncrypt,
    setShredSourceAfterEncrypt,
    addLog
  } = useVaultStore();

  const [showPass, setShowPass] = useState(false);

  const getEntropyScore = () => {
    const len = passphrase.length;
    if (!len) return { score: 0, label: 'WEAK' };
    const score = Math.min(100, Math.round(len * 5.2));
    let label = 'WEAK';
    if (score >= 85) label = 'MILITARY_GRADE';
    else if (score >= 65) label = 'STRONG';
    else if (score >= 40) label = 'FAIR';
    return { score, label };
  };

  const entropy = getEntropyScore();

  const getScoreBadgeColor = (label: string) => {
    switch (label) {
      case 'MILITARY_GRADE': return 'bg-accent_primary text-bg_primary border-accent_primary';
      case 'STRONG': return 'bg-success_emerald/20 text-success_emerald border-success_emerald';
      case 'FAIR': return 'bg-warning_amber/20 text-warning_amber border-warning_amber';
      default: return 'bg-danger_red/20 text-danger_red border-danger_red';
    }
  };

  return (
    <aside className="w-80 bg-bg_secondary border-l border-border_color p-4 flex flex-col justify-between overflow-y-auto">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-2 pb-2 border-b border-border_color">
          <KeyRound className="w-4 h-4 text-accent_primary" />
          <h2 className="font-bold text-xs uppercase tracking-wider text-text_primary">
            Argon2id & Security Controls
          </h2>
        </div>

        {/* Passphrase Entry */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-text_primary flex items-center justify-between">
            <span>Vault Passphrase</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getScoreBadgeColor(entropy.label)}`}>
              {entropy.label}
            </span>
          </label>

          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              placeholder="Enter master passphrase..."
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="w-full bg-surface_card border border-border_color text-text_primary font-mono text-xs rounded-md pl-3 pr-10 py-2 focus:outline-none focus:border-accent_primary"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text_secondary hover:text-text_primary"
            >
              {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Entropy Gauge Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-text_secondary font-mono">
              <span>Entropy Strength</span>
              <span>{entropy.score} / 100</span>
            </div>
            <div className="bg-surface_card h-1.5 rounded-full overflow-hidden border border-border_color">
              <div
                className={`h-full transition-all duration-300 ${
                  entropy.score >= 85 ? 'bg-accent_primary' :
                  entropy.score >= 65 ? 'bg-success_emerald' :
                  entropy.score >= 40 ? 'bg-warning_amber' : 'bg-danger_red'
                }`}
                style={{ width: `${entropy.score}%` }}
              />
            </div>
          </div>
        </div>

        {/* Argon2id KDF Settings */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text_primary flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-accent_secondary" />
            <span>Argon2id Memory Hardness</span>
          </label>
          <select
            value={kdfParams.m_cost_kb / 1024}
            onChange={(e) => setKdfParams({ m_cost_kb: parseInt(e.target.value) * 1024 })}
            className="w-full bg-surface_card border border-border_color text-text_primary text-xs rounded-md p-2 focus:outline-none focus:border-accent_primary font-mono text-[11px]"
          >
            <option value={64}>64 MB RAM (Standard speed)</option>
            <option value={128}>128 MB RAM (High security - Recommended)</option>
            <option value={256}>256 MB RAM (Extreme GPU resistance)</option>
            <option value={512}>512 MB RAM (Paranoid memory KDF)</option>
          </select>
        </div>

        {/* Header Obfuscation Toggle */}
        <div className="bg-surface_card border border-border_color p-3 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text_primary flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-accent_primary" />
              <span>Header Obfuscation</span>
            </span>
            <input
              type="checkbox"
              checked={obfuscationLen > 0}
              onChange={(e) => {
                const len = e.target.checked ? 256 : 0;
                setObfuscationLen(len);
                addLog('security', `Header Obfuscation ${e.target.checked ? 'ENABLED (256B)' : 'DISABLED'}.`);
              }}
              className="accent-accent_primary rounded cursor-pointer"
            />
          </div>
          <p className="text-[10px] text-text_secondary leading-relaxed">
            Prepends {obfuscationLen || 256}-byte pseudo-random entropy header to anonymize file signatures and prevent magic byte detection.
          </p>
        </div>

        {/* Multi-Pass Source File Shredder Toggle */}
        <div className="bg-surface_card border border-border_color p-3 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text_primary flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-danger_red" />
              <span>DoD 5220.22-M Shredder</span>
            </span>
            <input
              type="checkbox"
              checked={shredSourceAfterEncrypt}
              onChange={(e) => {
                setShredSourceAfterEncrypt(e.target.checked);
                addLog('security', `Post-encryption source file destruction ${e.target.checked ? 'ENABLED' : 'DISABLED'}.`);
              }}
              className="accent-danger_red rounded cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Security Footer Note */}
      <div className="pt-4 border-t border-border_color text-[10px] text-text_secondary space-y-1">
        <span className="font-bold text-accent_primary block flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" />
          <span>Zero-Knowledge Guarantee</span>
        </span>
        <p>Passphrases & key material zeroed from RAM memory via Rust zeroize traits upon task completion.</p>
      </div>
    </aside>
  );
};

