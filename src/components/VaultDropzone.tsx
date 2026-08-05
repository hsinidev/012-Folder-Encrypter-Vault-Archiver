import React from 'react';
import { 
  Folder, 
  FileText, 
  FileArchive, 
  Image, 
  Film, 
  Lock, 
  Trash2, 
  UploadCloud
} from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import { FileItem } from '../types/vault';

interface VaultDropzoneProps {
  onDropFiles: (files: FileList | File[]) => void;
}

export const VaultDropzone: React.FC<VaultDropzoneProps> = ({ onDropFiles }) => {
  const { sourceItems, removeSourceItem } = useVaultStore();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onDropFiles(e.dataTransfer.files);
    }
  };

  const getIcon = (item: FileItem) => {
    if (item.isDirectory) return <Folder className="w-4 h-4 text-accent_primary fill-accent_primary/20" />;
    const ext = item.name.split('.').pop()?.toLowerCase();
    if (['vault', 'enc', 'aes', 'fva'].includes(ext || ''))
      return <Lock className="w-4 h-4 text-accent_primary" />;
    if (['zip', '7z', 'rar', 'tar'].includes(ext || ''))
      return <FileArchive className="w-4 h-4 text-accent_secondary" />;
    if (['jpg', 'png', 'gif', 'webp'].includes(ext || ''))
      return <Image className="w-4 h-4 text-warning_amber" />;
    if (['mp4', 'mkv', 'avi'].includes(ext || ''))
      return <Film className="w-4 h-4 text-danger_red" />;
    return <FileText className="w-4 h-4 text-text_secondary" />;
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const totalSize = sourceItems.reduce((acc: number, curr: FileItem) => acc + curr.size, 0);

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="flex-1 bg-bg_primary flex flex-col overflow-hidden relative"
    >
      {sourceItems.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed border-border_color m-6 rounded-xl bg-surface_card/50 transition-all hover:border-accent_primary/50 group cursor-pointer">
          <div className="w-16 h-16 rounded-full bg-surface_card border border-border_color flex items-center justify-center text-accent_primary mb-4 group-hover:scale-110 transition-transform shadow-lg">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-text_primary mb-1">
            DROP TARGET FOLDERS OR FILES HERE
          </h3>
          <p className="text-xs text-text_secondary text-center max-w-sm mb-4">
            Encrypted with Argon2id KDF & AES-256-GCM authenticated chunk streams
          </p>
          <span className="text-[11px] bg-bg_secondary border border-border_color text-accent_secondary font-mono px-3 py-1 rounded-md">
            Drag folders or click 'Add Folder / Files' above
          </span>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Workspace summary bar */}
          <div className="bg-bg_secondary/80 border-b border-border_color px-5 py-2 flex items-center justify-between text-xs font-mono text-text_secondary">
            <span>Payload Items: {sourceItems.length}</span>
            <span className="text-accent_secondary font-bold">Total Size: {formatBytes(totalSize)}</span>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-bg_secondary border-b border-border_color text-text_secondary font-semibold uppercase text-[10px] tracking-wider z-10">
                <tr>
                  <th className="py-2.5 px-4">Item Name</th>
                  <th className="py-2.5 px-4 w-32 text-right">Raw Size</th>
                  <th className="py-2.5 px-4 w-32 text-center">Type</th>
                  <th className="py-2.5 px-4 w-12 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border_color/50 font-mono text-[11px]">
                {sourceItems.map((item: FileItem) => (
                  <tr key={item.id} className="hover:bg-surface_card/80 transition-colors">
                    <td className="py-2 px-4 flex items-center gap-2 font-sans font-medium text-text_primary">
                      {getIcon(item)}
                      <span className="truncate max-w-md">{item.name}</span>
                    </td>

                    <td className="py-2 px-4 text-right text-text_secondary">
                      {formatBytes(item.size)}
                    </td>

                    <td className="py-2 px-4 text-center">
                      <span className="bg-surface_card border border-border_color px-2 py-0.5 rounded text-[10px] text-accent_primary font-bold">
                        {item.isDirectory ? 'Directory' : 'File'}
                      </span>
                    </td>

                    <td className="py-2 px-4 text-center">
                      <button
                        onClick={() => removeSourceItem(item.id)}
                        className="text-text_secondary hover:text-danger_red transition-colors p-1"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
