import { useRef, useState, useEffect } from 'react';
import useAppStore from '../../store/useAppStore';
import { useResizable } from '../../hooks/useResizable';
import PreviewIframe from './PreviewIframe';
import ResizeHandle from './ResizeHandle';

export default function PreviewContainer({ iframeRef }) {
  const viewportWidth = useAppStore((s) => s.viewportWidth);
  const viewportHeight = useAppStore((s) => s.viewportHeight);
  const setViewportSize = useAppStore((s) => s.setViewportSize);
  const activeFileContent = useAppStore((s) => s.activeFileContent);

  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerSize({
        w: entry.contentRect.width,
        h: entry.contentRect.height,
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Calculate scale to fit viewport within container (with padding)
  const padding = 40;
  const availW = Math.max(100, containerSize.w - padding * 2);
  const availH = Math.max(100, containerSize.h - padding * 2);
  const scale = Math.min(availW / viewportWidth, availH / viewportHeight, 1);

  const scaledW = viewportWidth * scale;
  const scaledH = viewportHeight * scale;

  const { handleMouseDown } = useResizable({
    viewportWidth,
    viewportHeight,
    setViewportSize,
    scale,
  });

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-slate-200 overflow-hidden flex items-center justify-center relative"
    >
      <div className="relative" style={{ width: scaledW, height: scaledH }}>
        {/* Scaled iframe wrapper */}
        <div
          style={{
            width: viewportWidth,
            height: viewportHeight,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <PreviewIframe
            ref={iframeRef}
            htmlContent={activeFileContent}
            viewportWidth={viewportWidth}
            viewportHeight={viewportHeight}
          />
        </div>

        {/* Resize handles */}
        <ResizeHandle
          edge="right"
          onMouseDown={handleMouseDown}
          scaledW={scaledW}
          scaledH={scaledH}
        />
        <ResizeHandle
          edge="bottom"
          onMouseDown={handleMouseDown}
          scaledW={scaledW}
          scaledH={scaledH}
        />
        <ResizeHandle
          edge="corner"
          onMouseDown={handleMouseDown}
          scaledW={scaledW}
          scaledH={scaledH}
        />
      </div>

      {/* Dimension label */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-slate-800/80 text-white text-[10px] font-mono rounded-full backdrop-blur-sm">
        {viewportWidth} x {viewportHeight} px
        {scale < 1 && (
          <span className="text-slate-400 ml-2">
            ({Math.round(scale * 100)}%)
          </span>
        )}
      </div>
    </div>
  );
}
