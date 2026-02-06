import { useCallback } from 'react';

export function useResizable({ viewportWidth, viewportHeight, setViewportSize, scale }) {
  const handleMouseDown = useCallback(
    (edge) => (startEvent) => {
      startEvent.preventDefault();
      const startX = startEvent.clientX;
      const startY = startEvent.clientY;
      const startW = viewportWidth;
      const startH = viewportHeight;

      const handleMouseMove = (e) => {
        const dx = (e.clientX - startX) / scale;
        const dy = (e.clientY - startY) / scale;

        let newW = startW;
        let newH = startH;

        if (edge === 'right' || edge === 'corner') {
          newW = Math.max(320, Math.round(startW + dx));
        }
        if (edge === 'bottom' || edge === 'corner') {
          newH = Math.max(320, Math.round(startH + dy));
        }

        setViewportSize(newW, newH);
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        // Re-enable iframe pointer events
        document.querySelectorAll('iframe').forEach((f) => {
          f.style.pointerEvents = '';
        });
      };

      // Disable iframe pointer events during drag
      document.querySelectorAll('iframe').forEach((f) => {
        f.style.pointerEvents = 'none';
      });

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [viewportWidth, viewportHeight, setViewportSize, scale]
  );

  return { handleMouseDown };
}
