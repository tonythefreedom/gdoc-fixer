import { X } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import ThumbnailGrid from './gallery/ThumbnailGrid';

export default function ImagePanel() {
  const isImagePanelOpen = useAppStore((s) => s.isImagePanelOpen);
  const setIsImagePanelOpen = useAppStore((s) => s.setIsImagePanelOpen);
  const activeFileId = useAppStore((s) => s.activeFileId);
  const files = useAppStore((s) => s.files);

  if (!isImagePanelOpen || !activeFileId) return null;

  const activeFile = files.find((f) => f.id === activeFileId);

  return (
    <div className="w-72 bg-white border-l border-slate-200 flex flex-col h-full shrink-0">
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-slate-700">
            내보낸 이미지
          </div>
          {activeFile && (
            <div className="text-[10px] text-slate-400 truncate">
              {activeFile.name}
            </div>
          )}
        </div>
        <button
          onClick={() => setIsImagePanelOpen(false)}
          className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <ThumbnailGrid />
    </div>
  );
}
