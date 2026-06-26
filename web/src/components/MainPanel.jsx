import { useRef, useState, useCallback, useEffect } from 'react';
import { Share2, Check, Loader2, FileText, FileDown, FileCode, FileType, Send, IndentIncrease, SeparatorHorizontal, Paperclip, X, AtSign, ChevronDown, Download, Code2, ImagePlus, Globe } from 'lucide-react';
import SlideDesignPicker from './slide/SlideDesignPicker';
import useAppStore from '../store/useAppStore';
import useSlideStore from '../store/useSlideStore';
import useAuthStore from '../store/useAuthStore';
import usePublishStore from '../store/usePublishStore';
import HtmlEditor from './editor/HtmlEditor';
import PreviewContainer from './preview/PreviewContainer';
import ViewportControls from './preview/ViewportControls';
import SlideEditor from './slide/SlideEditor';
import SlideGenerationProgress from './slide/SlideGenerationProgress';
import PlanningEditor from './planning/PlanningEditor';
import AdminUserManagement from './AdminUserManagement';
import PublishModal from './PublishModal';
import { useDocxExport } from '../hooks/useDocxExport';
import { useDocModify } from '../hooks/useDocModify';
import { generateShareUrl } from '../utils/shareUrl';
import useShareStore from '../store/useShareStore';

