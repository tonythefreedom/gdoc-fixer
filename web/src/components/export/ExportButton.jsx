import { Download, Loader2 } from 'lucide-react';
import useAppStore from '../../store/useAppStore';

export default function ExportButton({ onExport }) {
  const isExporting = useAppStore((s) => s.isExporting);
  const activeFileId = useAppStore((s) => s.activeFileId);

  return (
    <button
      onClick={onExport}
      disabled={isExporting || !activeFileId}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
    >
      {isExporting ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          내보내는 중...
        </>
      ) : (
        <>
          <Download className="w-3.5 h-3.5" />
          PNG 내보내기
        </>
      )}
    </button>
  );
}
