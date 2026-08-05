import React from 'react';
import { PassphraseAnalysis } from '../types/vault';
import { ShieldCheck, ShieldAlert, Zap } from 'lucide-react';

interface EntropyGaugeProps {
  analysis: PassphraseAnalysis | null;
}

export const EntropyGauge: React.FC<EntropyGaugeProps> = ({ analysis }) => {
  if (!analysis) return null;

  const score = analysis.score;
  const bits = analysis.entropy_bits;

  // Determine Gauge Color
  let gaugeColor = 'from-[#EF4444] to-[#F59E0B]';
  let badgeColor = 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/30';
  let label = 'Weak';

  if (score >= 80) {
    gaugeColor = 'from-[#10B981] to-[#06B6D4]';
    badgeColor = 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/30';
    label = 'Military Grade';
  } else if (score >= 50) {
    gaugeColor = 'from-[#F59E0B] to-[#A855F7]';
    badgeColor = 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/30';
    label = 'Strong';
  } else if (score >= 30) {
    gaugeColor = 'from-[#F59E0B] to-[#EF4444]';
    badgeColor = 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/30';
    label = 'Moderate';
  }

  return (
    <div className="bg-[#0E1017] border border-[#252B3B] rounded-lg p-3.5 space-y-3 select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Zap className="w-4 h-4 text-[#A855F7]" />
          <span className="text-xs font-semibold text-[#F8FAFC]">Passphrase Entropy Gauge</span>
        </div>
        <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${badgeColor}`}>
          {label} ({score}/100)
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-[#161924] h-2 rounded-full overflow-hidden border border-[#252B3B] relative">
        <div
          className={`h-full bg-gradient-to-r ${gaugeColor} transition-all duration-300 rounded-full`}
          style={{ width: `${score}%` }}
        ></div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
        <div className="bg-[#161924] p-2 rounded border border-[#252B3B]">
          <span className="text-[#94A3B8] block text-[10px]">Shannon Entropy:</span>
          <span className="text-[#06B6D4] font-bold">{bits} bits</span>
        </div>
        <div className="bg-[#161924] p-2 rounded border border-[#252B3B]">
          <span className="text-[#94A3B8] block text-[10px]">Brute-Force Estimate:</span>
          <span className="text-[#A855F7] font-bold truncate block">{analysis.crack_time_display}</span>
        </div>
      </div>

      {/* Feedback bullets */}
      {analysis.feedback.length > 0 && (
        <div className="space-y-1">
          {analysis.feedback.map((fb, idx) => (
            <div key={idx} className="flex items-center space-x-1.5 text-[10px] text-[#94A3B8]">
              {score >= 70 ? (
                <ShieldCheck className="w-3 h-3 text-[#10B981] shrink-0" />
              ) : (
                <ShieldAlert className="w-3 h-3 text-[#F59E0B] shrink-0" />
              )}
              <span>{fb}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