export default function MainPanel() {
  const activeFileId = useAppStore((s) => s.activeFileId);
  const files = useAppStore((s) => s.files);
  const iframeRef = useRef(null);
  const { exportDocx, isExportingDocx } = useDocxExport();
  const { isModifying, currentTask, queue, queueCount, modifyPrompt, setModifyPrompt, handleSubmit: handleDocModify, modifyDocument, removeFromQueue } = useDocModify();
  const generateSlides = useSlideStore((s) => s.generateSlides);
  const selectedDesignSystemId = useSlideStore((s) => s.selectedDesignSystemId);
  const setSelectedDesignSystemId = useSlideStore((s) => s.setSelectedDesignSystemId);
  const isGenerating = useSlideStore((s) => s.isGenerating);
  const generationProgress = useSlideStore((s) => s.generationProgress);
  const activePresentationId = useSlideStore((s) => s.activePresentationId);
  const isPlanningMode = useAppStore((s) => s.isPlanningMode);
  const isAdminMode = useAppStore((s) => s.isAdminMode);
  const attachFile = useAppStore((s) => s.attachFile);
  const attachments = useAppStore((s) => s.attachments);
  const detachFile = useAppStore((s) => s.detachFile);
  const fileInputRef = useRef(null);
  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [editorWidth, setEditorWidth] = useState(800);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const exportMenuRef = useRef(null);

  const addShare = useShareStore((s) => s.addShare);
  const isSuperAdmin = useAuthStore((s) => s.userProfile?.role === 'super_admin');
  const openPublishModal = usePublishStore((s) => s.openModal);

  const handleCopyShareLink = async () => {
    const { activeFileContent, activeFileId: fileId, files: allFiles, uid } = useAppStore.getState();
    if (!activeFileContent || sharing || !uid) return;
    setSharing(true);
    try {
      const file = allFiles.find((f) => f.id === fileId);
      const name = file?.name || 'Untitled';
      const url = await generateShareUrl(activeFileContent, uid, name);
      const shareId = url.split('/share/')[1];
      addShare({ id: shareId, name, createdAt: Date.now(), uid });
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Share failed:', err);
      const msg = err?.code === 'permission-denied'
        ? 'Firestore 보안 규칙에서 쓰기가 차단되었습니다.\nFirebase Console > Firestore > Rules에서 shared 컬렉션 쓰기를 허용하세요.'
        : `공유 링크 생성 실패: ${err.message || err}`;
      alert(msg);
    } finally {
      setSharing(false);
    }
  };

  const handleExportHtml = async () => {
    const { activeFileContent, activeFileId: fileId, files: allFiles, uid } = useAppStore.getState();
    if (!activeFileContent) return;
    try {
      const { chargeCoin } = await import('../utils/coin');
      await chargeCoin(uid, 'exportDoc');
    } catch (err) {
      alert(err.message);
      return;
    }
    const file = allFiles.find((f) => f.id === fileId);
    const name = (file?.name || 'document').replace(/\.[^.]+$/, '');
    const fullHtml = `<!DOCTYPE html>\n<html lang="ko">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>${name}</title>\n</head>\n<body>\n${activeFileContent}\n</body>\n</html>`;
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    if (isExportingPdf) return;
    try {
      const { chargeCoin } = await import('../utils/coin');
      await chargeCoin(useAppStore.getState().uid, 'exportDoc');
    } catch (err) {
      alert(err.message);
      return;
    }
    setIsExportingPdf(true);
    setExportMenuOpen(false);
    try {
      const iframeDoc = iframeRef.current?.contentDocument;
      if (!iframeDoc?.body) throw new Error('Preview iframe not accessible');

      const { viewportWidth } = useAppStore.getState();
      const { toCanvas } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');

      // Inject temporary style to hide scrollbars and remove fixed heights
      const pdfStyle = iframeDoc.createElement('style');
      pdfStyle.textContent = `
        * {
          overflow: visible !important;
          overflow-x: visible !important;
          overflow-y: visible !important;
          max-height: none !important;
        }
        ::-webkit-scrollbar { display: none !important; }
        html, body {
          overflow: visible !important;
          height: auto !important;
          max-height: none !important;
        }
      `;
      iframeDoc.head.appendChild(pdfStyle);

      // Also remove inline height constraints on table wrappers
      const fixedHeightEls = iframeDoc.querySelectorAll('[style*="height"]');
      const heightRestoreFns = [];
      fixedHeightEls.forEach((el) => {
        const orig = el.style.cssText;
        if (el.style.height && el.style.height !== 'auto') {
          el.style.height = 'auto';
          el.style.maxHeight = 'none';
          el.style.overflow = 'visible';
          heightRestoreFns.push(() => { el.style.cssText = orig; });
        }
      });

      // 전략:
      // (1) documentElement 전체를 캡처 (외곽 배경/패딩만 reset). 자손 overflow
      //     까지 한 픽셀도 안 잘림.
      // (2) wrapper 영역의 viewport 좌표(좌·우·아래) 를 자손 boundingRect 까지
      //     훑어 산출.
      // (3) PDF 슬라이스 단계에서 wrapper 영역만 잘라 contentW 에 fit-to-width.
      //     → 가운데 정렬(자동) + 페이지 폭 100% + 자손 overflow 까지 포함.
      const origBodyCss = iframeDoc.body.style.cssText;
      iframeDoc.body.style.setProperty('background', '#ffffff', 'important');
      iframeDoc.body.style.setProperty('padding', '0', 'important');
      iframeDoc.body.style.setProperty('margin', '0', 'important');

      // wrapper 영역 결정: body 의 단일 자식이 있으면 그것, 없으면 body.
      const meaningfulChildren = Array.from(iframeDoc.body.children).filter(
        (el) => !['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT', 'META'].includes(el.tagName)
      );
      const wrapperEl =
        meaningfulChildren.length === 1 ? meaningfulChildren[0] : iframeDoc.body;

      const wRect = wrapperEl.getBoundingClientRect();
      let wMinLeft = wRect.left;
      let wMaxRight = wRect.right;
      let wMaxBottom = wRect.bottom;
      wrapperEl.querySelectorAll('*').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.left < wMinLeft) wMinLeft = r.left;
        if (r.right > wMaxRight) wMaxRight = r.right;
        if (r.bottom > wMaxBottom) wMaxBottom = r.bottom;
      });
      const wrapperLeft = Math.max(0, Math.floor(wMinLeft));
      const wrapperWidth = Math.max(50, Math.ceil(wMaxRight - wMinLeft));

      // documentElement 전체를 캡처. 폭/높이는 wrapper 범위 + 자손 maxBottom
      // 보다 작지 않도록.
      const captureTarget = iframeDoc.documentElement;
      const docRect = captureTarget.getBoundingClientRect();
      const captureW = Math.max(
        captureTarget.scrollWidth,
        iframeDoc.body.scrollWidth,
        viewportWidth,
        Math.ceil(docRect.right),
        Math.ceil(wMaxRight),
        100
      );
      const captureH = Math.max(
        captureTarget.scrollHeight,
        iframeDoc.body.scrollHeight,
        Math.ceil(wMaxBottom),
        1000
      );

      let canvas;
      try {
        canvas = await toCanvas(captureTarget, {
          width: captureW,
          height: captureH,
          pixelRatio: 2,
          cacheBust: true,
          backgroundColor: '#ffffff',
          imagePlaceholder: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        });
      } finally {
        iframeDoc.body.style.cssText = origBodyCss;
      }

      // Restore original styles
      iframeDoc.head.removeChild(pdfStyle);
      heightRestoreFns.forEach((fn) => fn());

      // CSS px → canvas px 변환비
      const pxRatio = canvas.width / captureW;
      // wrapper 영역의 canvas px 좌표
      const cropX = Math.max(0, Math.round(wrapperLeft * pxRatio));
      const cropW = Math.max(1, Math.min(canvas.width - cropX, Math.round(wrapperWidth * pxRatio)));
      // wrapper 영역의 전체 높이 (CSS px). 자손 maxBottom 까지 포함.
      const wrapperHeightCss = Math.max(
        50,
        Math.ceil(wMaxBottom - wRect.top)
      );

      // A4 dimensions in mm
      const a4W = 210;
      const a4H = 297;
      const margin = 10; // mm
      const contentW = a4W - margin * 2;

      // wrapper 폭이 PDF contentW 전체를 채우게 fit-to-width.
      const scale = contentW / wrapperWidth;

      const pageContentH = a4H - margin * 2;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // wrapper 영역의 시작 Y (CSS px, iframe viewport 좌표계 기준)
      const wrapperTopCss = Math.max(0, Math.floor(wRect.top));

      // 페이지 경계 잘림 방지: 다음 페이지 시작 후보 위치에서 위쪽으로 일정
      // 범위 안의 가장 가까운 "공백 라인"(=거의 흰 픽셀만 있는 가로 라인) 으로
      // 경계를 시프트한다. 텍스트/표 라인 한가운데가 잘리는 현상을 막음.
      const sourceCtx = canvas.getContext('2d', { willReadFrequently: true });
      // wrapper 영역 전체에 대한 픽셀 데이터 한 번에 읽어 캐싱.
      const wrapperPixelTop = Math.max(0, Math.floor(wrapperTopCss * pxRatio));
      const wrapperPixelBottom = Math.min(
        canvas.height,
        Math.ceil((wrapperTopCss + wrapperHeightCss) * pxRatio)
      );
      const fullData = sourceCtx.getImageData(
        cropX,
        wrapperPixelTop,
        cropW,
        wrapperPixelBottom - wrapperPixelTop
      );
      const pxData = fullData.data;
      const isMostlyWhiteLine = (yLocal) => {
        if (yLocal < 0 || yLocal >= fullData.height) return false;
        const rowStart = yLocal * fullData.width * 4;
        let nonWhite = 0;
        const tolerance = Math.max(2, Math.floor(fullData.width * 0.005));
        for (let x = 0; x < fullData.width; x++) {
          const i = rowStart + x * 4;
          if (pxData[i] < 240 || pxData[i + 1] < 240 || pxData[i + 2] < 240) {
            nonWhite++;
            if (nonWhite > tolerance) return false;
          }
        }
        return true;
      };
      // 후보 위치 (전역 canvas px) → 안전한 경계 위치로 시프트
      const findSafeBreak = (canvasY) => {
        const localY = canvasY - wrapperPixelTop;
        const maxBacktrack = Math.min(
          Math.floor(150 * pxRatio), // 최대 150 CSS px 위쪽까지
          Math.max(0, localY - 1)
        );
        for (let dy = 0; dy <= maxBacktrack; dy++) {
          if (isMostlyWhiteLine(localY - dy)) {
            return canvasY - dy;
          }
        }
        return canvasY;
      };

      const wrapperPixelHeight = wrapperPixelBottom - wrapperPixelTop;
      let cursorY = wrapperPixelTop; // 현재 페이지 시작 (전역 canvas px)
      let pageIdx = 0;
      while (cursorY < wrapperPixelBottom) {
        if (pageIdx > 0) pdf.addPage();

        // 페이지 끝 후보 (전역 canvas px)
        const idealEnd = cursorY + (pageContentH / scale) * pxRatio;
        let pageEnd;
        if (idealEnd >= wrapperPixelBottom) {
          pageEnd = wrapperPixelBottom; // 마지막 페이지
        } else {
          pageEnd = findSafeBreak(Math.floor(idealEnd));
          // 최소 진행량 보장 (페이지 무한 분할 방지)
          if (pageEnd <= cursorY + 10) {
            pageEnd = Math.floor(idealEnd);
          }
        }

        const cropH = Math.max(1, pageEnd - cursorY);
        const srcH = cropH / pxRatio; // CSS px 단위 페이지 콘텐츠 높이

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = cropW;
        sliceCanvas.height = cropH;
        const ctx = sliceCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(
          canvas,
          cropX, cursorY, cropW, cropH,
          0, 0, sliceCanvas.width, sliceCanvas.height
        );

        pdf.addImage(
          sliceCanvas.toDataURL('image/jpeg', 0.92),
          'JPEG',
          margin, margin, contentW, srcH * scale,
          undefined, 'FAST'
        );

        cursorY = pageEnd;
        pageIdx++;
        // 안전 가드 (최대 200 페이지)
        if (pageIdx > 200) break;
      }
      // wrapperPixelHeight 는 진단 변수, 미사용 시 lint 가 경고하지 않도록 명시적으로 무시.
      void wrapperPixelHeight;

      const { activeFileId: fileId, files: allFiles } = useAppStore.getState();
      const file = allFiles.find((f) => f.id === fileId);
      const name = (file?.name || 'document').replace(/\.[^.]+$/, '');
      pdf.save(`${name}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('PDF 내보내기 실패: ' + (err.message || err));
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Handle clipboard paste for images in document modify textarea
  const handleDocPaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) attachFile(file);
        return;
      }
    }
  }, [attachFile]);

  // Close export dropdown when clicking outside
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

  const handleGenerateSlides = () => {
    const { activeFileContent, activeFileId: fileId } = useAppStore.getState();
    if (!activeFileContent) return;
    const file = files.find((f) => f.id === fileId);
    generateSlides(activeFileContent, fileId, file?.name || 'Untitled');
  };

  const handleDividerMouseDown = useCallback(
    (e) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = editorWidth;

      const onMouseMove = (moveEvent) => {
        const delta = moveEvent.clientX - startX;
        setEditorWidth(Math.max(200, Math.min(1200, startWidth + delta)));
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.querySelectorAll('iframe').forEach((f) => {
          f.style.pointerEvents = '';
        });
      };

      document.querySelectorAll('iframe').forEach((f) => {
        f.style.pointerEvents = 'none';
      });
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [editorWidth]
  );

  // Admin mode
  if (isAdminMode) {
    return <AdminUserManagement />;
  }

  // Planning mode
  if (isPlanningMode) {
    return <PlanningEditor />;
  }

  // Presentation generation progress
  if (generationProgress && generationProgress.phase !== 'complete') {
    return <SlideGenerationProgress />;
  }

  // Presentation mode
  if (activePresentationId) {
    return <SlideEditor />;
  }

  // No file selected
  if (!activeFileId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-100 text-slate-400 text-sm">
        좌측에서 파일을 선택하거나 새 파일을 만드세요
      </div>
    );
  }

  // File editor mode
  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      {/* Top bar: viewport controls + export */}
      <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ViewportControls />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyShareLink}
            disabled={sharing}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              copied
                ? 'bg-emerald-100 text-emerald-700'
                : sharing
                  ? 'bg-slate-100 text-slate-400 cursor-wait'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
            title="HTML 공유 링크 복사"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                복사됨
              </>
            ) : sharing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                생성 중...
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                링크 복사
              </>
            )}
          </button>
          {isSuperAdmin && (
            <button
              onClick={openPublishModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
              title="tony.banya.ai에 게시 (영문 자동 번역)"
            >
              <Globe className="w-3.5 h-3.5" />
              tech-blog 게시
            </button>
          )}
          {/* 디자인 시스템 picker (미리보기 썸네일 모달) */}
          <SlideDesignPicker
            value={selectedDesignSystemId}
            onChange={setSelectedDesignSystemId}
            disabled={isGenerating}
          />
          <button
            onClick={handleGenerateSlides}
            disabled={isGenerating}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              isGenerating
                ? 'bg-slate-100 text-slate-400 cursor-wait'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
            title="HTML을 프레젠테이션 슬라이드로 변환"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                슬라이드 생성 중...
              </>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5" />
                프리젠테이션 변환
              </>
            )}
          </button>
          {/* Export dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              disabled={useAppStore.getState().isExporting || isExportingDocx || isExportingPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
            >
              {(useAppStore.getState().isExporting || isExportingDocx || isExportingPdf) ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  내보내는 중...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  내보내기
                  <ChevronDown className="w-3 h-3" />
                </>
              )}
            </button>
            {exportMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                <button
                  onClick={() => { setExportMenuOpen(false); handleExportPdf(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <FileType className="w-3.5 h-3.5 text-red-500" />
                  PDF 문서
                </button>
                <button
                  onClick={() => { setExportMenuOpen(false); exportDocx(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <FileDown className="w-3.5 h-3.5 text-blue-500" />
                  DOCX 문서
                </button>
                <button
                  onClick={() => { setExportMenuOpen(false); handleExportHtml(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <FileCode className="w-3.5 h-3.5 text-emerald-500" />
                  HTML 파일
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content area: left panel (editor + prompt) | right panel (preview) */}
      <div className="flex-1 flex min-h-0">
        {/* Left panel: Editor + Modification controls */}
        <div
          className="shrink-0 flex flex-col min-h-0 border-r border-slate-200"
          style={{ width: editorWidth }}
        >
          {/* HTML/CSS Editor (collapsible) */}
          {!editorCollapsed && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-end px-3 py-1 bg-slate-50 border-b border-slate-200">
                <button
                  onClick={() => setEditorCollapsed(true)}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                  title="에디터 닫기"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 min-h-0">
                <HtmlEditor />
              </div>
            </div>
          )}

          {/* Document modification controls */}
          <div className={`flex flex-col ${editorCollapsed ? 'flex-1' : ''} border-t border-slate-200 bg-white`}>
            {/* Header with editor toggle */}
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-100">
              {editorCollapsed && (
                <button
                  onClick={() => setEditorCollapsed(false)}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors bg-slate-100 hover:bg-slate-200 text-slate-600"
                  title="에디터 열기"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  Editor
                </button>
              )}
              <button
                onClick={() => modifyDocument(
                  '문서 내 불릿(bullet) 기호(•, -, ▪, ○, □ 등) 또는 번호 매기기 항목의 들여쓰기를 교정하세요.\n' +
                  '규칙:\n' +
                  '1. 불릿 기호와 텍스트 사이 공백 1칸만 유지하세요. 예: "- 텍스트"\n' +
                  '2. 줄바꿈된 다음 줄의 텍스트 시작 위치는 윗줄의 불릿 뒤 첫 글자와 정확히 동일한 수평 위치에 맞추세요.\n' +
                  '   - 예: "- 첫째 줄 텍스트"의 "첫" 위치와 둘째 줄의 첫 글자가 동일 위치\n' +
                  '   - 불릿 기호 너비만큼만 들여쓰기하세요. 추가 여백을 넣지 마세요.\n' +
                  '3. 구현 방법: text-indent에 음수값(-1em 등)을 주고 padding-left에 동일한 양수값(1em 등)을 주어 hanging indent를 구현하되, 불릿 기호의 실제 너비에 맞게 값을 조정하세요.\n' +
                  '   - "-" 기호는 약 0.6em, "•" 기호는 약 0.8em, "1." 같은 번호는 약 1.5em\n' +
                  '4. 하위 항목은 상위 항목보다 한 단계 더 들여쓰기하세요.\n' +
                  '5. 불릿/번호가 아닌 일반 텍스트 단락은 변경하지 마세요.'
                )}
                className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700"
                title="불릿 항목의 줄바꿈 시 들여쓰기를 첫 글자 위치에 맞춤"
              >
                <IndentIncrease className="w-3.5 h-3.5" />
                불릿 정렬
              </button>
              <button
                onClick={() => modifyDocument(
                  '문서의 콘텐츠가 인쇄 또는 뷰포트 페이지 경계에서 잘리지 않도록 페이지 맞춤을 수행하세요.\n' +
                  '규칙:\n' +
                  '1. 표(table)가 페이지 경계에서 중간이 잘리지 않도록 처리:\n' +
                  '   - 짧은 표: style에 page-break-inside: avoid; break-inside: avoid; 추가\n' +
                  '   - 긴 표(행이 많은 경우): thead에 display: table-header-group으로 헤더 반복 설정\n' +
                  '2. 이미지/그림(img, figure)이 잘리지 않도록 처리:\n' +
                  '   - page-break-inside: avoid; break-inside: avoid; 추가\n' +
                  '   - max-width: 100%; height: auto; 로 컨테이너 너비 초과 방지\n' +
                  '3. 단락(p, div)의 orphans: 3; widows: 3; 설정으로 최소 3줄 이상 유지\n' +
                  '4. 제목(h1~h6)에 page-break-after: avoid; break-after: avoid; 추가\n' +
                  '5. 고정 높이(height: Npx) 컨테이너가 콘텐츠를 잘라내는 경우:\n' +
                  '   - height → min-height로 변경\n' +
                  '   - overflow: hidden → overflow: visible로 변경\n' +
                  '6. 기존 콘텐츠나 서식은 변경하지 마세요. 레이아웃/페이지 나눔 관련 CSS만 추가하세요.'
                )}
                className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700"
                title="표, 이미지, 단락이 페이지 경계에서 잘리지 않도록 CSS 보정"
              >
                <SeparatorHorizontal className="w-3.5 h-3.5" />
                페이지 맞춤
              </button>
            </div>

            {/* Queue display */}
            {(isModifying || queueCount > 0) && (
              <div className="px-3 py-2 space-y-1 border-b border-slate-100 overflow-y-auto max-h-40">
                {currentTask && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-md text-xs">
                    <Loader2 className="w-3 h-3 animate-spin text-indigo-500 shrink-0" />
                    <span className="text-indigo-700 truncate"><span className="font-medium">수정 중:</span> {currentTask}</span>
                  </div>
                )}
                {queue.map((task, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-md text-xs">
                    <span className="text-amber-600 font-medium shrink-0">대기 {idx + 1}</span>
                    <span className="text-amber-700 truncate">{task.instruction}</span>
                    <button
                      onClick={() => removeFromQueue(idx)}
                      className="ml-auto p-0.5 rounded hover:bg-amber-200 text-amber-400 hover:text-amber-700 transition-colors shrink-0"
                      title="대기열에서 제거"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Attachments (files + images) */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-slate-100">
                {attachments.map((att, idx) =>
                  att.type === 'image' ? (
                    <div key={idx} className="relative group">
                      <img
                        src={att.base64.startsWith('data:') ? att.base64 : `data:${att.mimeType};base64,${att.base64}`}
                        alt={att.fileName}
                        className="w-10 h-10 object-cover rounded border border-indigo-200"
                      />
                      <button
                        onClick={() => detachFile(idx)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="제거"
                      >
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                    </div>
                  ) : (
                    <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-md text-xs text-indigo-700">
                      <Paperclip className="w-3 h-3" />
                      <span className="font-medium truncate max-w-[140px]">{att.fileName}</span>
                      {att.type === 'excel' && att.sheetCount && (
                        <span className="text-indigo-400">({att.sheetCount}개 시트)</span>
                      )}
                      <button
                        onClick={() => detachFile(idx)}
                        className="ml-1 p-0.5 rounded hover:bg-indigo-200 text-indigo-400 hover:text-indigo-700 transition-colors"
                        title="첨부 해제"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )
                )}
              </div>
            )}

            {/* Textarea + buttons */}
            <div className="flex-1 flex flex-col p-3 gap-2 min-h-[120px]">
              <textarea
                value={modifyPrompt}
                onChange={(e) => setModifyPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleDocModify();
                  }
                }}
                onPaste={handleDocPaste}
                placeholder="Gemini에게 문서 수정 지시를 입력하세요... (이미지 붙여넣기 가능)"
                className="flex-1 resize-none rounded-lg bg-slate-50 text-slate-800 text-sm px-3 py-2.5 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-200"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex items-center justify-center w-9 h-9 text-sm font-bold rounded-lg transition-colors shrink-0 ${
                    attachments.length > 0
                      ? 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
                  }`}
                  title="파일 첨부 (Excel, 이미지, PDF, 텍스트 등)"
                >
                  <AtSign className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".xlsx,.xlsm,.xls,.png,.jpg,.jpeg,.gif,.webp,.svg,.pdf,.txt,.csv,.json,.xml,.md,.html,.css,.js,.ts,.tsx,.jsx"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files) {
                      for (const file of files) {
                        attachFile(file);
                      }
                      e.target.value = '';
                    }
                  }}
                  className="hidden"
                />
                <button
                  onClick={handleDocModify}
                  disabled={!modifyPrompt.trim()}
                  className={`flex-1 flex items-center justify-center gap-1.5 h-9 text-sm font-medium rounded-lg transition-colors ${
                    !modifyPrompt.trim()
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  {isModifying ? '큐에 추가' : '문서 수정'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Draggable divider */}
        <div
          onMouseDown={handleDividerMouseDown}
          className="w-1.5 shrink-0 cursor-col-resize bg-slate-200 hover:bg-indigo-400 active:bg-indigo-500 transition-colors relative group"
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 bg-slate-400 group-hover:bg-white rounded-full" />
        </div>

        {/* Right panel: Preview */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <PreviewContainer iframeRef={iframeRef} />
        </div>
      </div>
      <PublishModal />
    </div>
  );
}
