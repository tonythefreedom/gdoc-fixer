import { useRef, useState, useEffect } from 'react';
import { X } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import { useResizable } from '../../hooks/useResizable';
import PreviewIframe from './PreviewIframe';
import ResizeHandle from './ResizeHandle';

export default function PreviewContainer({ iframeRef }) {
  const viewportWidth = useAppStore((s) => s.viewportWidth);
  const viewportHeight = useAppStore((s) => s.viewportHeight);
  const setViewportSize = useAppStore((s) => s.setViewportSize);
  const activeFileContent = useAppStore((s) => s.activeFileContent);
  const attachments = useAppStore((s) => s.attachments);
  const detachFile = useAppStore((s) => s.detachFile);

  const imageAttachments = attachments
    .map((att, idx) => ({ ...att, originalIndex: idx }))
    .filter((att) => att.type === 'image');

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

      {/* Image attachment thumbnails — left margin */}
      {imageAttachments.length > 0 && (
        <div className="absolute top-4 left-4 flex flex-col gap-3 z-10">
          {imageAttachments.map((att) => (
            <div
              key={att.originalIndex}
              className="relative group rounded-lg overflow-hidden shadow-lg border-2 border-white/80 bg-white"
              style={{ width: 96, height: 96 }}
            >
              <img
                src={`data:${att.mimeType};base64,${att.base64}`}
                alt={att.fileName}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => detachFile(att.originalIndex)}
                className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100"
                title="첨부 해제"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 bg-black/50 text-white text-[9px] truncate opacity-0 group-hover:opacity-100 transition-opacity">
                {att.fileName}
              </div>
            </div>
          ))}
        </div>
      )}

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
