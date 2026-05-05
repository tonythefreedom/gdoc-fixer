import { useState } from 'react';
import { Loader2, X, ExternalLink, Copy, Check, AlertCircle, Globe } from 'lucide-react';
import usePublishStore from '../store/usePublishStore';

export default function PublishModal() {
  const modalOpen = usePublishStore((s) => s.modalOpen);
  const status = usePublishStore((s) => s.status);
  const result = usePublishStore((s) => s.result);
  const error = usePublishStore((s) => s.error);
  const closeModal = usePublishStore((s) => s.closeModal);
  const startPublish = usePublishStore((s) => s.startPublish);
  const reset = usePublishStore((s) => s.reset);
  const [copied, setCopied] = useState(false);

  if (!modalOpen) return null;

  const isPublishing = status === 'publishing';

  const handleCopy = async () => {
    if (!result?.url) return;
    await navigator.clipboard.writeText(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    if (isPublishing) return;
    closeModal();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-500" />
            <h2 className="text-base font-semibold text-slate-800">tech-blog 게시</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isPublishing}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5">
          {status === 'idle' && (
            <>
              <p className="text-sm text-slate-600 leading-relaxed">
                현재 문서를 <span className="font-semibold">tony.banya.ai</span>에 게시합니다.
              </p>
              <ul className="mt-3 text-xs text-slate-500 space-y-1 list-disc list-inside">
                <li>한글 본문을 영문으로 자동 번역합니다</li>
                <li>제목·요약·썸네일 메타데이터를 LLM이 추출합니다</li>
                <li>완료까지 1~2분 정도 걸릴 수 있습니다</li>
              </ul>
              <div className="mt-5 flex gap-2 justify-end">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  취소
                </button>
                <button
                  onClick={startPublish}
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
                >
                  게시
                </button>
              </div>
            </>
          )}

          {status === 'publishing' && (
            <div className="flex flex-col items-center py-6">
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
              <p className="text-sm text-slate-700 font-medium">게시 중입니다...</p>
              <p className="text-xs text-slate-500 mt-1">번역 → 메타 추출 → Firestore 쓰기</p>
              <p className="text-xs text-slate-400 mt-3">창을 닫지 마세요. 보통 1~2분 소요됩니다.</p>
            </div>
          )}

          {status === 'success' && result && (
            <>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">게시 완료</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {(result.sizeBytes / 1024).toFixed(1)} KB · {result.id}
                  </p>
                </div>
              </div>

              {result.titles && (
                <div className="space-y-1.5 mb-4 text-xs">
                  <div className="flex gap-2">
                    <span className="font-semibold text-slate-500 w-8">KO</span>
                    <span className="text-slate-700">{result.titles.ko}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-slate-500 w-8">EN</span>
                    <span className="text-slate-700">{result.titles.en}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 break-all">
                {result.url}
              </div>

              <div className="mt-4 flex gap-2 justify-end">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  {copied ? '복사됨' : 'URL 복사'}
                </button>
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
                >
                  <ExternalLink className="w-4 h-4" />
                  새 탭에서 열기
                </a>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">게시 실패</p>
                  <p className="text-xs text-red-600 mt-1 break-words">{error}</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2 justify-end">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  닫기
                </button>
                <button
                  onClick={() => {
                    reset();
                    startPublish();
                  }}
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
                >
                  다시 시도
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
