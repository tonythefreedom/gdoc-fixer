import { useState, useEffect, useRef } from 'react';
import { X, Check } from 'lucide-react';
import { SLIDE_DESIGN_SYSTEMS } from '../../utils/slideDesignSystems';

/**
 * 16:9 미니 슬라이드 썸네일.
 * 디자인 시스템의 palette + typography 를 실제로 사용해 샘플 슬라이드를
 * 렌더링하므로 정적 색상 칩보다 훨씬 직관적이다.
 */
function DesignThumbnail({ ds, size = 'sm' }) {
  const dims = size === 'lg' ? { w: 384, h: 216 } : { w: 224, h: 126 };
  const scale = dims.w / 1280;

  // body 안에 1280x720 슬라이드를 만들고 css scale 로 축소.
  return (
    <div
      className="relative overflow-hidden border border-slate-200 bg-slate-50"
      style={{ width: dims.w, height: dims.h }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: ds.palette.background,
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
          width: 1280,
          height: 720,
          padding: ds.layout.padding,
          fontFamily: ds.typography.body,
          color: ds.palette.text,
          boxSizing: 'border-box',
        }}
      >
        {/* 강조 바 / 칩 — 디자인별 분위기 차별화 */}
        <div
          style={{
            display: 'inline-block',
            background: ds.palette.primary,
            color: ds.palette.background.includes('gradient') ? '#fff' : ds.palette.background,
            padding: '6px 18px',
            borderRadius: ds.layout.borderRadius,
            fontSize: ds.typography.captionSize,
            fontWeight: ds.typography.weights.caption,
            marginBottom: 24,
            fontFamily: ds.typography.heading,
          }}
        >
          CHAPTER 01
        </div>
        {/* 타이틀 */}
        <div
          style={{
            fontFamily: ds.typography.heading,
            fontSize: ds.typography.titleSize,
            fontWeight: ds.typography.weights.title,
            lineHeight: 1.1,
            color: ds.palette.text,
            marginBottom: 32,
          }}
        >
          {ds.name}
          <span style={{ color: ds.palette.accent }}>.</span>
        </div>
        {/* 본문 */}
        <div
          style={{
            fontFamily: ds.typography.body,
            fontSize: ds.typography.bodySize,
            fontWeight: ds.typography.weights.body,
            lineHeight: 1.5,
            color: ds.palette.muted,
            maxWidth: 900,
          }}
        >
          {ds.description}
        </div>
        {/* 디바이더 */}
        <div
          style={{
            position: 'absolute',
            left: ds.layout.padding,
            right: ds.layout.padding,
            bottom: ds.layout.padding,
            height: 2,
            background: ds.palette.divider,
            opacity: ds.palette.divider === 'none' ? 0 : 1,
          }}
        />
      </div>
    </div>
  );
}

/**
 * 디자인 시스템 picker — 작은 트리거 버튼 + 큰 모달 그리드.
 *
 * <SlideDesignPicker value={id} onChange={(id)=>{}} disabled={false} />
 */
export default function SlideDesignPicker({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const modalRef = useRef(null);
  const current = SLIDE_DESIGN_SYSTEMS.find((d) => d.id === value) || SLIDE_DESIGN_SYSTEMS[0];

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const handlePick = (id) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        title="프리젠테이션 디자인 시스템 선택"
        className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 text-slate-700 text-xs font-medium rounded-lg transition-colors"
      >
        {/* 미니 swatch 3 색 */}
        <span className="flex items-center -space-x-1">
          {[current.palette.primary, current.palette.accent, current.palette.divider].map((c, i) => (
            <span
              key={i}
              className="w-3 h-3 rounded-full border border-white shadow-sm"
              style={{ background: c }}
            />
          ))}
        </span>
        <span className="truncate max-w-[100px]">{current.name}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            ref={modalRef}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">프리젠테이션 디자인 시스템</h2>
                <p className="text-xs text-slate-500 mt-0.5">변환 시 모든 슬라이드에 적용됩니다 · 호버하면 큰 미리보기</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6 overflow-y-auto">
              {SLIDE_DESIGN_SYSTEMS.map((ds) => {
                const selected = ds.id === value;
                return (
                  <button
                    key={ds.id}
                    type="button"
                    onClick={() => handlePick(ds.id)}
                    className={`group text-left rounded-xl overflow-hidden border-2 transition-all ${
                      selected
                        ? 'border-indigo-500 ring-2 ring-indigo-200'
                        : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <div className="flex justify-center bg-slate-50 p-3">
                      <DesignThumbnail ds={ds} size="sm" />
                    </div>
                    <div className="p-3 bg-white">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {ds.name}
                        </h3>
                        {selected && (
                          <span className="flex items-center gap-1 text-xs text-indigo-600 font-medium">
                            <Check className="w-3.5 h-3.5" />
                            선택됨
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{ds.nameEn}</p>
                      <p className="text-xs text-slate-600 mt-2 line-clamp-2">{ds.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
