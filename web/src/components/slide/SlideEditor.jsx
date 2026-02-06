import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Download, Send, History, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import useSlideStore from '../../store/useSlideStore';
import { usePdfExport } from '../../hooks/usePdfExport';

const SLIDE_W = 1280;
const SLIDE_H = 720;

export default function SlideEditor() {
  const slides = useSlideStore((s) => s.slides);
  const slideHistories = useSlideStore((s) => s.slideHistories);
  const currentSlideIndex = useSlideStore((s) => s.currentSlideIndex);
  const activePresentationId = useSlideStore((s) => s.activePresentationId);
  const modifyingSlideIndex = useSlideStore((s) => s.modifyingSlideIndex);
  const setCurrentSlideIndex = useSlideStore((s) => s.setCurrentSlideIndex);
  const modifySlide = useSlideStore((s) => s.modifySlide);
  const revertSlide = useSlideStore((s) => s.revertSlide);

  const { exportSlidesToPdf, pdfLoading } = usePdfExport();

  const [modifyPrompt, setModifyPrompt] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const containerRef = useRef(null);
  const textareaRef = useRef(null);
  const [scale, setScale] = useState(0.5);

  // Calculate scale from container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const padding = 32;
      const availW = Math.max(100, width - padding * 2);
      const availH = Math.max(100, height - padding * 2);
      setScale(Math.min(availW / SLIDE_W, availH / SLIDE_H, 1));
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [activePresentationId]);

  // Keyboard navigation
  useEffect(() => {
    if (!activePresentationId || slides.length === 0) return;

    const handleKey = (e) => {
      const isTextarea = document.activeElement?.tagName === 'TEXTAREA';

      if (e.key === 'ArrowLeft' && !isTextarea) {
        setCurrentSlideIndex(currentSlideIndex - 1);
      } else if (e.key === 'ArrowRight' && !isTextarea) {
        setCurrentSlideIndex(currentSlideIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activePresentationId, slides.length, currentSlideIndex, setCurrentSlideIndex]);

  // Clear prompt and close history when switching slides
  useEffect(() => {
    setModifyPrompt('');
    setHistoryOpen(false);
  }, [currentSlideIndex]);

  const handleModify = useCallback(async () => {
    if (!modifyPrompt.trim()) return;
    await modifySlide(currentSlideIndex, modifyPrompt);
    setModifyPrompt('');
  }, [modifyPrompt, currentSlideIndex, modifySlide]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleModify();
    }
  }, [handleModify]);

  if (!activePresentationId || slides.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-100 text-slate-400 text-sm">
        좌측에서 프레젠테이션을 선택하세요
      </div>
    );
  }

  const currentSlide = slides[currentSlideIndex];
  const currentHistory = slideHistories[currentSlideIndex] || [];
  const isModifying = modifyingSlideIndex === currentSlideIndex;
  const isFirst = currentSlideIndex === 0;
  const isLast = currentSlideIndex === slides.length - 1;

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-4">
          <div className="text-white text-sm font-medium">
            슬라이드 {currentSlideIndex + 1} / {slides.length}
          </div>
          {/* Navigation inline */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentSlideIndex(currentSlideIndex - 1)}
              disabled={isFirst}
              className={`p-1 rounded transition-colors ${
                isFirst
                  ? 'text-slate-600 cursor-not-allowed'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlideIndex(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    i === currentSlideIndex
                      ? 'bg-indigo-500'
                      : modifyingSlideIndex === i
                        ? 'bg-amber-500 animate-pulse'
                        : 'bg-slate-600 hover:bg-slate-400'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => setCurrentSlideIndex(currentSlideIndex + 1)}
              disabled={isLast}
              className={`p-1 rounded transition-colors ${
                isLast
                  ? 'text-slate-600 cursor-not-allowed'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <button
          onClick={() => exportSlidesToPdf(slides)}
          disabled={pdfLoading}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            pdfLoading
              ? 'bg-slate-600 text-slate-400 cursor-wait'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white'
          }`}
        >
          {pdfLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              PDF 변환 중...
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" />
              PDF 내보내기
            </>
          )}
        </button>
      </div>

      {/* Slide preview */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center min-h-0 p-4">
        <div
          style={{
            width: SLIDE_W * scale,
            height: SLIDE_H * scale,
          }}
        >
          <iframe
            srcDoc={currentSlide}
            sandbox="allow-same-origin"
            style={{
              width: SLIDE_W,
              height: SLIDE_H,
              border: 'none',
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              background: '#fff',
              borderRadius: 8 / scale,
            }}
            title={`슬라이드 ${currentSlideIndex + 1}`}
          />
        </div>
      </div>

      {/* Modification history */}
      {currentHistory.length > 0 && (
        <div className="bg-slate-800 border-t border-slate-700 shrink-0">
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            수정 이력 ({currentHistory.length})
            {historyOpen ? <ChevronDown className="w-3.5 h-3.5 ml-auto" /> : <ChevronUp className="w-3.5 h-3.5 ml-auto" />}
          </button>
          {historyOpen && (
            <div className="max-h-40 overflow-y-auto px-4 pb-2 space-y-1.5">
              {currentHistory.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-xs bg-slate-700/50 rounded-lg px-3 py-2"
                >
                  <span className="text-slate-500 shrink-0 pt-0.5">#{i + 1}</span>
                  <span className="flex-1 text-slate-300 break-words">{entry.instruction}</span>
                  <button
                    onClick={() => revertSlide(currentSlideIndex, i)}
                    className="shrink-0 flex items-center gap-1 text-slate-500 hover:text-amber-400 transition-colors"
                    title="이 버전으로 되돌리기"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modification area */}
      <div className="px-4 py-3 bg-slate-800 border-t border-slate-700 shrink-0">
        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={modifyPrompt}
            onChange={(e) => setModifyPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="이 슬라이드에 대한 수정 지시를 입력하세요... (Ctrl+Enter로 전송)"
            className="flex-1 resize-none rounded-lg bg-slate-700 text-white text-sm px-4 py-2.5 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-600"
            rows={2}
            disabled={isModifying}
          />
          <button
            onClick={handleModify}
            disabled={isModifying || !modifyPrompt.trim()}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors shrink-0 ${
              isModifying
                ? 'bg-slate-600 text-slate-400 cursor-wait'
                : !modifyPrompt.trim()
                  ? 'bg-slate-600 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            {isModifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                수정 중...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                수정
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
