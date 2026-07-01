import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { FilePlus, FileUp, Trash2, FileCode, Images, Pencil, Check, X, Presentation, Share2, ExternalLink, Loader2, Sparkles, FolderOpen, Rocket } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useSlideStore from '../store/useSlideStore';
import useShareStore from '../store/useShareStore';
import usePublishStore from '../store/usePublishStore';
import { getShareUrl } from '../utils/shareUrl';

export default function Sidebar() {
  const files = useAppStore((s) => s.files);
  const activeFileId = useAppStore((s) => s.activeFileId);
  const createFile = useAppStore((s) => s.createFile);
  const setActiveFile = useAppStore((s) => s.setActiveFile);
  const deleteFile = useAppStore((s) => s.deleteFile);
  const renameFile = useAppStore((s) => s.renameFile);
  const toggleImagePanel = useAppStore((s) => s.toggleImagePanel);
  const isImagePanelOpen = useAppStore((s) => s.isImagePanelOpen);
  const createHwpFileForRhwpEditor = useAppStore((s) => s.createHwpFileForRhwpEditor);
  const hwpImporting = useAppStore((s) => s.hwpImporting);
  const createFileFromDocx = useAppStore((s) => s.createFileFromDocx);
  const docxImporting = useAppStore((s) => s.docxImporting);
  const startPlanning = useAppStore((s) => s.startPlanning);
  const isPlanningMode = useAppStore((s) => s.isPlanningMode);
  const currentView = useAppStore((s) => s.currentView);
  const setCurrentView = useAppStore((s) => s.setCurrentView);

  const presentations = useSlideStore((s) => s.presentations);
  const activePresentationId = useSlideStore((s) => s.activePresentationId);
  const setActivePresentation = useSlideStore((s) => s.setActivePresentation);
  const clearActivePresentation = useSlideStore((s) => s.clearActivePresentation);
  const deletePresentation = useSlideStore((s) => s.deletePresentation);
  const renamePresentation = useSlideStore((s) => s.renamePresentation);

  const shares = useShareStore((s) => s.shares);
  const removeShare = useShareStore((s) => s.removeShare);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const hwpInputRef = useRef(null);
  const docxInputRef = useRef(null);
  const [editingPresId, setEditingPresId] = useState(null);
  const [editPresName, setEditPresName] = useState('');

  // 사이드바에는 최근 항목 10 개씩만 표시. 나머지는 "컨텐츠" 페이지에서 검색·관리.
  const RECENT_LIMIT = 10;
  const recentFiles = useMemo(() => {
    const list = [...files];
    list.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    return list.slice(0, RECENT_LIMIT);
  }, [files]);
  const recentShares = useMemo(() => {
    const list = [...shares];
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return list.slice(0, RECENT_LIMIT);
  }, [shares]);
  const recentPresentations = useMemo(() => {
    const list = [...presentations];
    list.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    return list.slice(0, RECENT_LIMIT);
  }, [presentations]);

  // 사이드바 리사이즈
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth');
    return saved ? parseInt(saved, 10) : 256;
  });
  const isResizing = useRef(false);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (e) => {
      if (!isResizing.current) return;
      const newWidth = Math.min(Math.max(e.clientX, 180), 500);
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      setSidebarWidth((w) => { localStorage.setItem('sidebarWidth', w); return w; });
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  const handleCreate = () => {
    const name = `document_${Date.now().toString(36)}`;
    createFile(name);
  };

  // File rename handlers
  const handleStartRename = (e, file) => {
    e.stopPropagation();
    setEditingId(file.id);
    setEditName(file.name);
  };

  const handleConfirmRename = (e) => {
    e.stopPropagation();
    if (editName.trim()) {
      renameFile(editingId, editName.trim());
    }
    setEditingId(null);
  };

  const handleCancelRename = (e) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleDelete = (e, fileId) => {
    e.stopPropagation();
    if (confirm('이 파일을 삭제하시겠습니까?')) {
      deleteFile(fileId);
    }
  };

  // Presentation rename handlers
  const handleStartPresRename = (e, pres) => {
    e.stopPropagation();
    setEditingPresId(pres.id);
    setEditPresName(pres.name);
  };

  const handleConfirmPresRename = (e) => {
    e.stopPropagation();
    if (editPresName.trim()) {
      renamePresentation(editingPresId, editPresName.trim());
    }
    setEditingPresId(null);
  };

  const handleCancelPresRename = (e) => {
    e.stopPropagation();
    setEditingPresId(null);
  };

  const handleDeletePres = (e, presId) => {
    e.stopPropagation();
    if (confirm('이 프레젠테이션을 삭제하시겠습니까?')) {
      deletePresentation(presId);
    }
  };

  const cancelPlanning = useAppStore((s) => s.cancelPlanning);

  const handleSelectFile = (fileId) => {
    cancelPlanning();
    clearActivePresentation();
    setActiveFile(fileId);
    // 컨텐츠 페이지에 있을 때 사이드바에서 선택해도 에디터로 전환되도록.
    setCurrentView('editor');
  };

  const handleSelectPresentation = (presId) => {
    cancelPlanning();
    setActiveFile(null);
    setActivePresentation(presId);
    setCurrentView('editor');
  };

  const publishSharedToCommunity = usePublishStore((s) => s.publishSharedToCommunity);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  useEffect(() => {
    let unsub;
    import('../store/useAuthStore').then(({ default: useAuthStore }) => {
      const read = () => setIsSuperAdmin(useAuthStore.getState().userProfile?.role === 'super_admin');
      read();
      unsub = useAuthStore.subscribe(read);
    });
    return () => { if (unsub) unsub(); };
  }, []);
  const handlePublishShare = (e, share) => {
    e.stopPropagation();
    publishSharedToCommunity({ id: share.id, name: share.name });
  };

  const handleCopyShareUrl = (e, shareId) => {
    e.stopPropagation();
    navigator.clipboard.writeText(getShareUrl(shareId));
  };

  const handleOpenShare = (e, shareId) => {
    e.stopPropagation();
    window.open(getShareUrl(shareId), '_blank');
  };

  const handleDeleteShare = (e, shareId) => {
    e.stopPropagation();
    if (confirm('이 공유 링크를 삭제하시겠습니까?')) {
      removeShare(shareId);
    }
  };

  return (
    <div className="bg-slate-900 text-white flex flex-col h-full shrink-0 relative" style={{ width: sidebarWidth }}>
      <div className="p-3 space-y-2">
        <button
          onClick={() => setCurrentView('contents')}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            currentView === 'contents'
              ? 'bg-slate-600 text-white'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
          }`}
          title="생성된 파일과 공유 링크를 한 페이지에서 검색·관리"
        >
          <FolderOpen className="w-4 h-4" />
          컨텐츠
        </button>
        <button
          onClick={() => {
            clearActivePresentation();
            startPlanning();
            setCurrentView('editor');
          }}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isPlanningMode && currentView !== 'contents'
              ? 'bg-emerald-700 text-white'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          {isPlanningMode && currentView !== 'contents' ? '기획안 작성중' : '새 기획안'}
        </button>
        <button
          onClick={handleCreate}
          className="w-full flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
        >
          <FilePlus className="w-4 h-4" />
          새 파일
        </button>
        <button
          onClick={() => hwpInputRef.current?.click()}
          disabled={hwpImporting}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            hwpImporting
              ? 'bg-slate-700 text-slate-400 cursor-wait'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
          }`}
        >
          {hwpImporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              HWP 업로드 중...
            </>
          ) : (
            <>
              <FileUp className="w-4 h-4" />
              HWP 가져오기
            </>
          )}
        </button>
        <input
          ref={hwpInputRef}
          type="file"
          accept=".hwp,.hwpx"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              createHwpFileForRhwpEditor(file);
              e.target.value = '';
            }
          }}
          className="hidden"
        />
        <button
          onClick={() => docxInputRef.current?.click()}
          disabled={docxImporting}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            docxImporting
              ? 'bg-slate-700 text-slate-400 cursor-wait'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
          }`}
        >
          {docxImporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              DOCX 변환 중...
            </>
          ) : (
            <>
              <FileUp className="w-4 h-4" />
              MS Word 가져오기
            </>
          )}
        </button>
        <input
          ref={docxInputRef}
          type="file"
          accept=".docx,.doc"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              createFileFromDocx(file);
              e.target.value = '';
            }
          }}
          className="hidden"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {/* Presentations section */}
        {recentPresentations.length > 0 && (
          <>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider px-2 mb-2">
              Presentations ({recentPresentations.length} / {presentations.length})
            </div>
            {recentPresentations.map((pres) => (
              <div
                key={pres.id}
                className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg mb-0.5 cursor-pointer transition-colors ${
                  activePresentationId === pres.id
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
                onClick={() => handleSelectPresentation(pres.id)}
              >
                <Presentation className="w-4 h-4 shrink-0 text-indigo-400" />
                {editingPresId === pres.id ? (
                  <div className="flex-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      className="flex-1 bg-slate-600 text-white text-xs px-1.5 py-0.5 rounded outline-none"
                      value={editPresName}
                      onChange={(e) => setEditPresName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleConfirmPresRename(e);
                        if (e.key === 'Escape') handleCancelPresRename(e);
                      }}
                      autoFocus
                    />
                    <button onClick={handleConfirmPresRename} className="text-emerald-400 hover:text-emerald-300">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={handleCancelPresRename} className="text-slate-500 hover:text-slate-300">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-xs truncate">{pres.name}</span>
                    <div className="hidden group-hover:flex items-center gap-0.5">
                      <button
                        onClick={(e) => handleStartPresRename(e, pres)}
                        className="p-1 rounded text-slate-500 hover:bg-slate-600 hover:text-slate-300"
                        title="이름 변경"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDeletePres(e, pres.id)}
                        className="p-1 rounded text-slate-500 hover:bg-slate-600 hover:text-red-400"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            <div className="my-2" />
          </>
        )}

        {/* Files section — 최근 작업한 10 개만 노출 */}
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">
            Recent Files ({recentFiles.length}{files.length > RECENT_LIMIT ? ` / ${files.length}` : ''})
          </span>
          {files.length > RECENT_LIMIT && (
            <button
              onClick={() => setCurrentView('contents')}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 hover:underline"
              title="전체 파일을 컨텐츠 페이지에서 보기"
            >
              전체 보기 →
            </button>
          )}
        </div>
        {recentFiles.map((file) => (
          <div
            key={file.id}
            className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg mb-0.5 cursor-pointer transition-colors ${
              activeFileId === file.id && !activePresentationId
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            onClick={() => handleSelectFile(file.id)}
          >
            <FileCode className="w-4 h-4 shrink-0 text-slate-500" />
            {editingId === file.id ? (
              <div className="flex-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <input
                  className="flex-1 bg-slate-600 text-white text-xs px-1.5 py-0.5 rounded outline-none"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmRename(e);
                    if (e.key === 'Escape') handleCancelRename(e);
                  }}
                  autoFocus
                />
                <button onClick={handleConfirmRename} className="text-emerald-400 hover:text-emerald-300">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={handleCancelRename} className="text-slate-500 hover:text-slate-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <span className="flex-1 text-xs truncate">{file.name}</span>
                <div className="hidden group-hover:flex items-center gap-0.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleImagePanel(file.id);
                    }}
                    className={`p-1 rounded hover:bg-slate-600 ${
                      activeFileId === file.id && isImagePanelOpen
                        ? 'text-indigo-400'
                        : 'text-slate-500'
                    }`}
                    title="이미지 보기"
                  >
                    <Images className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleStartRename(e, file)}
                    className="p-1 rounded text-slate-500 hover:bg-slate-600 hover:text-slate-300"
                    title="이름 변경"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, file.id)}
                    className="p-1 rounded text-slate-500 hover:bg-slate-600 hover:text-red-400"
                    title="삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {/* Shared section — 최근 10 개만 노출 */}
        {shares.length > 0 && (
          <>
            <div className="my-2" />
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                Recent Shared ({recentShares.length}{shares.length > RECENT_LIMIT ? ` / ${shares.length}` : ''})
              </span>
              {shares.length > RECENT_LIMIT && (
                <button
                  onClick={() => setCurrentView('contents')}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 hover:underline"
                  title="전체 공유 링크를 컨텐츠 페이지에서 보기"
                >
                  전체 보기 →
                </button>
              )}
            </div>
            {recentShares.map((share) => (
              <div
                key={share.id}
                className="group flex items-center gap-2 px-2 py-1.5 rounded-lg mb-0.5 cursor-pointer text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                onClick={(e) => handleCopyShareUrl(e, share.id)}
                title="클릭하여 링크 복사"
              >
                <Share2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span className="flex-1 text-xs truncate">
                  {share.name || new Date(share.createdAt).toLocaleDateString()}
                </span>
                <div className="hidden group-hover:flex items-center gap-0.5">
                  {isSuperAdmin && (
                    <button
                      onClick={(e) => handlePublishShare(e, share)}
                      className="p-1 rounded text-slate-500 hover:bg-indigo-600/40 hover:text-indigo-300"
                      title="연쇄 게시 (tech-blog → 커뮤니티 → LinkedIn)"
                    >
                      <Rocket className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleOpenShare(e, share.id)}
                    className="p-1 rounded text-slate-500 hover:bg-slate-600 hover:text-slate-300"
                    title="새 탭에서 열기"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDeleteShare(e, share.id)}
                    className="p-1 rounded text-slate-500 hover:bg-slate-600 hover:text-red-400"
                    title="삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* 리사이즈 핸들 */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-500/70 transition-colors z-20"
      />
    </div>
  );
}
