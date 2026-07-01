import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, Download, FileType, Sparkles, Send, Info, X, FileText } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useSlideStore from '../store/useSlideStore';
import SlideDesignPicker from './slide/SlideDesignPicker';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
  // loadFile timeout 으로 pageCount 폴링 fallback 만 성공한 경우 — worker 가
  // 완전 ready 가 아닐 수 있어 exportHwpx/chat 등 worker 의존 작업은 위험.
  const [partialReady, setPartialReady] = useState(false);
  // rhwp/editor 라이브러리 특성 안내 배너 dismiss 상태 (localStorage 로 유지)
  const [tipsDismissed, setTipsDismissed] = useState(() => {
    try { return localStorage.getItem('rhwpTipsDismissed') === '1'; } catch { return false; }
  });
  const dismissTips = () => {
    setTipsDismissed(true);
    try { localStorage.setItem('rhwpTipsDismissed', '1'); } catch { /* noop */ }
  };

  // 프리젠테이션 변환 — HTML 에디터의 handleGenerateSlides 와 동일 흐름.
  //   HWP → exportHwpx → 단락 텍스트 추출 → 간단 HTML 로 wrap → generateSlides.
  const selectedDesignSystemId = useSlideStore((s) => s.selectedDesignSystemId);
  const isGeneratingSlides = useSlideStore((s) => s.isGenerating);
  const generateSlides = useSlideStore((s) => s.generateSlides);
  const [convertingHwp, setConvertingHwp] = useState(false);

  const handleGenerateSlides = async () => {
    const ed = editorRef.current;
    if (!ed || isGeneratingSlides || convertingHwp) return;
    setConvertingHwp(true);
    try {
      // 1) 현재 HWP 를 HWPX 로 export
      let bytes;
      try {
        bytes = await ed.exportHwpx();
      } catch (exportErr) {
        throw new Error(
          `HWP 에디터가 응답하지 않습니다. 파일을 다시 선택하거나 새로고침 후 다시 시도해주세요. (${exportErr?.message || exportErr})`
        );
      }
      // 2) 단락 텍스트 추출
      const { extractParagraphsFromHwpx } = await import('../utils/hwpxText');
      const paragraphs = await extractParagraphsFromHwpx(bytes);
      // 3) 간단 HTML 로 wrap (제목 + 각 단락 <p>). 빈 단락은 <br>.
      const title = activeFile?.name || 'HWP 문서';
      const bodyHtml = paragraphs
        .map((p) => (p && p.trim() ? `<p>${escapeHtml(p)}</p>` : '<br>'))
        .join('\n');
      const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>${escapeHtml(
        title
      )}</title></head><body><h1>${escapeHtml(title)}</h1>\n${bodyHtml}</body></html>`;
      // 4) HTML 에디터와 동일한 generateSlides 호출
      await generateSlides(html, activeFile?.id || null, title);
    } catch (err) {
      console.error('rhwp → slides failed:', err);
      alert(`프리젠테이션 변환 실패: ${err?.message || err}`);
    } finally {
      setConvertingHwp(false);
    }
  };

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
      setPartialReady(false);
      try {
        const { createEditor } = await import('@rhwp/editor');
        if (cancelled) return;
        editor = await createEditor(hostRef.current);
        editorRef.current = editor;

        const res = await fetch(activeFile.hwpUrl);
        if (!res.ok) throw new Error(`HWP fetch 실패 ${res.status}`);
        const buf = await res.arrayBuffer();

        let loaded;
        let didPartialFallback = false;
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
          didPartialFallback = true;
        }

        if (cancelled) return;
        setPageCount(loaded?.pageCount || 0);
        setPartialReady(didPartialFallback);
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
    let coinCharged = false;
    let uid = null;
    try {
      // 코인 차감 전에 worker 가 살아있는지 확인 — 실패 시 코인 손실 방지.
      // exportHwpx 자체가 worker.postMessage 를 호출하므로 readiness 검증 겸 본
      // 작업 데이터로 사용.
      let currentBytes;
      try {
        currentBytes = await ed.exportHwpx();
      } catch (exportErr) {
        throw new Error(
          `HWP 에디터가 응답하지 않습니다. 파일을 다시 선택하거나 새로고침 후 다시 시도해주세요. (${exportErr?.message || exportErr})`
        );
      }

      uid = useAppStore.getState().uid;
      const { chargeCoin } = await import('../utils/coin');
      await chargeCoin(uid, 'modifyHwpText');
      coinCharged = true;

      setChatStatus('본문 단락 추출…');
      const { extractParagraphsFromHwpx, applyParagraphsToHwpx } = await import('../utils/hwpxText');
      const paragraphs = await extractParagraphsFromHwpx(currentBytes);
      const originalXmls = paragraphs.xmls || [];
      console.log('[hwp] extracted paragraphs:', paragraphs.length, paragraphs.slice(0, 3));
      console.log('[hwp] first originalXml (preview 400 chars):', originalXmls[0]?.slice(0, 400));
      console.log('[hwp] second originalXml (preview 400 chars):', originalXmls[1]?.slice(0, 400));

      setChatStatus('LLM 호출 (단락 수정)…');
      const { modifyHwpText } = await import('../utils/geminiApi');
      const newParagraphs = await modifyHwpText(paragraphs, instruction);
      console.log('[hwp] LLM returned paragraphs:', newParagraphs.length, newParagraphs.slice(0, 3));

      setChatStatus('새 HWPX 빌드…');
      // originalXmls 를 함께 넘겨 단락별 1:1 서식 보존 (제목 스타일 전파 방지).
      const newBytes = await applyParagraphsToHwpx(currentBytes, newParagraphs, originalXmls);
      console.log('[hwp] new HWPX bytes:', newBytes.length);
      // 진단을 위해 새 HWPX 를 다시 export 가능하게 window 에 노출
      try {
        const blob = new Blob([newBytes], { type: 'application/vnd.hancom.hwpx' });
        const url = URL.createObjectURL(blob);
        console.log('[hwp] download generated HWPX:', url, '- 다운로드는 콘솔에서: a=document.createElement("a");a.href="' + url + '";a.download="generated.hwpx";a.click()');
      } catch { /* noop */ }

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
      // 코인 차감했는데 LLM/적용 단계가 실패했다면 환불 — 사용자가 부당하게
      // 잃지 않도록.
      if (coinCharged && uid) {
        try {
          const { refundCoin } = await import('../utils/coin');
          await refundCoin(uid, 'modifyHwpText');
          console.log('[chat] coin refunded due to failure');
        } catch (refundErr) {
          console.error('[chat] refund failed:', refundErr);
        }
      }
      alert(`수정 실패: ${err?.message || err}\n\n차감된 코인이 환불되었으니 다시 시도해주세요.`);
      setChatStatus('');
    } finally {
      setChatBusy(false);
    }
  };

  const handleExport = async () => {
    const ed = editorRef.current;
    if (!ed || exporting) return;
    setExporting(true);
    try {
      const bytes = await ed.exportHwpx();
      const blob = new Blob([bytes], { type: 'application/vnd.hancom.hwpx' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = (activeFile?.name || 'document').replace(/\.(hwp|hwpx)$/i, '');
      a.download = `${baseName}.hwpx`;
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
            {/* 프리젠테이션 변환 — HTML 에디터와 동일 로직 */}
            <SlideDesignPicker
              value={selectedDesignSystemId}
              onChange={(id) => useSlideStore.getState().setSelectedDesignSystemId(id)}
              disabled={status !== 'ready' || isGeneratingSlides || convertingHwp}
            />
            <button
              onClick={handleGenerateSlides}
              disabled={status !== 'ready' || isGeneratingSlides || convertingHwp}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                isGeneratingSlides || convertingHwp
                  ? 'bg-slate-700 text-slate-400 cursor-wait'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title="HWP를 프레젠테이션 슬라이드로 변환"
            >
              {isGeneratingSlides || convertingHwp ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {convertingHwp ? 'HWP 분석 중...' : '슬라이드 생성 중...'}
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5" />
                  프리젠테이션 변환
                </>
              )}
            </button>
            <button
              onClick={() => handleExport('hwpx')}
              disabled={status !== 'ready' || exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="HWPX 로 내보내기"
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              HWPX
            </button>
          </div>
        </div>

        {/* rhwp/editor 0.7.17 라이브러리 특성 안내 (dismissible) */}
        {!tipsDismissed && status === 'ready' && (
          <div className="px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/30 flex items-start gap-3 shrink-0">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 text-[11.5px] text-amber-200/90 leading-relaxed">
              <div className="font-semibold text-amber-300 mb-0.5">
                HWP 뷰어(rhwp) 사용 팁
              </div>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>
                  <strong>표 안 텍스트가 표 밖으로 벗어난 경우</strong> — 해당 셀 안에서
                  스페이스 한 번 입력 후 삭제하면 자동으로 정렬됩니다.
                </li>
                <li>
                  <strong>메뉴 아이콘이 한 번에 안 눌릴 때</strong> — 뷰어 영역을 한 번
                  클릭한 후 다시 시도하거나 두 번 클릭해 주세요.
                </li>
              </ul>
              <div className="mt-1 text-[10.5px] text-amber-200/60">
                rhwp/editor 0.7.17 라이브러리 특성입니다 (layout 재계산이 편집 이벤트에
                의해 트리거되는 lazy 방식).
              </div>
            </div>
            <button
              onClick={dismissTips}
              className="p-1 rounded hover:bg-amber-500/20 text-amber-300 shrink-0"
              title="안내 닫기 (이후 표시 안 함)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

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
