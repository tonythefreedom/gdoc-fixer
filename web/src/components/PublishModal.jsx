import { Loader2, X, ExternalLink, Check, AlertCircle, Rocket, Circle, MinusCircle } from 'lucide-react';
import usePublishStore from '../store/usePublishStore';

// 단계 상태 아이콘
function StepIcon({ status }) {
  if (status === 'success') return <Check className="w-4 h-4 text-emerald-600" />;
  if (status === 'running') return <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />;
  if (status === 'error') return <AlertCircle className="w-4 h-4 text-red-600" />;
  if (status === 'skipped') return <MinusCircle className="w-4 h-4 text-slate-400" />;
  return <Circle className="w-4 h-4 text-slate-300" />;
}

export default function PublishModal() {
  const modalOpen = usePublishStore((s) => s.modalOpen);
  const status = usePublishStore((s) => s.status);
  const steps = usePublishStore((s) => s.steps);
  const result = usePublishStore((s) => s.result);
  const error = usePublishStore((s) => s.error);
  const closeModal = usePublishStore((s) => s.closeModal);
  const startPublish = usePublishStore((s) => s.startPublish);
  const reset = usePublishStore((s) => s.reset);

  if (!modalOpen) return null;

  const isPublishing = status === 'publishing';
  const handleClose = () => {
    if (isPublishing) return;
    closeModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={handleClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-indigo-500" />
            <h2 className="text-base font-semibold text-slate-800">연쇄 게시</h2>
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
          {status === 'idle' ? (
            <>
              <p className="text-sm text-slate-600 leading-relaxed">
                현재 문서를 <span className="font-semibold">tech-blog → 커뮤니티 → LinkedIn</span> 순으로 한 번에 게시합니다.
              </p>
              <ul className="mt-3 text-xs text-slate-500 space-y-1 list-disc list-inside">
                <li>tech-blog(tony.banya.ai)에 영문 자동 번역으로 게시</li>
                <li>협동조합 커뮤니티(AI/LLM)에 게시 — 출처는 tech-blog 글</li>
                <li>LinkedIn 조직 페이지에 게시 — 출처는 커뮤니티 글</li>
                <li>각 단계가 직전 사이트를 출처로 연결해 홍보 효과를 높입니다</li>
              </ul>
              <div className="mt-5 flex gap-2 justify-end">
                <button onClick={closeModal} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                  취소
                </button>
                <button
                  onClick={startPublish}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
                >
                  <Rocket className="w-4 h-4" />
                  연쇄 게시 시작
                </button>
              </div>
            </>
          ) : (
            <>
              {/* 단계별 진행 */}
              <ol className="space-y-3">
                {steps.map((s, i) => (
                  <li key={s.key} className="flex items-start gap-3">
                    <div className="mt-0.5"><StepIcon status={s.status} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">{i + 1}. {s.label}</span>
                        {s.status === 'skipped' && <span className="text-[11px] text-slate-400">건너뜀</span>}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{s.hint}</p>
                      {s.url && (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline mt-1 break-all"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          {s.url}
                        </a>
                      )}
                      {s.error && <p className="text-xs text-red-600 mt-1 break-words">{s.error}</p>}
                    </div>
                  </li>
                ))}
              </ol>

              {/* 요약 배너 */}
              {status === 'success' && (
                <div className="mt-4 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium">
                  ✅ 모든 단계 게시 완료
                </div>
              )}
              {status === 'partial' && (
                <div className="mt-4 px-3 py-2 rounded-lg bg-amber-50 text-amber-700 text-sm">
                  {result?.linkedInSkipped
                    ? '커뮤니티까지 게시 완료 · LinkedIn은 자격증명 미설정으로 건너뜀'
                    : `일부 단계 실패${error ? ` — ${error}` : ''}`}
                </div>
              )}
              {status === 'error' && (
                <div className="mt-4 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm break-words">
                  {error || '게시 중 오류가 발생했습니다.'}
                </div>
              )}

              <div className="mt-5 flex gap-2 justify-end">
                <button
                  onClick={closeModal}
                  disabled={isPublishing}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-30"
                >
                  닫기
                </button>
                {(status === 'error' || status === 'partial') && (
                  <button
                    onClick={() => { reset(); startPublish(); }}
                    className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
                  >
                    다시 시도
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
