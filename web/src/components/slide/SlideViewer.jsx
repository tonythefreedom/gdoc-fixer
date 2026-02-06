import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Loader2, Download, Send } from 'lucide-react';
import useSlideStore from '../../store/useSlideStore';
import { usePdfExport } from '../../hooks/usePdfExport';

const SLIDE_W = 1280;
const SLIDE_H = 720;

export default function SlideViewer() {
  const slides = useSlideStore((s) => s.slides);
  const currentSlideIndex = useSlideStore((s) => s.currentSlideIndex);
  const isViewerOpen = useSlideStore((s) => s.isViewerOpen);
  const modifyingSlideIndex = useSlideStore((s) => s.modifyingSlideIndex);
  const setCurrentSlideIndex = useSlideStore((s) => s.setCurrentSlideIndex);
  const modifySlide = useSlideStore((s) => s.modifySlide);
  const closeViewer = useSlideStore((s) => s.closeViewer);

  const { exportSlidesToPdf, pdfLoading } = usePdfExport();

  const [modifyPrompt, setModifyPrompt] = useState('');
  const containerRef = useRef(null);
  const textareaRef = useRef(null);
  const [scale, setScale] = useState(0.5);

  // Calculate scale from container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isViewerOpen) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const padding = 32;
      const availW = Math.max(100, width - padding * 2);
      const availH = Math.max(100, height - padding * 2);
      setScale(Math.min(availW / SLIDE_W, availH / SLIDE_H, 1));
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [isViewerOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isViewerOpen) return;

    const handleKey = (e) => {
      const isTextarea = document.activeElement?.tagName === 'TEXTAREA';

      if (e.key === 'Escape') {
        closeViewer();
      } else if (e.key === 'ArrowLeft' && !isTextarea) {
        setCurrentSlideIndex(currentSlideIndex - 1);
      } else if (e.key === 'ArrowRight' && !isTextarea) {
        setCurrentSlideIndex(currentSlideIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isViewerOpen, currentSlideIndex, setCurrentSlideIndex, closeViewer]);

  // Clear prompt when switching slides
  useEffect(() => {
    setModifyPrompt('');
  }, [currentSlideIndex]);

  const handleModify = useCallback(async () => {
    if (!modifyPrompt.trim()) return;
    await modifySlide(currentSlideIndex, modifyPrompt);
    setModifyPrompt('');
  }, [modifyPrompt, currentSlideIndex, modifySlide]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleModify();
    }
  }, [handleModify]);

  if (!isViewerOpen || slides.length === 0) return null;

  const currentSlide = slides[currentSlideIndex];
  const isModifying = modifyingSlideIndex === currentSlideIndex;
  const isFirst = currentSlideIndex === 0;
  const isLast = currentSlideIndex === slides.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-slate-800 border-b border-slate-700 shrink-0">
        <div className="text-white text-sm font-medium">
          슬라이드 {currentSlideIndex + 1} / {slides.length}
        </div>
        <div className="flex items-center gap-2">
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
          <button
            onClick={closeViewer}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
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

      {/* Modification area */}
      <div className="px-6 py-3 bg-slate-800 border-t border-slate-700 shrink-0">
        <div className="flex items-end gap-3 max-w-4xl mx-auto">
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

      {/* Navigation */}
      <div className="flex items-center justify-center gap-6 px-6 py-3 bg-slate-800 border-t border-slate-700 shrink-0">
        <button
          onClick={() => setCurrentSlideIndex(currentSlideIndex - 1)}
          disabled={isFirst}
          className={`p-2 rounded-lg transition-colors ${
            isFirst
              ? 'text-slate-600 cursor-not-allowed'
              : 'text-slate-300 hover:text-white hover:bg-slate-700'
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlideIndex(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === currentSlideIndex
                  ? 'bg-indigo-500'
                  : modifyingSlideIndex === i
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-slate-600 hover:bg-slate-400'
              }`}
              title={`슬라이드 ${i + 1}`}
            />
          ))}
        </div>

        <button
          onClick={() => setCurrentSlideIndex(currentSlideIndex + 1)}
          disabled={isLast}
          className={`p-2 rounded-lg transition-colors ${
            isLast
              ? 'text-slate-600 cursor-not-allowed'
              : 'text-slate-300 hover:text-white hover:bg-slate-700'
          }`}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
