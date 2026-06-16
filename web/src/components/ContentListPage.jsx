import { useMemo, useState } from 'react';
import { Search, FileCode, Share2, ExternalLink, Trash2, Copy, Pencil, Check, X, Presentation, Loader2 } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useShareStore from '../store/useShareStore';
import useSlideStore from '../store/useSlideStore';
import { filterAndRank } from '../utils/textSearch';
import { getShareUrl } from '../utils/shareUrl';

function formatDate(ts) {
  if (!ts) return '-';
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ContentListPage() {
  const files = useAppStore((s) => s.files);
  const setActiveFile = useAppStore((s) => s.setActiveFile);
  const deleteFile = useAppStore((s) => s.deleteFile);
  const renameFile = useAppStore((s) => s.renameFile);
  const setCurrentView = useAppStore((s) => s.setCurrentView);

  const shares = useShareStore((s) => s.shares);
  const removeShare = useShareStore((s) => s.removeShare);

  const presentations = useSlideStore((s) => s.presentations);
  const setActivePresentation = useSlideStore((s) => s.setActivePresentation);
  const deletePresentation = useSlideStore((s) => s.deletePresentation);
  const renamePresentation = useSlideStore((s) => s.renamePresentation);

  // 키워드 검색: IME 조합 중에는 필터링을 보류해 "단어 완성 단위" 동작
  const [rawQuery, setRawQuery] = useState('');
  const [committedQuery, setCommittedQuery] = useState('');
  const [composing, setComposing] = useState(false);

  // 항목 인라인 이름 변경 (kind: 'file' | 'presentation')
  const [editingKind, setEditingKind] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const startRename = (kind, item) => {
    setEditingKind(kind);
    setEditingId(item.id);
    setEditName(item.name);
  };
  const cancelRename = () => {
    setEditingKind(null);
    setEditingId(null);
    setEditName('');
  };
  const confirmRename = async () => {
    if (!editingId || !editName.trim()) return cancelRename();
    if (editingKind === 'file') {
      await renameFile(editingId, editName.trim());
    } else if (editingKind === 'presentation') {
      await renamePresentation(editingId, editName.trim());
    }
    cancelRename();
  };

  const handleOpenFile = (id) => {
    setActiveFile(id);
    setCurrentView('editor');
  };

  const handleDeleteFile = async (id) => {
    if (!confirm('이 파일을 삭제할까요? 되돌릴 수 없습니다.')) return;
    await deleteFile(id);
  };

  const handleDeleteShare = async (id) => {
    if (!confirm('이 공유 링크를 삭제할까요?')) return;
    await removeShare(id);
  };

  const handleOpenPresentation = (id) => {
    setActivePresentation(id);
    setCurrentView('editor');
  };

  // 외부 공유 뷰어로 열기. 클릭 시 공유 링크를 즉시 생성하고 새 탭으로 이동.
  // (TDZ / 모듈 사이클 방지를 위해 동적 import + useAuthStore.getState() 패턴)
  const [sharingPresId, setSharingPresId] = useState(null);
  const handleOpenPresentationShare = async (pres) => {
    if (sharingPresId) return;
    setSharingPresId(pres.id);
    try {
      const [{ generatePresentationShareUrl }, { default: useAuthStore }] = await Promise.all([
        import('../utils/presentationShareUrl'),
        import('../store/useAuthStore'),
      ]);
      const user = useAuthStore.getState().user;
      const slides = Array.isArray(pres.slides) ? pres.slides : [];
      if (!slides.length) {
        alert('이 프리젠테이션에 슬라이드가 없어 공유할 수 없습니다.');
        return;
      }
      const url = await generatePresentationShareUrl(
        slides,
        user?.uid,
        pres.name || '프리젠테이션'
      );
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      console.error('공유 링크 생성 실패:', err);
      alert(`공유 링크 생성 실패: ${err?.message || err}`);
    } finally {
      setSharingPresId(null);
    }
  };

  const handleDeletePresentation = async (id) => {
    if (!confirm('이 프리젠테이션을 삭제할까요? 되돌릴 수 없습니다.')) return;
    await deletePresentation(id);
  };

  const handleCopyShareUrl = async (id) => {
    try {
      await navigator.clipboard.writeText(getShareUrl(id));
    } catch (e) {
      console.warn('Clipboard copy failed', e);
    }
  };

  const handleOpenShare = (id) => {
    window.open(getShareUrl(id), '_blank', 'noopener');
  };

  // 기본 정렬: updatedAt(없으면 createdAt) 내림차순 = 최신 항목이 위.
  // 검색어가 있으면 filterAndRank 의 유사도 순서를 그대로 유지.
  const byRecent = (a, b) =>
    (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);

  const filteredFiles = useMemo(() => {
    const list = filterAndRank(files, committedQuery, (f) => f.name || '');
    return committedQuery ? list : [...list].sort(byRecent);
  }, [files, committedQuery]);

  const filteredPresentations = useMemo(() => {
    const list = filterAndRank(presentations, committedQuery, (p) => p.name || '');
    return committedQuery ? list : [...list].sort(byRecent);
  }, [presentations, committedQuery]);

  const filteredShares = useMemo(() => {
    const list = filterAndRank(
      shares,
      committedQuery,
      (s) => s.name || new Date(s.createdAt || 0).toLocaleDateString(),
    );
    return committedQuery ? list : [...list].sort(byRecent);
  }, [shares, committedQuery]);

  const resultCount = filteredFiles.length + filteredPresentations.length + filteredShares.length;

  return (
    <main className="flex-1 h-full overflow-y-auto bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">컨텐츠</h1>
          <p className="text-sm text-slate-500 mt-1">
            생성된 파일과 공유 링크를 한 곳에서 관리합니다.
          </p>
        </header>

        {/* 검색 입력 — IME-aware: 한글 조합 중에는 필터링 보류 */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={rawQuery}
              placeholder="파일명·공유 링크 이름으로 검색 (4-gram 코사인 유사도)"
              onChange={(e) => {
                const v = e.target.value;
                setRawQuery(v);
                if (!composing) setCommittedQuery(v);
              }}
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={(e) => {
                setComposing(false);
                setCommittedQuery(e.currentTarget.value);
              }}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          {committedQuery && (
            <div className="text-xs text-slate-500 mt-2">
              {resultCount === 0
                ? `"${committedQuery}" 에 대한 결과가 없습니다`
                : `"${committedQuery}" 검색 결과 ${resultCount}건 (Files ${filteredFiles.length} · Presentations ${filteredPresentations.length} · Shares ${filteredShares.length})`}
            </div>
          )}
        </div>

        {/* Shared 테이블 (배포된 링크) */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Share2 className="w-4 h-4 text-emerald-500" />
            Shared ({filteredShares.length} / {shares.length})
          </h2>
          {filteredShares.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-10 border border-dashed border-slate-200 rounded-lg bg-white">
              {committedQuery ? '검색된 공유 링크가 없습니다.' : '아직 생성된 공유 링크가 없습니다.'}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-600 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">이름</th>
                    <th className="text-left px-4 py-2.5 font-medium w-44">생성일</th>
                    <th className="text-left px-4 py-2.5 font-medium">URL</th>
                    <th className="text-right px-4 py-2.5 font-medium w-40">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredShares.map((share) => {
                    const url = getShareUrl(share.id);
                    return (
                      <tr key={share.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-slate-700">
                          {share.name || `공유 #${share.id.slice(0, 6)}`}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs">
                          {formatDate(share.createdAt)}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs truncate max-w-xs">
                          <span className="font-mono">{url}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleCopyShareUrl(share.id)}
                              className="p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded"
                              title="URL 복사"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenShare(share.id)}
                              className="p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded"
                              title="새 탭에서 열기"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteShare(share.id)}
                              className="p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 rounded"
                              title="삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Presentations 테이블 (Files 보다 먼저 표시) */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Presentation className="w-4 h-4 text-indigo-400" />
            Presentations ({filteredPresentations.length} / {presentations.length})
          </h2>
          {filteredPresentations.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-10 border border-dashed border-slate-200 rounded-lg bg-white">
              {committedQuery ? '검색된 프리젠테이션이 없습니다.' : '아직 생성된 프리젠테이션이 없습니다.'}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-600 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">이름</th>
                    <th className="text-left px-4 py-2.5 font-medium w-24">슬라이드</th>
                    <th className="text-left px-4 py-2.5 font-medium w-44">생성일</th>
                    <th className="text-left px-4 py-2.5 font-medium w-44">수정일</th>
                    <th className="text-right px-4 py-2.5 font-medium w-40">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPresentations.map((pres) => (
                    <tr key={pres.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-700">
                        {editingKind === 'presentation' && editingId === pres.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm outline-none focus:border-indigo-500"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') confirmRename();
                                if (e.key === 'Escape') cancelRename();
                              }}
                              autoFocus
                            />
                            <button
                              onClick={confirmRename}
                              className="p-1 text-emerald-600 hover:text-emerald-700"
                              title="확인"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelRename}
                              className="p-1 text-slate-400 hover:text-slate-600"
                              title="취소"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleOpenPresentation(pres.id)}
                            className="text-left text-indigo-600 hover:underline"
                          >
                            {pres.name || `프리젠테이션 #${pres.id.slice(0, 6)}`}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 text-xs">
                        {Array.isArray(pres.slides) ? pres.slides.length : 0}장
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">
                        {formatDate(pres.createdAt)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">
                        {formatDate(pres.updatedAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenPresentationShare(pres)}
                            disabled={sharingPresId === pres.id}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 rounded disabled:opacity-50 disabled:cursor-wait"
                            title="공유 링크로 외부 슬라이드 뷰어 열기"
                          >
                            {sharingPresId === pres.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Share2 className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleOpenPresentation(pres.id)}
                            className="p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded"
                            title="에디터로 열기"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => startRename('presentation', pres)}
                            className="p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded"
                            title="이름 변경"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePresentation(pres.id)}
                            className="p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 rounded"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Files 테이블 */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <FileCode className="w-4 h-4 text-slate-400" />
            Files ({filteredFiles.length} / {files.length})
          </h2>
          {filteredFiles.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-10 border border-dashed border-slate-200 rounded-lg bg-white">
              {committedQuery ? '검색된 파일이 없습니다.' : '아직 생성된 파일이 없습니다.'}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-600 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">이름</th>
                    <th className="text-left px-4 py-2.5 font-medium w-44">생성일</th>
                    <th className="text-left px-4 py-2.5 font-medium w-44">수정일</th>
                    <th className="text-right px-4 py-2.5 font-medium w-40">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFiles.map((file) => (
                    <tr key={file.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-700">
                        {editingKind === 'file' && editingId === file.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm outline-none focus:border-indigo-500"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') confirmRename();
                                if (e.key === 'Escape') cancelRename();
                              }}
                              autoFocus
                            />
                            <button
                              onClick={confirmRename}
                              className="p-1 text-emerald-600 hover:text-emerald-700"
                              title="확인"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelRename}
                              className="p-1 text-slate-400 hover:text-slate-600"
                              title="취소"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleOpenFile(file.id)}
                            className="text-left text-indigo-600 hover:underline"
                          >
                            {file.name}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">
                        {formatDate(file.createdAt)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">
                        {formatDate(file.updatedAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenFile(file.id)}
                            className="p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded"
                            title="열기"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => startRename('file', file)}
                            className="p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded"
                            title="이름 변경"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteFile(file.id)}
                            className="p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 rounded"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
