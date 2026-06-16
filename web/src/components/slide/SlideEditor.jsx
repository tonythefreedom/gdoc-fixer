import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Download, Send, History, RotateCcw, ChevronDown, ChevronUp, Layers, X, ImagePlus, Play, Share2, Copy, Check, ExternalLink, AlignLeft } from 'lucide-react';
import SlidePresentMode from './SlidePresentMode';
import useSlideStore from '../../store/useSlideStore';
import { usePdfExport } from '../../hooks/usePdfExport';
import { usePptxExport } from '../../hooks/usePptxExport';
import { patchYoutubeThumbnails } from '../../utils/youtubeThumbnail.js';
import { injectMathJax } from '../../utils/injectMathJax.js';

const SLIDE_W = 1280;
const SLIDE_H = 720;

export default function SlideEditor() {
  const [presentMode, setPresentMode] = useState(false);
  // 공유 링크 생성 모달 상태
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);
  const slides = useSlideStore((s) => s.slides);
  const slideHistories = useSlideStore((s) => s.slideHistories);
  const currentSlideIndex = useSlideStore((s) => s.currentSlideIndex);
  const activePresentationId = useSlideStore((s) => s.activePresentationId);
  const presentations = useSlideStore((s) => s.presentations);
  const modifyingSlideIndices = useSlideStore((s) => s.modifyingSlideIndices);
  const isModifyingAll = useSlideStore((s) => s.isModifyingAll);
  const setCurrentSlideIndex = useSlideStore((s) => s.setCurrentSlideIndex);
  const modifySlide = useSlideStore((s) => s.modifySlide);
  const modifyAllSlides = useSlideStore((s) => s.modifyAllSlides);
  const revertSlide = useSlideStore((s) => s.revertSlide);
  const deleteHistoryEntry = useSlideStore((s) => s.deleteHistoryEntry);
  const presentationSnapshots = useSlideStore((s) => s.presentationSnapshots);
  const revertToSnapshot = useSlideStore((s) => s.revertToSnapshot);

  const insertImageToSlide = useSlideStore((s) => s.insertImageToSlide);
  const { exportSlidesToPdf, pdfLoading } = usePdfExport();
  const { exportSlidesToPptx, pptxLoading } = usePptxExport();

  // 슬라이드 내용이 바뀌면 캐시된 share URL 무효화 (사용자가 다음에 공유 버튼
  // 누르면 최신 내용으로 새 링크 생성됨). slides / activePresentationId 가
  // 이미 선언된 뒤에 위치해야 한다 (const 는 hoist 되지 않아 TDZ 가 발생).
  useEffect(() => {
    setShareUrl(null);
  }, [slides, activePresentationId]);

  const [modifyPrompt, setModifyPrompt] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [isAllMode, setIsAllMode] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [attachedImages, setAttachedImages] = useState([]); // { dataUri, mimeType, name }[]
  const containerRef = useRef(null);
  const textareaRef = useRef(null);
  const imageInputRef = useRef(null);
  const exportMenuRef = useRef(null);
  const [scale, setScale] = useState(0.5);

  // Calculate scale from container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const padding = 16;
      const availW = Math.max(100, width - padding * 2);
      const availH = Math.max(100, height - padding * 2);
      setScale(Math.min(availW / SLIDE_W, availH / SLIDE_H, 1));
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [activePresentationId]);

  // 내보내기 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    if (!exportMenuOpen) return;
    const handleClick = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [exportMenuOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!activePresentationId || slides.length === 0) return;

    const handleKey = (e) => {
      const isTextarea = document.activeElement?.tagName === 'TEXTAREA';
      if (presentMode) return; // PresentMode 가 자체 핸들러를 사용

      if (e.key === 'F5') {
        e.preventDefault();
        setPresentMode(true);
        return;
      }
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

  // Read file as data URI
  const readFileAsDataUri = useCallback((file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }, []);

  // Handle image file attachment
  const handleImageFiles = useCallback(async (files) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    const newImages = await Promise.all(
      imageFiles.map(async (file) => {
        const dataUri = await readFileAsDataUri(file);
        return { dataUri, mimeType: file.type, name: file.name };
      })
    );
    setAttachedImages((prev) => [...prev, ...newImages]);
  }, [readFileAsDataUri]);

  // Handle paste (images from clipboard)
  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      handleImageFiles(imageFiles);
    }
  }, [handleImageFiles]);

  // Fire-and-forget: don't await so user can navigate and submit more modifications
  const handleModify = useCallback(() => {
    if (!modifyPrompt.trim() && attachedImages.length === 0) return;
    const instruction = modifyPrompt.trim() || '첨부된 이미지를 슬라이드에 적절히 배치해주세요.';
    if (isAllMode) {
      modifyAllSlides(instruction);
    } else {
      modifySlide(currentSlideIndex, instruction, attachedImages);
    }
    setModifyPrompt('');
    setAttachedImages([]);
  }, [modifyPrompt, attachedImages, currentSlideIndex, modifySlide, modifyAllSlides, isAllMode]);

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
        <div className="flex items-center gap-2">
        <button
          onClick={() => setPresentMode(true)}
          disabled={!slides.length}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="슬라이드쇼 시작 (F5)"
        >
          <Play className="w-3.5 h-3.5" />
          슬라이드쇼
        </button>
        <button
          onClick={() => {
            if (!slides.length || isModifyingAll) return;
            const instruction = [
              '모든 슬라이드의 bullet / 리스트 정렬을 deck 전체에서 통일하라.',
              '- 모든 슬라이드의 bullet item 좌측 시작 X 좌표를 동일하게 (슬라이드 표준 좌측 padding 기준).',
              '- top-level 마커는 하나로 통일(• 권장). sub-bullet 마커도 하나로 통일(– 또는 ▸).',
              '- 마커와 텍스트 사이 12px 고정 간격. <li> 에 text-indent:-16px; padding-left:28px; 또는 grid 2-column 으로 hanging indent 보장.',
              '- 같은 hierarchy level 의 bullet 은 font-size, font-weight, line-height, color 가 동일.',
              '- bullet 간 vertical gap 12–16px 로 동일.',
              '- 콘텐츠(문구) 자체는 그대로 두고 정렬/스타일만 통일하라.',
              '- 슬라이드 1280×720 viewport 안에 모든 콘텐츠가 들어가도록 유지.',
            ].join('\n');
            modifyAllSlides(instruction);
          }}
          disabled={!slides.length || isModifyingAll}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="전체 슬라이드의 블릿 들여쓰기 / 마커 / 간격을 일괄 정렬"
        >
          <AlignLeft className="w-3.5 h-3.5" />
          블릿 정렬
        </button>
        <button
          onClick={async () => {
            if (shareLoading || !slides.length) return;
            setShareModalOpen(true);
            setShareError(null);
            setShareCopied(false);
            // 이미 생성된 URL 이 있으면 재사용 (모달 재오픈 시 즉시 표시)
            if (shareUrl) return;
            setShareLoading(true);
            try {
              // 동적 import 로 모듈 초기화 사이클 회피
              const [{ generatePresentationShareUrl }, { default: useAuthStore }] = await Promise.all([
                import('../../utils/presentationShareUrl'),
                import('../../store/useAuthStore'),
              ]);
              const user = useAuthStore.getState().user;
              const pres = presentations.find((p) => p.id === activePresentationId);
              const url = await generatePresentationShareUrl(
                slides,
                user?.uid,
                pres?.name || '프리젠테이션'
              );
              setShareUrl(url);
            } catch (err) {
              console.error('Presentation share failed:', err);
              setShareError(err?.message || '공유 링크 생성 실패');
            } finally {
              setShareLoading(false);
            }
          }}
          disabled={!slides.length}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="공유 링크 생성"
        >
          <Share2 className="w-3.5 h-3.5" />
          공유 링크
        </button>
        <div className="relative" ref={exportMenuRef}>
          <button
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            disabled={pdfLoading || pptxLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              pdfLoading || pptxLoading
                ? 'bg-slate-600 text-slate-400 cursor-wait'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            {pdfLoading || pptxLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {pdfLoading ? 'PDF 변환 중...' : 'PPTX 변환 중...'}
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                내보내기
                <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>
          {exportMenuOpen && !pdfLoading && !pptxLoading && (
            <div className="absolute right-0 mt-1 w-44 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 py-1">
              <button
                onClick={() => { setExportMenuOpen(false); exportSlidesToPdf(slides); }}
                className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 transition-colors"
              >
                📄 PDF 내보내기
              </button>
              <button
                onClick={() => {
                  setExportMenuOpen(false);
                  const pres = presentations.find(p => p.id === activePresentationId);
                  exportSlidesToPptx(slides, pres?.name || 'presentation');
                }}
                className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 transition-colors"
              >
                📊 PPTX 내보내기 (편집 가능)
              </button>
            </div>
          )}
        </div>
        </div>
      </div>

      {shareModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShareModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-emerald-500" />
                <h2 className="text-base font-semibold text-slate-800">프리젠테이션 공유 링크</h2>
              </div>
              <button
                onClick={() => setShareModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-5">
              {shareLoading && (
                <div className="flex flex-col items-center py-6">
                  <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-3" />
                  <p className="text-sm text-slate-700 font-medium">공유 링크 생성 중...</p>
                  <p className="text-xs text-slate-500 mt-1">이미지 GCS 업로드 → Firestore 저장</p>
                </div>
              )}
              {!shareLoading && shareError && (
                <div className="text-sm text-red-600 break-words">{shareError}</div>
              )}
              {!shareLoading && !shareError && shareUrl && (
                <>
                  <p className="text-xs text-slate-500 mb-2">
                    링크를 가진 누구나 슬라이드뷰로 볼 수 있습니다. (인증 불필요)
                  </p>
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 break-all font-mono">
                    {shareUrl}
                  </div>
                  <div className="mt-4 flex gap-2 justify-end">
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(shareUrl);
                          setShareCopied(true);
                          setTimeout(() => setShareCopied(false), 2000);
                        } catch (e) { /* clipboard 차단 시 무시 */ }
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      {shareCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      {shareCopied ? '복사됨' : 'URL 복사'}
                    </button>
                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
                    >
                      <ExternalLink className="w-4 h-4" />
                      새 탭에서 열기
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {presentMode && (
        <SlidePresentMode
          slides={slides}
          startIndex={currentSlideIndex}
          onClose={() => setPresentMode(false)}
        />
      )}

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
            srcDoc={`<style>html,body{margin:0;padding:0;overflow:hidden}</style>${injectMathJax(patchYoutubeThumbnails(currentSlide))}`}
            sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
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
        {/* Attached images preview */}
        {attachedImages.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {attachedImages.map((img, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={img.dataUri}
                  alt={img.name || `이미지 ${idx + 1}`}
                  className="w-12 h-12 object-cover rounded border border-slate-600"
                />
                <button
                  onClick={() => setAttachedImages((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="제거"
                >
                  <X className="w-2.5 h-2.5 text-white" />
                </button>
              </div>
            ))}
            <span className="text-xs text-slate-500">{attachedImages.length}개 이미지 첨부</span>
          </div>
        )}
        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={modifyPrompt}
            onChange={(e) => setModifyPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={isAllMode
              ? '모든 슬라이드에 적용할 수정 지시를 입력하세요...'
              : '이 슬라이드에 대한 수정 지시를 입력하세요... (이미지 붙여넣기 가능)'}
            className={`flex-1 resize-none rounded-lg bg-slate-700 text-white text-sm px-4 py-2.5 placeholder-slate-500 focus:outline-none focus:ring-2 border ${
              isAllMode
                ? 'focus:ring-amber-500 border-amber-600/50'
                : 'focus:ring-indigo-500 border-slate-600'
            }`}
            rows={2}
            disabled={isModifyingAll}
          />
          <button
            onClick={() => imageInputRef.current?.click()}
            className={`flex items-center justify-center w-10 py-2.5 rounded-lg transition-colors shrink-0 ${
              attachedImages.length > 0
                ? 'bg-indigo-600/30 text-indigo-400 hover:bg-indigo-600/50'
                : 'bg-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-600'
            }`}
            title="이미지 첨부"
          >
            <ImagePlus className="w-4 h-4" />
          </button>
          <input
            ref={imageInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => {
              if (e.target.files) handleImageFiles(e.target.files);
              e.target.value = '';
            }}
            className="hidden"
          />
          <button
            onClick={handleModify}
            disabled={isModifyingAll || (!modifyPrompt.trim() && attachedImages.length === 0)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors shrink-0 ${
              isModifyingAll
                ? 'bg-slate-600 text-slate-400 cursor-wait'
                : (!modifyPrompt.trim() && attachedImages.length === 0)
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
