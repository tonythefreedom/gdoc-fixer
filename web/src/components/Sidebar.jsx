import { useState } from 'react';
import { FilePlus, Trash2, FileCode, Images, Pencil, Check, X, LogOut, Presentation, Share2, ExternalLink } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useAuthStore from '../store/useAuthStore';
import useSlideStore from '../store/useSlideStore';
import useShareStore from '../store/useShareStore';
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

  const presentations = useSlideStore((s) => s.presentations);
  const activePresentationId = useSlideStore((s) => s.activePresentationId);
  const setActivePresentation = useSlideStore((s) => s.setActivePresentation);
  const clearActivePresentation = useSlideStore((s) => s.clearActivePresentation);
  const deletePresentation = useSlideStore((s) => s.deletePresentation);
  const renamePresentation = useSlideStore((s) => s.renamePresentation);

  const shares = useShareStore((s) => s.shares);
  const removeShare = useShareStore((s) => s.removeShare);

  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editingPresId, setEditingPresId] = useState(null);
  const [editPresName, setEditPresName] = useState('');

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

  const handleSelectFile = (fileId) => {
    clearActivePresentation();
    setActiveFile(fileId);
  };

  const handleSelectPresentation = (presId) => {
    setActiveFile(null);
    setActivePresentation(presId);
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
    <div className="w-64 bg-slate-900 text-white flex flex-col h-full shrink-0">
      <div className="p-4 border-b border-slate-700 flex items-center gap-2.5">
        <img src="/icon.png" alt="Logo" className="w-7 h-7" />
        <div>
          <h1 className="text-sm font-bold text-slate-200 tracking-wide">
            GDoc Fixer
          </h1>
          <p className="text-[10px] text-slate-500 mt-0.5">HTML to PNG Converter</p>
        </div>
      </div>

      <div className="p-3">
        <button
          onClick={handleCreate}
          className="w-full flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
        >
          <FilePlus className="w-4 h-4" />
          새 파일
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {/* Presentations section */}
        {presentations.length > 0 && (
          <>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider px-2 mb-2">
              Presentations ({presentations.length})
            </div>
            {presentations.map((pres) => (
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

        {/* Files section */}
        <div className="text-[10px] text-slate-500 uppercase tracking-wider px-2 mb-2">
          Files ({files.length})
        </div>
        {files.map((file) => (
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

        {/* Shared section */}
        {shares.length > 0 && (
          <>
            <div className="my-2" />
            <div className="text-[10px] text-slate-500 uppercase tracking-wider px-2 mb-2">
              Shared ({shares.length})
            </div>
            {shares.map((share) => (
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

      {/* User profile */}
      {user && (
        <div className="p-3 border-t border-slate-700 flex items-center gap-2">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              className="w-7 h-7 rounded-full shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-slate-600 shrink-0" />
          )}
          <span className="flex-1 text-xs text-slate-300 truncate">
            {user.displayName || user.email}
          </span>
          <button
            onClick={signOut}
            className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
            title="로그아웃"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
