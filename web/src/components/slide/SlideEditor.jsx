import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Download, Send, History, RotateCcw, ChevronDown, ChevronUp, Layers, X } from 'lucide-react';
import useSlideStore from '../../store/useSlideStore';
import { usePdfExport } from '../../hooks/usePdfExport';

const SLIDE_W = 1280;
const SLIDE_H = 720;

export default function SlideEditor() {
  const slides = useSlideStore((s) => s.slides);
  const slideHistories = useSlideStore((s) => s.slideHistories);
  const currentSlideIndex = useSlideStore((s) => s.currentSlideIndex);
  const activePresentationId = useSlideStore((s) => s.activePresentationId);
  const modifyingSlideIndices = useSlideStore((s) => s.modifyingSlideIndices);
  const isModifyingAll = useSlideStore((s) => s.isModifyingAll);
  const setCurrentSlideIndex = useSlideStore((s) => s.setCurrentSlideIndex);
  const modifySlide = useSlideStore((s) => s.modifySlide);
  const modifyAllSlides = useSlideStore((s) => s.modifyAllSlides);
  const revertSlide = useSlideStore((s) => s.revertSlide);
  const deleteHistoryEntry = useSlideStore((s) => s.deleteHistoryEntry);
  const presentationSnapshots = useSlideStore((s) => s.presentationSnapshots);
  const revertToSnapshot = useSlideStore((s) => s.revertToSnapshot);

  const { exportSlidesToPdf, pdfLoading } = usePdfExport();

  const [modifyPrompt, setModifyPrompt] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [isAllMode, setIsAllMode] = useState(false);
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

  // Fire-and-forget: don't await so user can navigate and submit more modifications
  const handleModify = useCallback(() => {
    if (!modifyPrompt.trim()) return;
    if (isAllMode) {
      modifyAllSlides(modifyPrompt);
    } else {
      modifySlide(currentSlideIndex, modifyPrompt);
    }
    setModifyPrompt('');
  }, [modifyPrompt, currentSlideIndex, modifySlide, modifyAllSlides, isAllMode]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
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
  const currentSlideModifyingEntries = modifyingSlideIndices.filter((m) => m.index === currentSlideIndex);
  const isCurrentSlideModifying = currentSlideModifyingEntries.length > 0;
  const isAnyModifying = isModifyingAll || modifyingSlideIndices.length > 0;
  const isFirst = currentSlideIndex === 0;
  const isLast = currentSlideIndex === slides.length - 1;

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-medium">
              슬라이드 {currentSlideIndex + 1} / {slides.length}
            </span>
            {isCurrentSlideModifying && (
              <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            )}
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
                      : modifyingSlideIndices.some((m) => m.index === i)
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
          {/* Modifying count badge */}
          {isAnyModifying && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-600/20 border border-amber-600/40 rounded-md">
              <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
              <span className="text-xs text-amber-400">
                {isModifyingAll
                  ? '전체 수정 중'
                  : `${new Set(modifyingSlideIndices.map((m) => m.index)).size}개 수정 중`}
              </span>
            </div>
          )}
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

      {/* Slide preview with side navigation arrows */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center min-h-0 p-4 relative">
        {/* Left arrow */}
        {!isFirst && (
          <button
            onClick={() => setCurrentSlideIndex(currentSlideIndex - 1)}
            className="absolute left-2 z-10 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white/70 hover:text-white transition-all"
            style={{ top: '50%', transform: 'translateY(-50%)' }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
          </button>
        )}

        <div
          style={{
            width: SLIDE_W * scale,
            height: SLIDE_H * scale,
          }}
        >
          <iframe
            srcDoc={currentSlide}
            sandbox="allow-same-origin allow-scripts"
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

        {/* Right arrow */}
        {!isLast && (
          <button
            onClick={() => setCurrentSlideIndex(currentSlideIndex + 1)}
            className="absolute right-2 z-10 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white/70 hover:text-white transition-all"
            style={{ top: '50%', transform: 'translateY(-50%)' }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
            </svg>
          </button>
        )}
      </div>

      {/* Currently modifying instructions */}
      {(isCurrentSlideModifying || isModifyingAll) && (
        <div className="px-4 py-2 bg-amber-900/30 border-t border-amber-600/30 shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
            <span className="text-xs font-medium text-amber-400">
              {isModifyingAll ? '전체 슬라이드 수정 중' : `슬라이드 ${currentSlideIndex + 1} 수정 중`}
            </span>
          </div>
          <div className="space-y-1 ml-5.5">
            {isModifyingAll && (
              <div className="text-xs text-amber-300/80 truncate">
                {modifyingSlideIndices.find((m) => m.index === currentSlideIndex)?.instruction || '전체 수정 진행 중...'}
              </div>
            )}
            {currentSlideModifyingEntries.map((m, i) => (
              <div key={i} className="text-xs text-amber-300/80 truncate">
                &quot;{m.instruction}&quot;
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Global snapshot history */}
      {presentationSnapshots.length > 0 && (
        <div className="bg-slate-800 border-t border-slate-700 shrink-0">
          <button
            onClick={() => setSnapshotOpen(!snapshotOpen)}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Layers className="w-3.5 h-3.5" />
            전체 수정 이력 ({presentationSnapshots.length})
            {snapshotOpen ? <ChevronDown className="w-3.5 h-3.5 ml-auto" /> : <ChevronUp className="w-3.5 h-3.5 ml-auto" />}
          </button>
          {snapshotOpen && (
            <div className="max-h-32 overflow-y-auto px-4 pb-2 space-y-1.5">
              {presentationSnapshots.map((snap, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-xs bg-slate-700/50 rounded-lg px-3 py-2"
                >
                  <span className="text-slate-500 shrink-0 pt-0.5">#{i + 1}</span>
                  <span className="flex-1 text-slate-300 break-words">{snap.instruction}</span>
                  <button
                    onClick={() => revertToSnapshot(i)}
                    className="shrink-0 flex items-center gap-1 text-slate-500 hover:text-amber-400 transition-colors"
                    title="이 시점으로 전체 되돌리기"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
                  <button
                    onClick={() => deleteHistoryEntry(currentSlideIndex, i)}
                    className="shrink-0 flex items-center gap-1 text-slate-500 hover:text-red-400 transition-colors"
                    title="이력 삭제"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modification area */}
      <div className="px-4 py-3 bg-slate-800 border-t border-slate-700 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setIsAllMode(false)}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors ${
              !isAllMode
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            현재 슬라이드
          </button>
          <button
            onClick={() => setIsAllMode(true)}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors ${
              isAllMode
                ? 'bg-amber-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3 h-3" />
            전체 슬라이드
          </button>
        </div>
        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={modifyPrompt}
            onChange={(e) => setModifyPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isAllMode
              ? '모든 슬라이드에 적용할 수정 지시를 입력하세요...'
              : '이 슬라이드에 대한 수정 지시를 입력하세요...'}
            className={`flex-1 resize-none rounded-lg bg-slate-700 text-white text-sm px-4 py-2.5 placeholder-slate-500 focus:outline-none focus:ring-2 border ${
              isAllMode
                ? 'focus:ring-amber-500 border-amber-600/50'
                : 'focus:ring-indigo-500 border-slate-600'
            }`}
            rows={2}
            disabled={isModifyingAll}
          />
          <button
            onClick={handleModify}
            disabled={isModifyingAll || !modifyPrompt.trim()}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors shrink-0 ${
              isModifyingAll
                ? 'bg-slate-600 text-slate-400 cursor-wait'
                : !modifyPrompt.trim()
                  ? 'bg-slate-600 text-slate-500 cursor-not-allowed'
                  : isAllMode
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            {isModifyingAll ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                전체 수정 중...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                {isAllMode ? '전체 수정' : '수정'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
