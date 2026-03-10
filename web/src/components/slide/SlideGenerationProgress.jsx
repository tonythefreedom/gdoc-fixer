import { Loader2, Check, Circle, AlertCircle } from 'lucide-react';
import useSlideStore from '../../store/useSlideStore';

const PHASES = [
  { key: 'converting', label: 'AI 슬라이드 생성' },
  { key: 'fixing', label: '뷰포트 수정' },
  { key: 'uploading', label: '이미지 업로드' },
  { key: 'saving', label: '저장' },
];

function phaseIndex(phase) {
  const idx = PHASES.findIndex((p) => p.key === phase);
  return idx >= 0 ? idx : -1;
}

function StepIndicator({ status, label, detail }) {
  return (
    <div className="flex items-center gap-3">
      {status === 'complete' && <Check className="w-5 h-5 text-emerald-500 shrink-0" />}
      {status === 'active' && <Loader2 className="w-5 h-5 text-indigo-500 animate-spin shrink-0" />}
      {status === 'pending' && <Circle className="w-5 h-5 text-slate-300 shrink-0" />}
      {status === 'error' && <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />}
      <span className={`text-sm ${status === 'active' ? 'text-indigo-700 font-medium' : status === 'complete' ? 'text-slate-600' : 'text-slate-400'}`}>
        {label}
        {detail && <span className="ml-1.5 text-xs text-slate-400">({detail})</span>}
      </span>
    </div>
  );
}

export default function SlideGenerationProgress() {
  const progress = useSlideStore((s) => s.generationProgress);
  if (!progress) return null;

  const { phase, current, total, message } = progress;
  const currentIdx = phaseIndex(phase);
  const isError = phase === 'error';
  const isComplete = phase === 'complete';

  // 전체 진행률 계산
  let percent = 0;
  if (isComplete) {
    percent = 100;
  } else if (!isError && currentIdx >= 0) {
    const phaseWeight = 100 / PHASES.length;
    const phaseProgress = total > 0 ? current / total : 0;
    percent = Math.round(currentIdx * phaseWeight + phaseProgress * phaseWeight);
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm p-8">
        <h3 className="text-lg font-semibold text-slate-800 mb-6">
          {isComplete ? '프레젠테이션 생성 완료' : isError ? '생성 오류' : '프레젠테이션 생성 중'}
        </h3>

        <div className="space-y-3 mb-6">
          {PHASES.map((p, idx) => {
            let status = 'pending';
            let detail = null;
            if (isError) {
              status = idx <= currentIdx ? (idx < currentIdx ? 'complete' : 'error') : 'pending';
            } else if (isComplete) {
              status = 'complete';
            } else if (idx < currentIdx) {
              status = 'complete';
            } else if (idx === currentIdx) {
              status = 'active';
              if (total > 0) detail = `${current + 1}/${total}`;
            }
            return <StepIndicator key={p.key} status={status} label={p.label} detail={detail} />;
          })}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-200 rounded-full h-2 mb-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${isError ? 'bg-red-500' : isComplete ? 'bg-emerald-500' : 'bg-indigo-500'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className={`text-xs ${isError ? 'text-red-500' : 'text-slate-400'}`}>{message}</p>
      </div>
    </div>
  );
}
