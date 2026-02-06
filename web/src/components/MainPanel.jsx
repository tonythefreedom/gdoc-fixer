import { useRef, useState, useCallback } from 'react';
import { PanelLeftClose, PanelLeftOpen, Share2, Check, Loader2, FileText } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useSlideStore from '../store/useSlideStore';
import HtmlEditor from './editor/HtmlEditor';
import PreviewContainer from './preview/PreviewContainer';
import ViewportControls from './preview/ViewportControls';
import ExportButton from './export/ExportButton';
import SlideEditor from './slide/SlideEditor';
import { useExport } from '../hooks/useExport';
import { generateShareUrl } from '../utils/shareUrl';
import useShareStore from '../store/useShareStore';

export default function MainPanel() {
  const activeFileId = useAppStore((s) => s.activeFileId);
  const files = useAppStore((s) => s.files);
  const iframeRef = useRef(null);
  const { exportPng } = useExport(iframeRef);
  const generateSlides = useSlideStore((s) => s.generateSlides);
  const isGenerating = useSlideStore((s) => s.isGenerating);
  const activePresentationId = useSlideStore((s) => s.activePresentationId);
  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [editorWidth, setEditorWidth] = useState(800);

  const addShare = useShareStore((s) => s.addShare);

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
          <button
            onClick={() => setEditorCollapsed(!editorCollapsed)}
            className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title={editorCollapsed ? '에디터 열기' : '에디터 닫기'}
          >
            {editorCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
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
          <ExportButton onExport={exportPng} />
        </div>
      </div>

      {/* Content area: editor + divider + preview */}
      <div className="flex-1 flex min-h-0">
        {/* Editor */}
        {!editorCollapsed && (
          <>
            <div
              className="shrink-0 flex flex-col min-h-0"
              style={{ width: editorWidth }}
            >
              <HtmlEditor />
            </div>

            {/* Draggable divider */}
            <div
              onMouseDown={handleDividerMouseDown}
              className="w-1.5 shrink-0 cursor-col-resize bg-slate-200 hover:bg-indigo-400 active:bg-indigo-500 transition-colors relative group"
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 bg-slate-400 group-hover:bg-white rounded-full" />
            </div>
          </>
        )}

        {/* Preview */}
        <PreviewContainer iframeRef={iframeRef} />
      </div>
    </div>
  );
}
