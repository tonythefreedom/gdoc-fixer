import { useState, useCallback } from 'react';
import { toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';

const SLIDE_W = 1280;
const SLIDE_H = 720;

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Preload Google Font for slide rendering
function injectFont(container) {
  const style = document.createElement('style');
  style.textContent = `@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap');`;
  container.prepend(style);
}

// Wait for fonts to be available
async function waitForFonts() {
  try {
    await document.fonts.ready;
    await document.fonts.load('400 16px "Noto Sans KR"');
    await document.fonts.load('700 16px "Noto Sans KR"');
  } catch {
    await delay(1000);
  }
}

export function usePdfExport() {
  const [pdfLoading, setPdfLoading] = useState(false);

  const exportSlidesToPdf = useCallback(async (slides) => {
    if (!slides?.length || pdfLoading) return;
    setPdfLoading(true);

    const container = document.createElement('div');
    container.style.cssText = `position:fixed;left:0;top:0;z-index:-9999;opacity:0;pointer-events:none;`;
    document.body.appendChild(container);

    try {
      injectFont(container);
      await waitForFonts();

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [SLIDE_W, SLIDE_H],
        hotfixes: ['px_scaling'],
      });

      for (let i = 0; i < slides.length; i++) {
        const slideEl = document.createElement('div');
        slideEl.style.cssText = `width:${SLIDE_W}px;height:${SLIDE_H}px;overflow:hidden;background:#fff;`;
        slideEl.innerHTML = slides[i];
        container.appendChild(slideEl);

        await delay(500);

        const canvas = await toCanvas(slideEl, {
          width: SLIDE_W,
          height: SLIDE_H,
          pixelRatio: 3,
          cacheBust: true,
          imagePlaceholder: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        });

        if (i > 0) pdf.addPage([SLIDE_W, SLIDE_H], 'landscape');
        pdf.addImage(
          canvas.toDataURL('image/jpeg', 0.95),
          'JPEG',
          0, 0, SLIDE_W, SLIDE_H,
          undefined,
          'FAST'
        );

        container.removeChild(slideEl);
      }

      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      console.error('PDF export failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`PDF 변환 실패: ${msg}`);
    } finally {
      document.body.removeChild(container);
      setPdfLoading(false);
    }
  }, [pdfLoading]);

  return { exportSlidesToPdf, pdfLoading };
}
