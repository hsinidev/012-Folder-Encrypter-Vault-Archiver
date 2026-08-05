import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, RefreshCw, KeyRound } from 'lucide-react';
import { apiAnalyzePassphrase } from '../services/tauriIpc';
import { PassphraseAnalysis } from '../types/vault';
import { EntropyGauge } from './EntropyGauge';

interface PassphraseStrengthProps {
  value: string;
  onChange: (val: string) => void;
  confirmValue?: string;
  onConfirmChange?: (val: string) => void;
  placeholder?: string;
}

export const PassphraseStrength: React.FC<PassphraseStrengthProps> = ({
  value,
  onChange,
  confirmValue,
  onConfirmChange,
  placeholder = 'Enter Military-Grade Passphrase...',
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [analysis, setAnalysis] = useState<PassphraseAnalysis | null>(null);

  useEffect(() => {
    let active = true;
    apiAnalyzePassphrase(value).then((res) => {
      if (active) setAnalysis(res);
    });
    return () => {
      active = false;
    };
  }, [value]);

  const generatePassphrase = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let result = '';
    const array = new Uint8Array(20);
    crypto.getRandomValues(array);
    for (let i = 0; i < 20; i++) {
      result += chars[array[i] % chars.length];
    }
    onChange(result);
    if (onConfirmChange) onConfirmChange(result);
  };

  const isMismatch = confirmValue !== undefined && value.length > 0 && confirmValue !== value;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-[#F8FAFC] flex items-center space-x-1.5">
          <KeyRound className="w-3.5 h-3.5 text-[#A855F7]" />
          <span>Vault Master Passphrase</span>
        </label>

        <button
          type="button"
          onClick={generatePassphrase}
          className="text-[11px] font-mono text-[#06B6D4] hover:text-[#22D3EE] flex items-center space-x-1 transition"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Generate Secure Passphrase</span>
        </button>
      </div>

      {/* Main Input */}
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-[#161924] border border-[#252B3B] focus:border-[#A855F7] rounded-lg px-3.5 py-2.5 text-xs text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:outline-none focus:ring-1 focus:ring-[#A855F7] font-mono pr-10 transition"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#F8FAFC]"
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {/* Optional Confirm Input */}
      {confirmValue !== undefined && onConfirmChange && (
        <div>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmValue}
            onChange={(e) => onConfirmChange(e.target.value)}
            placeholder="Confirm Passphrase..."
            className={`w-full bg-[#161924] border rounded-lg px-3.5 py-2 text-xs text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:outline-none font-mono transition ${
              isMismatch ? 'border-[#EF4444] focus:ring-1 focus:ring-[#EF4444]' : 'border-[#252B3B] focus:border-[#A855F7]'
            }`}
          />
          {isMismatch && (
            <p className="text-[10px] font-mono text-[#EF4444] mt-1">
              Passphrases do not match!
            </p>
          )}
        </div>
      )}

      {/* Entropy Gauge */}
      {value && <EntropyGauge analysis={analysis} />}
    </div>
  );
};
