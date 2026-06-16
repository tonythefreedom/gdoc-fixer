import { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, Maximize2, Minimize2 } from 'lucide-react';
import { patchYoutubeThumbnails } from '../../utils/youtubeThumbnail.js';
import { injectMathJax } from '../../utils/injectMathJax.js';

const SLIDE_W = 1280;
const SLIDE_H = 720;

/**
 * 전체 화면 슬라이드 모드.
 * - 슬라이드 1280×720 을 화면 사이즈에 맞춰 비율 유지 scale 로 표시.
 * - 좌/우 화살표 · Space · PageDown/PageUp 으로 이동.
 * - ESC 또는 X 로 종료.
 * - "전체 화면 (F11)" 버튼으로 실제 브라우저 fullscreen 토글.
 * - 컨트롤 바는 마우스 이동 시 잠깐 노출.
 */
export default function SlidePresentMode({ slides, startIndex = 0, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFs, setIsFs] = useState(false);
  const rootRef = useRef(null);
  const hideTimerRef = useRef(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(i + 1, slides.length - 1));
  }, [slides.length]);
  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  // 키 핸들러
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        } else {
          onClose?.();
        }
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'Home') {
        e.preventDefault();
        setIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setIndex(slides.length - 1);
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, slides.length, onClose]);

  // 마우스 이동 시 컨트롤 표시 + 자동 숨김
  useEffect(() => {
    const onMove = () => {
      setControlsVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), 2500);
    };
    window.addEventListener('mousemove', onMove);
    onMove();
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // 무대 사이즈 측정
  useEffect(() => {
    const measure = () => {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setStageSize({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (rootRef.current) ro.observe(rootRef.current);
    return () => ro.disconnect();
  }, []);

  // 실제 fullscreen 상태 동기화
  useEffect(() => {
    const onFsChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // 진입 시 자동으로 브라우저 fullscreen 시도 + root 에 키 포커스 유지.
  // (iframe 이 포커스를 가져가면 window keydown 이 안 잡혀서 ←/→ 가 먹통이 됨)
  useEffect(() => {
    if (rootRef.current && !document.fullscreenElement) {
      rootRef.current.requestFullscreen?.().catch(() => {});
    }
    rootRef.current?.focus?.();
  }, []);

  // 슬라이드 전환 시에도 root 에 포커스 되돌려서 다음 키 입력을 보장.
  useEffect(() => {
    rootRef.current?.focus?.();
  }, [index]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      rootRef.current?.requestFullscreen?.().catch(() => {});
    }
  };

  // 16:9 비율 유지하면서 가능한 한 크게
  const scale = stageSize.w && stageSize.h
    ? Math.min(stageSize.w / SLIDE_W, stageSize.h / SLIDE_H)
    : 1;
  const displayW = SLIDE_W * scale;
  const displayH = SLIDE_H * scale;

  const slide = slides[index] || '';
  // body 폭/높이 강제 reset 은 슬라이드 root 와 충돌해 잘림을 만든다. SlideEditor
  // 와 동일한 단순 reset + body>div overflow:visible 로 viewport 가장자리 라벨도
  // 잘리지 않게.
  const srcDoc = `<style>html,body{margin:0;padding:0;overflow:hidden}body>div{overflow:visible!important}</style>${injectMathJax(patchYoutubeThumbnails(slide))}`;

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className="fixed inset-0 z-[60] bg-black flex items-center justify-center select-none outline-none"
      style={{ cursor: controlsVisible ? 'default' : 'none' }}
    >
      {/* 슬라이드 스테이지 */}
      <div
        style={{
          width: displayW,
          height: displayH,
          background: '#fff',
          boxShadow: '0 0 60px rgba(0,0,0,0.5)',
        }}
      >
        <iframe
          key={index}
          srcDoc={srcDoc}
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          tabIndex={-1}
          style={{
            width: SLIDE_W,
            height: SLIDE_H,
            border: 'none',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            background: '#fff',
            // iframe 이 포커스를 가져가면 부모 window keydown 이 안 잡혀
            // 좌/우 화살표가 먹통이 된다. 슬라이드는 보기 전용이므로 클릭
            // 자체를 차단. 좌/우 1/4 클릭 영역은 그대로 동작.
            pointerEvents: 'none',
          }}
          title={`슬라이드 ${index + 1}`}
        />
      </div>

      {/* 좌측 클릭 영역 (이전) */}
      <div
        className="absolute inset-y-0 left-0 w-1/4"
        onClick={goPrev}
        style={{ cursor: index > 0 ? 'w-resize' : 'default' }}
      />
      {/* 우측 클릭 영역 (다음) */}
      <div
        className="absolute inset-y-0 right-0 w-1/4"
        onClick={goNext}
        style={{ cursor: index < slides.length - 1 ? 'e-resize' : 'default' }}
      />

      {/* 상단 컨트롤 바 */}
      <div
        className={`absolute top-0 left-0 right-0 px-6 py-3 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent transition-opacity ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2 text-white/90 text-sm font-medium">
          <span>{index + 1} / {slides.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-white/90 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            title="브라우저 전체 화면 토글 (F)"
          >
            {isFs ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            {isFs ? '복원' : '전체 화면'}
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-white/90 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            title="종료 (ESC)"
          >
            <X className="w-3.5 h-3.5" />
            종료
          </button>
        </div>
      </div>

      {/* 하단 컨트롤 바 */}
      <div
        className={`absolute bottom-0 left-0 right-0 px-6 py-4 flex items-center justify-center gap-4 bg-gradient-to-t from-black/70 to-transparent transition-opacity ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <button
          onClick={goPrev}
          disabled={index === 0}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-1.5 max-w-[60vw] overflow-x-auto">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-8 bg-white' : 'w-2 bg-white/40 hover:bg-white/70'
              }`}
              title={`슬라이드 ${i + 1}`}
            />
          ))}
        </div>
        <button
          onClick={goNext}
          disabled={index === slides.length - 1}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* 단축키 힌트 */}
      <div
        className={`absolute bottom-20 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/60 text-white/70 text-[11px] rounded-full transition-opacity ${
          controlsVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        ←/→ · Space · F · ESC
      </div>
    </div>
  );
}
