import { useRef, useState, useCallback } from 'react';
import { PanelLeftClose, PanelLeftOpen, Share2, Check, Loader2, FileText, FileDown, Send, IndentIncrease, SeparatorHorizontal } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useSlideStore from '../store/useSlideStore';
import HtmlEditor from './editor/HtmlEditor';
import PreviewContainer from './preview/PreviewContainer';
import ViewportControls from './preview/ViewportControls';
import ExportButton from './export/ExportButton';
import SlideEditor from './slide/SlideEditor';
import PlanningEditor from './planning/PlanningEditor';
import { useExport } from '../hooks/useExport';
import { useDocxExport } from '../hooks/useDocxExport';
import { useDocModify } from '../hooks/useDocModify';
import { generateShareUrl } from '../utils/shareUrl';
import useShareStore from '../store/useShareStore';

export default function MainPanel() {
  const activeFileId = useAppStore((s) => s.activeFileId);
  const files = useAppStore((s) => s.files);
  const iframeRef = useRef(null);
  const { exportPng } = useExport(iframeRef);
  const { exportDocx, isExportingDocx } = useDocxExport();
  const { isModifying, modifyPrompt, setModifyPrompt, handleSubmit: handleDocModify, modifyDocument } = useDocModify();
  const generateSlides = useSlideStore((s) => s.generateSlides);
  const isGenerating = useSlideStore((s) => s.isGenerating);
  const activePresentationId = useSlideStore((s) => s.activePresentationId);
  const isPlanningMode = useAppStore((s) => s.isPlanningMode);
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

  // Planning mode
  if (isPlanningMode) {
    return <PlanningEditor />;
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
          <button
            onClick={exportDocx}
            disabled={isExportingDocx}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              isExportingDocx
                ? 'bg-slate-100 text-slate-400 cursor-wait'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
            title="DOCX 파일로 내보내기"
          >
            {isExportingDocx ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                DOCX 변환 중...
              </>
            ) : (
              <>
                <FileDown className="w-3.5 h-3.5" />
                DOCX 내보내기
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

        {/* Preview + Document modification */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <PreviewContainer iframeRef={iframeRef} />

          {/* Document modification prompt */}
          <div className="px-4 py-3 bg-white border-t border-slate-200 shrink-0">
            <div className="flex items-center gap-1.5 mb-2">
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
                disabled={isModifying}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors ${
                  isModifying
                    ? 'bg-slate-100 text-slate-400 cursor-wait'
                    : 'bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700'
                }`}
                title="불릿 항목의 줄바꿈 시 들여쓰기를 첫 글자 위치에 맞춤"
              >
                <IndentIncrease className="w-3.5 h-3.5" />
                불릿 들여쓰기 정렬
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
                disabled={isModifying}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors ${
                  isModifying
                    ? 'bg-slate-100 text-slate-400 cursor-wait'
                    : 'bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700'
                }`}
                title="표, 이미지, 단락이 페이지 경계에서 잘리지 않도록 CSS 보정"
              >
                <SeparatorHorizontal className="w-3.5 h-3.5" />
                페이지 맞춤
              </button>
            </div>
            <div className="flex items-end gap-3">
              <textarea
                value={modifyPrompt}
                onChange={(e) => setModifyPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleDocModify();
                  }
                }}
                placeholder="Gemini에게 문서 수정 지시를 입력하세요... (예: 표의 내용을 요약해줘, 제목을 변경해줘)"
                className="flex-1 resize-none rounded-lg bg-slate-50 text-slate-800 text-sm px-4 py-2.5 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-200"
                rows={2}
                disabled={isModifying}
              />
              <button
                onClick={handleDocModify}
                disabled={isModifying || !modifyPrompt.trim()}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors shrink-0 ${
                  isModifying
                    ? 'bg-indigo-300 text-white cursor-wait'
                    : !modifyPrompt.trim()
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
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
                    문서 수정
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
