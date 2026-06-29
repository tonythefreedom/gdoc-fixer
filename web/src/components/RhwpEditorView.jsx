import { useEffect, useRef, useState } from 'react';
import { Loader2, Download, FileType, Save, Sparkles } from 'lucide-react';
import useAppStore from '../store/useAppStore';

/**
 * @rhwp/editor (iframe + WASM) 를 임베드해 활성 HWP 파일을 보고/편집/내보내기.
 *
 * 사용자 흐름:
 *   1. activeFile.type === 'hwp' && activeFile.hwpUrl 가 GCS 의 HWP 바이너리
 *   2. RhwpEditorView 가 mount 되면 fetch(hwpUrl) → loadFile() 로 에디터에 띄움
 *   3. 사용자가 그 안에서 편집 → 헤더의 "HWP / HWPX 내보내기" 버튼으로 다운로드
 *
 * NOTE: 텍스트 자동 삽입(LLM 결과 → editor) 은 @rhwp/editor 공개 API 에 아직
 * 없으므로 v1 에서는 사용자가 에디터 안에서 직접 편집한다. LLM 통합은 v2.
 */
export default function RhwpEditorView() {
  const activeFile = useAppStore((s) =>
    s.files.find((f) => f.id === s.activeFileId) || null
  );

  const hostRef = useRef(null);
  const editorRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [error, setError] = useState('');
  const [pageCount, setPageCount] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let editor = null;

    async function bootstrap() {
      if (!activeFile?.hwpUrl) {
        setStatus('error');
        setError('HWP 파일 URL 이 없습니다.');
        return;
      }
      setStatus('loading');
      setError('');
      try {
        const { createEditor } = await import('@rhwp/editor');
        if (cancelled) return;
        editor = await createEditor(hostRef.current);
        editorRef.current = editor;

        const res = await fetch(activeFile.hwpUrl);
        if (!res.ok) throw new Error(`HWP fetch 실패 ${res.status}`);
        const buf = await res.arrayBuffer();
        const loaded = await editor.loadFile(buf, activeFile.name || 'document.hwp');
        if (cancelled) return;
        setPageCount(loaded?.pageCount || 0);
        setStatus('ready');
      } catch (err) {
        console.error('rhwp editor bootstrap failed:', err);
        if (cancelled) return;
        setStatus('error');
        setError(err?.message || 'HWP 에디터 로드 실패');
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
      try {
        editor?.destroy?.();
      } catch { /* noop */ }
      editorRef.current = null;
    };
  }, [activeFile?.id, activeFile?.hwpUrl]);

  const handleExport = async (kind /* 'hwp' | 'hwpx' */) => {
    const ed = editorRef.current;
    if (!ed || exporting) return;
    setExporting(true);
    try {
      const bytes = kind === 'hwpx' ? await ed.exportHwpx() : await ed.exportHwp();
      const mime = kind === 'hwpx' ? 'application/vnd.hancom.hwpx' : 'application/x-hwp';
      const blob = new Blob([bytes], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = (activeFile?.name || 'document').replace(/\.(hwp|hwpx)$/i, '');
      a.download = `${baseName}.${kind}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('rhwp export failed:', err);
      alert(`내보내기 실패: ${err?.message || err}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="flex-1 h-full flex flex-col bg-slate-950 min-h-0">
      {/* 헤더 */}
      <div className="px-6 py-3 bg-slate-900 border-b border-slate-800 flex items-center gap-3 shrink-0">
        <FileType className="w-4 h-4 text-amber-400" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-100 truncate">
            {activeFile?.name || 'HWP 문서'}
          </h2>
          <p className="text-[11px] text-slate-400">
            rhwp 에디터 · {status === 'ready' ? `${pageCount}페이지` : status === 'loading' ? '로드 중…' : status === 'error' ? '에러' : ''}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-slate-400">
            <Sparkles className="w-3 h-3" />
            LLM 자동 삽입은 v2 예정
          </span>
          <button
            onClick={() => handleExport('hwp')}
            disabled={status !== 'ready' || exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="HWP 로 내보내기"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            HWP
          </button>
          <button
            onClick={() => handleExport('hwpx')}
            disabled={status !== 'ready' || exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="HWPX 로 내보내기"
          >
            <Save className="w-3.5 h-3.5" />
            HWPX
          </button>
        </div>
      </div>

      {/* 에디터 호스트 */}
      <div className="flex-1 relative min-h-0 bg-slate-900">
        <div ref={hostRef} className="absolute inset-0" />
        {(status === 'loading' || status === 'idle') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/80 backdrop-blur-sm">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            <p className="text-sm text-slate-300">HWP 에디터 로드 중…</p>
            <p className="text-xs text-slate-500">처음 로드 시 WASM 초기화로 몇 초 걸릴 수 있습니다.</p>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90 backdrop-blur-sm">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
      </div>
    </main>
  );
}
