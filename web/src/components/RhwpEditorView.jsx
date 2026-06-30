import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, Download, FileType, Save, Sparkles, Send } from 'lucide-react';
import useAppStore from '../store/useAppStore';

/**
 * @rhwp/editor (iframe + WASM) 를 임베드해 활성 HWP 파일을 보고/편집/내보내기.
 * 레이아웃은 기존 HTML 에디터와 동일한 좌/우 분할: 좌 = LLM 채팅 입력,
 * 우 = rhwp-studio iframe.
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

  // LLM 채팅 — HWP 본문 단락을 자연어 요청으로 수정
  const [chatPrompt, setChatPrompt] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatStatus, setChatStatus] = useState('');

  // 좌/우 분할 폭 — 기존 HTML 에디터의 editorWidth 와 동일 키로 공유.
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem('rhwpEditorWidth') || '', 10);
    return Number.isFinite(saved) && saved > 0 ? saved : 420;
  });

  const handleDividerMouseDown = useCallback(
    (e) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = leftWidth;
      const onMove = (m) => {
        const delta = m.clientX - startX;
        setLeftWidth(Math.max(260, Math.min(900, startWidth + delta)));
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.querySelectorAll('iframe').forEach((f) => (f.style.pointerEvents = ''));
        try { localStorage.setItem('rhwpEditorWidth', String(leftWidth)); } catch { /* noop */ }
      };
      document.querySelectorAll('iframe').forEach((f) => (f.style.pointerEvents = 'none'));
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [leftWidth]
  );

  useEffect(() => {
    try { localStorage.setItem('rhwpEditorWidth', String(leftWidth)); } catch { /* noop */ }
  }, [leftWidth]);

  // 에디터 부트스트랩
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

        let loaded;
        try {
          loaded = await editor.loadFile(buf, activeFile.name || 'document.hwp');
        } catch (err) {
          if (!/timeout/i.test(err?.message || '')) throw err;
          console.warn('[RhwpEditorView] loadFile timeout — pageCount 폴링으로 복구 시도');
          let pc = 0;
          for (let i = 0; i < 10; i++) {
            if (cancelled) return;
            await new Promise((r) => setTimeout(r, 1500));
            try {
              pc = await editor.pageCount();
              if (pc > 0) break;
            } catch { /* next */ }
          }
          if (pc <= 0) throw err;
          loaded = { pageCount: pc };
        }

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
      try { editor?.destroy?.(); } catch { /* noop */ }
      editorRef.current = null;
    };
  }, [activeFile?.id, activeFile?.hwpUrl]);

  /** LLM 으로 본문 단락 수정 → loadFile 재로드. */
  const handleChatSubmit = async () => {
    const ed = editorRef.current;
    const instruction = chatPrompt.trim();
    if (!ed || !instruction || chatBusy) return;

    setChatBusy(true);
    setChatStatus('현재 문서 export…');
    try {
      const { uid } = useAppStore.getState();
      const { chargeCoin } = await import('../utils/coin');
      await chargeCoin(uid, 'modifyHwpText');

      const currentBytes = await ed.exportHwpx();

      setChatStatus('본문 단락 추출…');
      const { extractParagraphsFromHwpx, applyParagraphsToHwpx } = await import('../utils/hwpxText');
      const paragraphs = await extractParagraphsFromHwpx(currentBytes);

      setChatStatus('LLM 호출 (단락 수정)…');
      const { modifyHwpText } = await import('../utils/geminiApi');
      const newParagraphs = await modifyHwpText(paragraphs, instruction);

      setChatStatus('새 HWPX 빌드…');
      const newBytes = await applyParagraphsToHwpx(currentBytes, newParagraphs);

      setChatStatus('에디터에 재로드…');
      try {
        const loaded = await ed.loadFile(newBytes, activeFile?.name || 'document.hwp');
        setPageCount(loaded?.pageCount || 0);
      } catch (err) {
        if (!/timeout/i.test(err?.message || '')) throw err;
        let pc = 0;
        for (let i = 0; i < 10; i++) {
          await new Promise((r) => setTimeout(r, 1500));
          try {
            pc = await ed.pageCount();
            if (pc > 0) break;
          } catch { /* retry */ }
        }
        if (pc <= 0) throw err;
        setPageCount(pc);
      }

      setChatPrompt('');
      setChatStatus('완료');
      setTimeout(() => setChatStatus(''), 1500);
    } catch (err) {
      console.error('chat modify failed:', err);
      alert(`수정 실패: ${err?.message || err}`);
      setChatStatus('');
    } finally {
      setChatBusy(false);
    }
  };

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
    <main className="flex-1 h-full flex min-h-0 bg-slate-950">
      {/* ── 좌측 — LLM 채팅 패널 ─────────────────────── */}
      <div
        className="shrink-0 flex flex-col min-h-0 bg-slate-900 border-r border-slate-800"
        style={{ width: leftWidth }}
      >
        <div className="px-4 py-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            HWP 본문 LLM 수정
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            수정 지시 입력 → 본문 단락이 자동 갱신됩니다 · 코인 1 소모
          </p>
        </div>

        <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">
          <textarea
            value={chatPrompt}
            onChange={(e) => setChatPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleChatSubmit();
              }
            }}
            placeholder={'예시 지시\n• 결론 단락을 한 줄 더 추가해\n• 표현을 정중한 비즈니스 톤으로 다듬어\n• 전체를 영어로 번역해\n\n(Cmd/Ctrl + Enter 로 전송)'}
            disabled={chatBusy || status !== 'ready'}
            className="flex-1 resize-none rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-400 disabled:opacity-60 min-h-0"
          />

          <button
            onClick={handleChatSubmit}
            disabled={!chatPrompt.trim() || chatBusy || status !== 'ready'}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            title="LLM 으로 HWP 본문 수정 (Cmd+Enter)"
          >
            {chatBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {chatBusy ? '수정 중…' : '적용'}
          </button>

          {chatStatus && (
            <div className="text-[11px] text-slate-400 px-1">
              {chatStatus}
            </div>
          )}
        </div>
      </div>

      {/* ── Divider (drag to resize) ──────────────────── */}
      <div
        onMouseDown={handleDividerMouseDown}
        className="w-1.5 shrink-0 cursor-col-resize bg-slate-800 hover:bg-indigo-500 active:bg-indigo-600 transition-colors"
      />

      {/* ── 우측 — HWP 뷰어 / 에디터 ───────────────────── */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-6 py-3 bg-slate-900 border-b border-slate-800 flex items-center gap-3 shrink-0">
          <FileType className="w-4 h-4 text-amber-400" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-100 truncate">
              {activeFile?.name || 'HWP 문서'}
            </h2>
            <p className="text-[11px] text-slate-400">
              rhwp 에디터 · {status === 'ready'
                ? `${pageCount}페이지`
                : status === 'loading' ? '로드 중…'
                : status === 'error' ? '에러' : ''}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
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
      </div>
    </main>
  );
}
