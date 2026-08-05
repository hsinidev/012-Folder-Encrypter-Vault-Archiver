import React from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { EncryptView } from './components/EncryptView';
import { DecryptView } from './components/DecryptView';
import { ShredderView } from './components/ShredderView';
import { InspectorView } from './components/InspectorView';
import { ProgressModal } from './components/ProgressModal';
import { useVaultStore } from './store/useVaultStore';

export const App: React.FC = () => {
  const { activeTab } = useVaultStore();

  return (
    <div className="flex flex-col h-screen w-screen bg-[#06070B] text-[#F8FAFC] overflow-hidden">
      {/* Top Application Header */}
      <Header />

      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar />

        {/* Main Workstation View Area */}
        <main className="flex-1 bg-[#06070B] overflow-y-auto relative">
          <div className="cyber-scanlines absolute inset-0 z-0"></div>
          <div className="relative z-10">
            {activeTab === 'encrypt' && <EncryptView />}
            {activeTab === 'decrypt' && <DecryptView />}
            {activeTab === 'shredder' && <ShredderView />}
            {activeTab === 'inspector' && <InspectorView />}
          </div>
        </main>
      </div>

      {/* Global Telemetry Modal */}
      <ProgressModal />
    </div>
  );
};

export default App;
