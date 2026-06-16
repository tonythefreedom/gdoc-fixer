import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import {
  parsePresentationShareId,
  fetchSharedPresentation,
} from '../utils/presentationShareUrl';
import { patchYoutubeThumbnails } from '../utils/youtubeThumbnail.js';
import { injectMathJax } from '../utils/injectMathJax.js';

const SLIDE_W = 1280;
const SLIDE_H = 720;

export default function PresentationShareView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [index, setIndex] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFs, setIsFs] = useState(false);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

  const rootRef = useRef(null);
  const hideTimerRef = useRef(null);

  useEffect(() => {
    const id = parsePresentationShareId();
    if (!id) {
      setError(true);
      setLoading(false);
      return;
    }
    fetchSharedPresentation(id)
      .then((d) => {
        if (d && Array.isArray(d.slides) && d.slides.length > 0) {
          setData(d);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const slides = data?.slides || [];
  const total = slides.length;

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(i + 1, total - 1));
  }, [total]);
  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      rootRef.current?.requestFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (loading || error) return;
    const onKey = (e) => {
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
        setIndex(total - 1);
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loading, error, goNext, goPrev, total, toggleFullscreen]);

  useEffect(() => {
    if (loading || error) return;
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
  }, [loading, error]);

  useEffect(() => {
    if (loading || error) return;
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
  }, [loading, error]);

  useEffect(() => {
    const onFsChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    rootRef.current?.focus?.();
  }, [index]);

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-slate-900 text-slate-300">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <p className="text-slate-600 text-sm">공유된 프리젠테이션을 찾을 수 없습니다.</p>
          <a
            href={window.location.origin}
            className="mt-4 inline-block text-indigo-600 text-sm hover:underline"
          >
            에디터로 이동
          </a>
        </div>
      </div>
    );
  }

  const scale = stageSize.w && stageSize.h
    ? Math.min(stageSize.w / SLIDE_W, stageSize.h / SLIDE_H)
    : 1;
  const displayW = SLIDE_W * scale;
  const displayH = SLIDE_H * scale;

  const slide = slides[index] || '';
  // SlideEditor 와 동일한 reset + 슬라이드 root viewport 의 overflow:hidden 을
  // 무효화. Strategy Dashboard 등 일부 디자인 시스템이 우상단 absolute 위치
  // 'Last updated' 라벨을 viewport 가장자리(또는 살짝 밖) 에 박는데 root 의
  // overflow:hidden 때문에 가장 우측 글자가 잘려나가는 현상을 방지.
  const srcDoc = `<style>html,body{margin:0;padding:0;overflow:hidden}body>div{overflow:visible!important}</style>${injectMathJax(patchYoutubeThumbnails(slide))}`;

  const title = data?.name || '공유된 프리젠테이션';

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className="fixed inset-0 z-[60] bg-black flex items-center justify-center select-none outline-none"
      style={{ cursor: controlsVisible ? 'default' : 'none' }}
    >
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
            pointerEvents: 'none',
          }}
          title={`슬라이드 ${index + 1}`}
        />
      </div>

      {/* 좌우 클릭 영역 */}
      <div
        className="absolute inset-y-0 left-0 w-1/4"
        onClick={goPrev}
        style={{ cursor: index > 0 ? 'w-resize' : 'default' }}
      />
      <div
        className="absolute inset-y-0 right-0 w-1/4"
        onClick={goNext}
        style={{ cursor: index < total - 1 ? 'e-resize' : 'default' }}
      />

      {/* 상단 바 */}
      <div
        className={`absolute top-0 left-0 right-0 px-6 py-3 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent transition-opacity ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3 text-white/90 text-sm">
          <span className="font-medium truncate max-w-[40vw]">{title}</span>
          <span className="text-white/50">·</span>
          <span>{index + 1} / {total}</span>
        </div>
        <button
          onClick={toggleFullscreen}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-white/90 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          title="브라우저 전체 화면 토글 (F)"
        >
          {isFs ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          {isFs ? '복원' : '전체 화면'}
        </button>
      </div>

      {/* 하단 바 */}
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
          disabled={index === total - 1}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div
        className={`absolute bottom-20 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/60 text-white/70 text-[11px] rounded-full transition-opacity ${
          controlsVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        ←/→ · Space · F
      </div>
    </div>
  );
}
