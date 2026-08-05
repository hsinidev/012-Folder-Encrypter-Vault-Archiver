import React from 'react';
import { Lock, Unlock, Flame, FileCode2 } from 'lucide-react';
import { useVaultStore, ActiveTab } from '../store/useVaultStore';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab } = useVaultStore();

  const navItems: Array<{ id: ActiveTab; label: string; icon: React.FC<{ className?: string }>; badge?: string; danger?: boolean }> = [
    {
      id: 'encrypt',
      label: 'Encrypt & Pack Vault',
      icon: Lock,
    },
    {
      id: 'decrypt',
      label: 'Unlock & Extract Vault',
      icon: Unlock,
    },
    {
      id: 'shredder',
      label: 'DoD 3-Pass Shredder',
      icon: Flame,
      badge: 'DoD 5220.22-M',
      danger: true,
    },
    {
      id: 'inspector',
      label: 'Format & Audit Log',
      icon: FileCode2,
    },
  ];

  return (
    <aside className="w-64 bg-[#0E1017] border-r border-[#252B3B] flex flex-col justify-between p-4 select-none shrink-0">
      <div className="space-y-2">
        <div className="px-3 py-2 text-[10px] font-mono font-bold tracking-wider text-[#94A3B8] uppercase">
          Vault Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? item.danger
                    ? 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/40 shadow-neon-red font-semibold'
                    : 'bg-[#A855F7]/15 text-[#A855F7] border border-[#A855F7]/40 shadow-neon-purple font-semibold'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#161924]'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? (item.danger ? 'text-[#EF4444]' : 'text-[#A855F7]') : 'text-[#94A3B8]'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                  item.danger ? 'bg-[#EF4444]/20 text-[#EF4444]' : 'bg-[#06B6D4]/20 text-[#06B6D4]'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Security Specification Footer */}
      <div className="bg-[#161924] border border-[#252B3B] rounded-lg p-3 space-y-2 text-[11px] font-mono">
        <div className="text-[#94A3B8] font-semibold flex items-center justify-between">
          <span>Security Spec</span>
          <span className="text-[#10B981]">AES-GCM</span>
        </div>
        <div className="space-y-1 text-[#94A3B8]/80 text-[10px]">
          <div className="flex justify-between">
            <span>KDF:</span>
            <span className="text-[#F8FAFC]">Argon2id</span>
          </div>
          <div className="flex justify-between">
            <span>Chunks:</span>
            <span className="text-[#F8FAFC]">64 KB Stream</span>
          </div>
          <div className="flex justify-between">
            <span>Shredder:</span>
            <span className="text-[#F8FAFC]">3-Pass Overwrite</span>
          </div>
          <div className="flex justify-between">
            <span>Header:</span>
            <span className="text-[#F8FAFC]">Obfuscated</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
